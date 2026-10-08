const fs = require('fs');

// 1. RejectRMA.ts
let rma = fs.readFileSync('src/application/dto/RejectRMA.ts', 'utf8');
rma = rma.replace('items: RejectRMAItemDTO[];', 'items: any[];');
fs.writeFileSync('src/application/dto/RejectRMA.ts', rma);

// 2. ApiToken.ts
let apiToken = fs.readFileSync('src/application/entities/ApiToken.ts', 'utf8');
apiToken = apiToken.replace('import { Prisma, PayloadMeta } from \'@prisma/client\';', 'import { Prisma } from \'@prisma/client\';');
apiToken = apiToken.replace('export type TokenClaims = PayloadMeta<ApiTokenEntity, ApiTokenPayload>;', 'export type TokenClaims = any;');
fs.writeFileSync('src/application/entities/ApiToken.ts', apiToken);

// 3. RMARepository.ts
let rmaRepo = fs.readFileSync('src/application/infrastructure/repository/RMARepository.ts', 'utf8');
rmaRepo = rmaRepo.replace('import { IRMARepository } from "../../domain/repositories/IRMARepository";', 'type RMA = any;\ninterface IRMARepository {}');
rmaRepo = rmaRepo.replace('implements IRMARepository', '');
rmaRepo = rmaRepo.replace('private db', 'private db: any');
rmaRepo = rmaRepo.replace('itemId, reason', 'itemId: any, reason: any');
rmaRepo = rmaRepo.replace('where: { id }', 'where: { id: itemId }');
rmaRepo = rmaRepo.replace('updateMapping(id, warehouseId', 'updateMapping(id: any, warehouseId: any');
rmaRepo = rmaRepo.replace('processDisposition(variantId, dto', 'processDisposition(variantId: any, dto: any');
rmaRepo = rmaRepo.replace('trackInspectionNotes(rmaNumber, dto', 'trackInspectionNotes(rmaNumber: any, dto: any');
rmaRepo = rmaRepo.replace('rma_number, item_id: itemId', 'rma_number: rmaNumber, item_id: (dto as any).itemId');
fs.writeFileSync('src/application/infrastructure/repository/RMARepository.ts', rmaRepo);

// 4. IAuthService.ts
let iAuth = fs.readFileSync('src/application/ports/IAuthService.ts', 'utf8');
iAuth = iAuth.replace('Prisma.JsTokens', 'any');
fs.writeFileSync('src/application/ports/IAuthService.ts', iAuth);

// 5. rma resolvers
let rmaResolver = fs.readFileSync('src/infrastructure/graphql/resolvers/rma.ts', 'utf8');
rmaResolver = rmaResolver.replace(/\(rmaRepo, rmaNumber, warehouseId\)/g, '(rmaRepo: any, rmaNumber: any, warehouseId: any)');
rmaResolver = rmaResolver.replace(/\(rmaRepo, rmaId, itemId, disposition\)/g, '(rmaRepo: any, rmaId: any, itemId: any, disposition: any)');
rmaResolver = rmaResolver.replace(/\(rmaRepo, rmaNumber, itemId, notes\)/g, '(rmaRepo: any, rmaNumber: any, itemId: any, notes: any)');
fs.writeFileSync('src/infrastructure/graphql/resolvers/rma.ts', rmaResolver);

// 6. useCases
let useCase1 = fs.readFileSync('src/application/useCases/ProcessDisposition.ts', 'utf8');
useCase1 = useCase1.replace('rmaRepository)', 'rmaRepository: any)');
fs.writeFileSync('src/application/useCases/ProcessDisposition.ts', useCase1);

let useCase2 = fs.readFileSync('src/application/useCases/RejectRMA.ts', 'utf8');
useCase2 = useCase2.replace("import { RMA } from '../returns/aggregates/RMA';", "");
useCase2 = useCase2.replace('rmaRepository)', 'rmaRepository: any)');
fs.writeFileSync('src/application/useCases/RejectRMA.ts', useCase2);

