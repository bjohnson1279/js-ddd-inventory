import os
import re
import sys

def fix_routes(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # fastify.get("/path", middleware, handler) -> fastify.get("/path", { preHandler: [middleware] }, handler)
    # The regex needs to capture the path, the middleware, and the handler.
    # Typical: fastify.post("/allocate", requireRole(["admin"]), InventoryController.allocate);
    # Regex: fastify\.(get|post|put|delete|patch)\((.*?),\s*(requireRole\(.*?\)|authMiddleware),\s*(.*?)\);
    
    pattern = r'fastify\.(get|post|put|delete|patch)\((.*?),\s*(requireRole\(.*?\)|requirePermission\(.*?\)|authMiddleware),\s*(.*?)\);'
    
    def repl(m):
        method = m.group(1)
        path = m.group(2)
        middleware = m.group(3)
        handler = m.group(4)
        return f'fastify.{method}({path}, {{ preHandler: [{middleware}] }}, {handler});'
        
    content = re.sub(pattern, repl, content)

    # Some routes might have multiple middlewares in express: router.post(path, mid1, mid2, handler) 
    # but the project seems to use one auth middleware per route mostly.

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {filepath}")

def scan_directory(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.ts') and 'routes' in root:
                fix_routes(os.path.join(root, file))

if __name__ == "__main__":
    scan_directory(sys.argv[1])
