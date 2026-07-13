const fs = require('fs');

const file = 'src/application/useCases/ReceiveRMA.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
`    const itemsToSave = new Set<InventoryItem>();
    const layersToSave: InventoryCostLayer[] = [];
    const quarantineItemsToSave: QuarantineItem[] = [];
    const serializedItemsToSave = new Set<any>(); // any due to import types, but we'll use array from set

    // Create an in-memory cache for fetched inventory items during this transaction
    // to prevent race conditions when the same sku and location are processed in multiple items
    const inventoryCache = new Map<string, InventoryItem>();

    await Promise.all(dto.items.map(async (item) => {
      const rmaItem = rmaItemsMap.get(item.variantId);
      if (!rmaItem) {
        throw new Error(\`Item with variant ID \${item.variantId} not found in RMA \${rma.rmaNumber}.\`);
      }

      // 1. Process receipt on RMA aggregate
      rma.receiveItem(item.variantId, item.quantityReceived, item.disposition);

      const targetLocationId =
        item.disposition === RMADisposition.Quarantine
          ? \`\${rma.locationId}-quarantine\`
          : rma.locationId;

      // 2. Increment stock level
      const sku = SKU.create(item.variantId);
      const cacheKey = \`\${item.variantId}_\${targetLocationId}\`;

      let invItem = inventoryCache.get(cacheKey) || null;
      if (!invItem) {
        invItem = await this.inventoryRepository.findBySku(sku, targetLocationId) || null;
        if (!invItem) {
          invItem = InventoryItem.create(
            crypto.randomUUID(),
            sku,
            targetLocationId,
            Quantity.create(0)
          );
        }
        inventoryCache.set(cacheKey, invItem);
      }

      invItem.receiveStock(Quantity.create(item.quantityReceived));
      itemsToSave.add(invItem);`,
`    const itemsToSave = new Set<InventoryItem>();
    const layersToSave: InventoryCostLayer[] = [];
    const quarantineItemsToSave: QuarantineItem[] = [];
    const serializedItemsToSave = new Set<any>(); // any due to import types, but we'll use array from set

    // Optimization: Prefetch all needed inventory items in bulk
    const skusToFetch = Array.from(new Set(dto.items.map(i => i.variantId))).map(v => SKU.create(v));
    let fetchedInvItems: InventoryItem[] = [];

    // We fetch for both potential locations (normal and quarantine) using the repository
    const normalLocationId = rma.locationId;
    const quarantineLocationId = \`\${rma.locationId}-quarantine\`;

    if (this.inventoryRepository.findBySkus && skusToFetch.length > 0) {
      const [normalItems, quarantineItems] = await Promise.all([
        this.inventoryRepository.findBySkus(skusToFetch, normalLocationId),
        this.inventoryRepository.findBySkus(skusToFetch, quarantineLocationId)
      ]);
      fetchedInvItems = [...normalItems, ...quarantineItems];
    } else if (skusToFetch.length > 0) {
      const normalResults = await Promise.all(skusToFetch.map(sku => this.inventoryRepository.findBySku(sku, normalLocationId)));
      const quarantineResults = await Promise.all(skusToFetch.map(sku => this.inventoryRepository.findBySku(sku, quarantineLocationId)));
      fetchedInvItems = [...normalResults, ...quarantineResults].filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined);
    }

    // Create an in-memory cache for fetched inventory items during this transaction
    // to prevent race conditions when the same sku and location are processed in multiple items
    const inventoryCache = new Map<string, InventoryItem>();
    for(const item of fetchedInvItems) {
        inventoryCache.set(\`\${item.sku.getValue()}_\${item.locationId}\`, item);
    }

    // Process items sequentially instead of Promise.all mapping to eliminate race conditions
    // since we've eliminated the N+1 DB lookup bottleneck anyway.
    for (const item of dto.items) {
      const rmaItem = rmaItemsMap.get(item.variantId);
      if (!rmaItem) {
        throw new Error(\`Item with variant ID \${item.variantId} not found in RMA \${rma.rmaNumber}.\`);
      }

      // 1. Process receipt on RMA aggregate
      rma.receiveItem(item.variantId, item.quantityReceived, item.disposition);

      const targetLocationId =
        item.disposition === RMADisposition.Quarantine
          ? quarantineLocationId
          : normalLocationId;

      // 2. Increment stock level
      const sku = SKU.create(item.variantId);
      const cacheKey = \`\${item.variantId}_\${targetLocationId}\`;

      let invItem = inventoryCache.get(cacheKey) || null;
      if (!invItem) {
        invItem = InventoryItem.create(
          crypto.randomUUID(),
          sku,
          targetLocationId,
          Quantity.create(0)
        );
        inventoryCache.set(cacheKey, invItem);
      }

      invItem.receiveStock(Quantity.create(item.quantityReceived));
      itemsToSave.add(invItem);`
);

code = code.replace(
`      // 7. Handle Serialized items transitions
      if (item.serialNumbers && this.serializedItemRepository) {
        await Promise.all(item.serialNumbers.map(async (sn) => {
          const serialObj = new SerialNumber(sn);
          const serialItem = await this.serializedItemRepository!.findBySerialOrFail(serialObj, rma.tenantId);
          serialItem.acceptReturn(\`RMA-\${rma.id}\`, "system");

          if (item.disposition === RMADisposition.Restock) {
            serialItem.restock("system", \`RMA-\${rma.id}\`);
          } else if (item.disposition === RMADisposition.Quarantine) {
            serialItem.quarantine(\`RMA return: Quarantine\`, "system", \`RMA-\${rma.id}\`);
          } else if (item.disposition === RMADisposition.Scrap) {
            serialItem.writeOff(\`RMA return: Scrapped\`, "system", \`RMA-\${rma.id}\`);
          }
          serializedItemsToSave.add(serialItem);
        }));
      }
    }));`,
`      // 7. Handle Serialized items transitions
      if (item.serialNumbers && this.serializedItemRepository) {
        await Promise.all(item.serialNumbers.map(async (sn) => {
          const serialObj = new SerialNumber(sn);
          const serialItem = await this.serializedItemRepository!.findBySerialOrFail(serialObj, rma.tenantId);
          serialItem.acceptReturn(\`RMA-\${rma.id}\`, "system");

          if (item.disposition === RMADisposition.Restock) {
            serialItem.restock("system", \`RMA-\${rma.id}\`);
          } else if (item.disposition === RMADisposition.Quarantine) {
            serialItem.quarantine(\`RMA return: Quarantine\`, "system", \`RMA-\${rma.id}\`);
          } else if (item.disposition === RMADisposition.Scrap) {
            serialItem.writeOff(\`RMA return: Scrapped\`, "system", \`RMA-\${rma.id}\`);
          }
          serializedItemsToSave.add(serialItem);
        }));
      }
    }`
);

fs.writeFileSync(file, code);
