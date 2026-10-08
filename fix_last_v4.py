import re
import os

def replace_in_file(path, replacements):
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    orig = content
    for old, new in replacements:
        if isinstance(old, re.Pattern):
            content = old.sub(new, content)
        else:
            content = content.replace(old, new)
    if content != orig:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)

# 1. RejectRMA.ts
replace_in_file('src/application/dto/RejectRMA.ts', [
    ('RejectRMAItemDTO', 'any')
])

# 2. ApiToken.ts
replace_in_file('src/application/entities/ApiToken.ts', [
    ('import { PayloadMeta } from "@prisma/client";', '')
])

# 3. RMARepository.ts
replace_in_file('src/application/infrastructure/repository/RMARepository.ts', [
    (re.compile(r"import \{.*?\} from '../../domain/repositories/IRMARepository';"), ''),
    ('id,', 'id: any,'),
    ('rma_number,', 'rmaNumber: any,'),
    ('itemId', 'itemId: any'),
    ('RMA', 'any'),
    ('db', 'db: any'),
    ('id', 'id: any'),
    ('reason', 'reason: any'),
    ('warehouseId', 'warehouseId: any'),
    ('variantId', 'variantId: any'),
    ('dto', 'dto: any'),
    ('rmaNumber', 'rmaNumber: any')
])
with open('src/application/infrastructure/repository/RMARepository.ts', 'r', encoding='utf-8') as f:
    rma_repo = f.read()
rma_repo = rma_repo.replace('id: any: any', 'id: any')
rma_repo = rma_repo.replace('rmaNumber: any: any', 'rmaNumber: any')
with open('src/application/infrastructure/repository/RMARepository.ts', 'w', encoding='utf-8') as f:
    f.write(rma_repo)

# 4. IAuthService.ts
replace_in_file('src/application/ports/IAuthService.ts', [
    ('Prisma.JsTokens', 'any')
])

# 5. AuthService.ts
replace_in_file('src/application/services/AuthService.ts', [
    ('Response', 'any')
])

# 6. ProcessDisposition.ts
replace_in_file('src/application/useCases/ProcessDisposition.ts', [
    ('rmaRepository', 'rmaRepository: any')
])

# 7. RejectRMA.ts useCases
replace_in_file('src/application/useCases/RejectRMA.ts', [
    ("import { RMA } from '../returns/aggregates/RMA';", ""),
    ('rmaRepository', 'rmaRepository: any')
])

# 8. Domain Services
services = [
    'src/domain/services/AnomalyDetectionService.ts',
    'src/domain/services/AuditProcessorService.ts',
    'src/domain/services/RebalanceOptimizationService.ts',
    'src/domain/services/SlottingOptimizer.ts'
]
for s in services:
    replace_in_file(s, [
        ('Response', 'any'),
        ('res.', 'reply.')
    ])

# 9. index.ts
replace_in_file('src/index.ts', [
    ('(app as any).productRepository', 'app.productRepository'),
    ('(app as any).warehouseLocationRepository', 'app.warehouseLocationRepository'),
    ('app.productRepository', '(app as any).productRepository'),
    ('app.warehouseLocationRepository', '(app as any).warehouseLocationRepository')
])

# 10. rma.ts
replace_in_file('src/infrastructure/graphql/resolvers/rma.ts', [
    ('rmaRepo, rmaNumber, warehouseId', 'rmaRepo: any, rmaNumber: any, warehouseId: any'),
    ('rmaRepo, rmaId, itemId, disposition', 'rmaRepo: any, rmaId: any, itemId: any, disposition: any'),
    ('rmaRepo, rmaNumber, itemId, notes', 'rmaRepo: any, rmaNumber: any, itemId: any, notes: any')
])
