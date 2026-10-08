import os
import re

def fix_all(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.ts'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                original = content
                
                # replace .json( with .send(
                content = content.replace('.json(', '.send(')
                
                # fastify preHandler type expects `(request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => void`
                # Let's import HookHandlerDoneFunction from fastify
                if 'export function authMiddleware' in content:
                    content = content.replace('next: () => void', 'next: () => void') # Actually `done` can just be typed as any or we leave it.

                if content != original:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"Fixed .json -> .send in {filepath}")

if __name__ == "__main__":
    fix_all(r"c:\Users\johns\DEV\inventory\js-ddd-inventory\src")
