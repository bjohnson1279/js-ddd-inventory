import { prisma } from "../../infrastructure/database/prisma";
import { Logger } from "../../infrastructure/logging/logger";
import crypto from "crypto";

export class AuditProcessorService {
  private async fetchShopifyQuantity(
    variantSku: string,
    storeDomain: string,
    accessToken: string,
    shopifyLocationId: string
  ): Promise<number | null> {
    try {
      const response = await fetch(
        `https://${storeDomain}/admin/api/2024-04/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken
          },
          body: JSON.stringify({
            query: `
              query findInventoryItem($query: String!) {
                inventoryItems(first: 1, query: $query) {
                  edges {
                    node {
                      id
                      inventoryLevels(first: 10) {
                        edges {
                          node {
                            location { id }
                            quantities(names: ["available"]) { quantity }
                          }
                        }
                      }
                    }
                  }
                }
              }
            `,
            variables: { query: `sku:${variantSku}` }
          })
        }
      );

      if (!response.ok) {
        return null;
      }

      const resData = (await response.json()) as any;
      const edges = resData?.data?.inventoryItems?.edges || [];
      if (edges.length === 0) {
        return null;
      }

      const levels = edges[0].node.inventoryLevels?.edges || [];
      const matchedLevel = levels.find(
        (e: any) => e.node.location.id === shopifyLocationId
      );

      if (!matchedLevel) {
        return null;
      }

      return matchedLevel.node.quantities[0]?.quantity || 0;
    } catch (err) {
      Logger.error({
        message: "Failed to query Shopify stock level",
        variantSku
      }, err);
      return null;
    }
  }

  async runAudit(tenantId: string): Promise<{ shopifyDiscrepancies: number; accountingDiscrepancies: number }> {
    let shopifyCount = 0;
    let accountingCount = 0;

    // 1. Shopify stock level audit
    const storeDomain = process.env.SHOPIFY_SHOP_URL;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const shopifyLocationId = process.env.SHOPIFY_LOCATION_ID || "gid://shopify/Location/67890";

    if (storeDomain && accessToken) {
      // Find all variants in database
      const variants = await prisma.productVariantModel.findMany();

      // Aggregate local quantity for all variants across all locations upfront
      const inventoryAgg = await prisma.inventoryModel.groupBy({
        by: ['sku'],
        _sum: { quantity: true }
      });
      const localQtyMap = new Map(inventoryAgg.map((agg: any) => [agg.sku, agg._sum.quantity || 0]));

      // Fetch all open SHOPIFY_STOCK_MISMATCH discrepancies upfront
      const openDiscrepancies = await prisma.auditDiscrepancyModel.findMany({
        where: { tenantId, type: "SHOPIFY_STOCK_MISMATCH", status: "OPEN" },
        select: { referenceId: true }
      });
      const existingOpenSet = new Set(openDiscrepancies.map((d: any) => d.referenceId));

      const chunkedVariants = [];
      const chunkSize = 50;
      for (let i = 0; i < variants.length; i += chunkSize) {
        chunkedVariants.push(variants.slice(i, i + chunkSize));
      }

      const newDiscrepanciesData: any[] = [];

      await Promise.all(chunkedVariants.map(async (chunk) => {
        let shopifyData: Record<string, any> = {};

        if (accessToken !== "mock-token" && !storeDomain.includes("mock")) {
          const fetchedQty = await this.fetchShopifyQuantity(
            variant.sku,
            storeDomain,
            accessToken,
            shopifyLocationId
          );
          if (fetchedQty !== null) {
            shopifyQty = fetchedQty;
          }
        } else {
          // Mock mismatch scenario if variant SKU ends with -DIFF
          if (variant.sku.endsWith("-DIFF")) {
            shopifyQty = localQty + 10;
          }
        }

        // Process chunk results
        for (let i = 0; i < chunk.length; i++) {
          const variant = chunk[i];
          const localQty = localQtyMap.get(variant.sku) || 0;
          let shopifyQty = localQty;

          if (accessToken !== "mock-token" && !storeDomain.includes("mock")) {
            const variantData = shopifyData[`var${i}`];
            const edges = variantData?.edges || [];
            if (edges.length > 0) {
              const levels = edges[0].node.inventoryLevels?.edges || [];
              const matchedLevel = levels.find(
                (e: any) => e.node.location.id === shopifyLocationId
              );
              if (matchedLevel) {
                shopifyQty = matchedLevel.node.quantities[0]?.quantity || 0;
              }
            }
          } else {
            // Mock mismatch scenario if variant SKU ends with -DIFF
            if (variant.sku.endsWith("-DIFF")) {
              shopifyQty = Number(localQty) + 10;
            }
          }

          if (localQty !== shopifyQty) {
            const referenceId = `${variant.sku}:default`;

            if (!existingOpenSet.has(referenceId)) {
              newDiscrepanciesData.push({
                id: crypto.randomUUID(),
                tenantId,
                type: "SHOPIFY_STOCK_MISMATCH",
                referenceId,
                externalRefId: "mock-inventory-item-id",
                description: `Shopify stock mismatch for SKU ${variant.sku}. Local: ${localQty}, Shopify: ${shopifyQty}`
              });
            }
          }
        }
      }));

      if (newDiscrepanciesData.length > 0) {
        await prisma.auditDiscrepancyModel.createMany({
          data: newDiscrepanciesData
        });
        shopifyCount += newDiscrepanciesData.length;
      }
    }

    // 2. Accounting sync audit
    const hasQbo = !!process.env.QUICKBOOKS_ACCESS_TOKEN;
    const hasXero = !!process.env.XERO_ACCESS_TOKEN;
    const hasNetsuite = !!process.env.NETSUITE_ACCESS_TOKEN;

    if (hasQbo || hasXero || hasNetsuite) {
      // Fetch journal entries created in the last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const journals = await prisma.journalEntryModel.findMany({
        where: { tenantId, entryDate: { gte: sevenDaysAgo } }
      });

      if (journals.length > 0) {
        const journalIds = journals.map((j: any) => j.id);
        const mappedJournalIds = new Set<string>();

        if (hasQbo) {
          const qboMappings = await prisma.quickbooksJournalMappingModel.findMany({
            where: { journalEntryId: { in: journalIds } },
            select: { journalEntryId: true }
          });
          qboMappings.forEach((m: any) => mappedJournalIds.add(m.journalEntryId));
        }

        if (hasXero) {
          const xeroMappings = await prisma.xeroJournalMappingModel.findMany({
            where: { journalEntryId: { in: journalIds } },
            select: { journalEntryId: true }
          });
          xeroMappings.forEach((m: any) => mappedJournalIds.add(m.journalEntryId));
        }

        if (hasNetsuite) {
          const netsuiteMappings = await prisma.netsuiteJournalMappingModel.findMany({
            where: { journalEntryId: { in: journalIds } },
            select: { journalEntryId: true }
          });
          netsuiteMappings.forEach((m: any) => mappedJournalIds.add(m.journalEntryId));
        }

        const unmappedJournals = journals.filter((j: any) => !mappedJournalIds.has(j.id));

        if (unmappedJournals.length > 0) {
          const unmappedIds = unmappedJournals.map((j: any) => j.id);
          const existingDiscrepancies = await prisma.auditDiscrepancyModel.findMany({
            where: {
              tenantId,
              type: "ACCOUNTING_JOURNAL_MISSING",
              referenceId: { in: unmappedIds },
              status: "OPEN"
            },
            select: { referenceId: true }
          });
          const existingIds = new Set(existingDiscrepancies.map((d: any) => d.referenceId));

          const newDiscrepanciesData = unmappedJournals
            .filter((j: any) => !existingIds.has(j.id))
            .map((j: any) => ({
              id: crypto.randomUUID(),
              tenantId,
              type: "ACCOUNTING_JOURNAL_MISSING",
              referenceId: j.id,
              description: `Journal entry ${j.id} (${j.description || "No description"}) is not mapped to any external accounting transaction.`
            }));

          if (newDiscrepanciesData.length > 0) {
            await prisma.auditDiscrepancyModel.createMany({
              data: newDiscrepanciesData
            });
            accountingCount += newDiscrepanciesData.length;
          }
        }
      }
    }

    return { shopifyDiscrepancies: shopifyCount, accountingDiscrepancies: accountingCount };
  }

  async resolveDiscrepancy(tenantId: string, id: string, notes: string): Promise<boolean> {
    const discrepancy = await prisma.auditDiscrepancyModel.findFirst({
      where: { id, tenantId }
    });
    if (!discrepancy || discrepancy.status === "RESOLVED") return false;

    // Resolve in DB
    await prisma.auditDiscrepancyModel.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolutionNotes: notes
      }
    });

    // If type is Shopify mismatch, trigger stock level push to Shopify
    if (discrepancy.type === "SHOPIFY_STOCK_MISMATCH") {
      const parts = discrepancy.referenceId.split(":");
      const sku = parts[0];

      // Find the variant
      const variant = await prisma.productVariantModel.findUnique({
        where: { sku }
      });

      const storeDomain = process.env.SHOPIFY_SHOP_URL;
      const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
      const shopifyLocationId = process.env.SHOPIFY_LOCATION_ID || "gid://shopify/Location/67890";

      if (variant && storeDomain && accessToken && accessToken !== "mock-token" && !storeDomain.includes("mock")) {
        // Sum local stock levels
        const ledgerSum = await prisma.inventoryModel.aggregate({
          where: { sku: variant.sku },
          _sum: { quantity: true }
        });
        const localQty = ledgerSum._sum.quantity || 0;

        try {
          // Set quantity on Shopify
          await fetch(
            `https://${storeDomain}/admin/api/2024-04/graphql.json`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken
              },
              body: JSON.stringify({
                query: `
                  mutation setQty($input: InventorySetOnHandQuantitiesInput!) {
                    inventorySetOnHandQuantities(input: $input) {
                      userErrors { message }
                        }
                      }
                    `,
                variables: {
                  input: {
                    setQuantities: [
                      {
                        inventoryItemId: discrepancy.externalRefId,
                        locationId: shopifyLocationId,
                        quantity: localQty
                      }
                    ]
                  }
                }
              })
            }
          );
        } catch (err) {
          Logger.error({
            message: "Failed to resolve Shopify discrepancy by pushing correct stock",
            discrepancyId: id
          }, err);
        }
      }
    }

    return true;
  }
}
