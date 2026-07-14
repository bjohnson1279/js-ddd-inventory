const fs = require('fs');

const file = '.jules/bolt.md';
let content = fs.readFileSync(file, 'utf8');

content += `\n## 2024-07-13 - [Optimize N+1 query and Race Condition in ReceivePurchaseOrder]
**Learning:** In \`ReceivePurchaseOrder.ts\`, the loop \`await Promise.all(dto.items.map(async (item) => {...}))\` executed individual \`receiveStock.execute(...)\` which internally checked the database \`this.inventoryRepository.findBySku\` and performed individual \`this.inventoryRepository.save(item)\`. Not only does this produce N+1 queries when receiving POs with large numbers of distinct variants, but due to \`Promise.all\`, concurrent modifications to the same SKU across different PO items could trigger a concurrency exception because \`save\` relies on the optimistic locking version number.
**Action:** Batched fetched inventory items beforehand into a \`Map\` cache to avoid N+1 DB lookups. Removed \`Promise.all\` on item iteration, replacing it with a sequential loop processing in-memory items to avoid race conditions. Finally batched \`saveMany\` for all modified inventory entities, minimizing DB transactions.
`;

fs.writeFileSync(file, content);
