import os
import re

files_to_fix = [
    r"c:\Users\johns\DEV\inventory\js-ddd-inventory\src\infrastructure\http\routes\supplier.routes.ts",
    r"c:\Users\johns\DEV\inventory\js-ddd-inventory\src\infrastructure\http\routes\supplierPortal.routes.ts",
    r"c:\Users\johns\DEV\inventory\js-ddd-inventory\src\infrastructure\http\routes\intercompany.routes.ts",
    r"c:\Users\johns\DEV\inventory\js-ddd-inventory\src\infrastructure\http\routes\notification.routes.ts",
    r"c:\Users\johns\DEV\inventory\js-ddd-inventory\src\infrastructure\http\routes\cycleCount.routes.ts"
]

for filepath in files_to_fix:
    if not os.path.exists(filepath): continue
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    content = re.sub(r'import \{.*?\} from "express";', 'import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";', content)
    content = content.replace("export const supplierRouter", "export const supplierRouter: FastifyPluginAsync = async (fastify) => {} // TODO")
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Fixed {filepath}")
