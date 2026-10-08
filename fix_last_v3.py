import re

def fix_index():
    with open('src/index.ts', 'r', encoding='utf-8') as f:
        c = f.read()

    # Fix requireRole / requirePermission routing middleware
    c = re.sub(
        r'(app\.(?:get|post|put|delete|patch))\(([^,]+),\s*requireRole\(([^)]+)\),\s*(async\s+)?\(request',
        r'\1(\2, { preHandler: [requireRole(\3) as any] }, \4(request',
        c
    )
    c = re.sub(
        r'(app\.(?:get|post|put|delete|patch))\(([^,]+),\s*requirePermission\(([^)]+)\),\s*(async\s+)?\(request',
        r'\1(\2, { preHandler: [requirePermission(\3) as any] }, \4(request',
        c
    )
    c = re.sub(
        r'(app\.(?:get|post|put|delete|patch))\(([^,]+),\s*requirePermission\(([^)]+)\),\s*requireRole\(([^)]+)\),\s*(async\s+)?\(request',
        r'\1(\2, { preHandler: [requirePermission(\3) as any, requireRole(\4) as any] }, \5(request',
        c
    )

    c = c.replace('app["productRepository"]', '(app as any).productRepository')
    c = c.replace('app["warehouseLocationRepository"]', '(app as any).warehouseLocationRepository')

    with open('src/index.ts', 'w', encoding='utf-8') as f:
        f.write(c)

def fix_notification():
    with open('src/infrastructure/http/controllers/NotificationController.ts', 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace('client.write(', 'client.raw.write(')
    with open('src/infrastructure/http/controllers/NotificationController.ts', 'w', encoding='utf-8') as f:
        f.write(c)

def fix_services():
    import glob
    for p in glob.glob('src/domain/services/*.ts'):
        with open(p, 'r', encoding='utf-8') as f:
            c = f.read()
        c = re.sub(r'import\s+\{\s*Response\s*\}\s+from\s+[\'"]express[\'"];?', '', c)
        c = re.sub(r':\s*Response', ': any', c)
        with open(p, 'w', encoding='utf-8') as f:
            f.write(c)

def fix_rma():
    with open('src/infrastructure/graphql/resolvers/rma.ts', 'r', encoding='utf-8') as f:
        c = f.read()
    # just cast all args to any
    c = re.sub(r'\(rmaRepo, rmaNumber, warehouseId\)', '(rmaRepo: any, rmaNumber: any, warehouseId: any)', c)
    c = re.sub(r'\(rmaRepo, rmaId, itemId, disposition\)', '(rmaRepo: any, rmaId: any, itemId: any, disposition: any)', c)
    c = re.sub(r'\(rmaRepo, rmaNumber, itemId, notes\)', '(rmaRepo: any, rmaNumber: any, itemId: any, notes: any)', c)
    with open('src/infrastructure/graphql/resolvers/rma.ts', 'w', encoding='utf-8') as f:
        f.write(c)

def fix_rma_repo():
    with open('src/application/infrastructure/repository/RMARepository.ts', 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace('rma_number:', 'rmaNumber:')
    with open('src/application/infrastructure/repository/RMARepository.ts', 'w', encoding='utf-8') as f:
        f.write(c)

fix_index()
fix_notification()
fix_services()
fix_rma()
fix_rma_repo()
