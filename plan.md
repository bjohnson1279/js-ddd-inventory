1. Import `RMAModel` and `RMAItemModel` from `@prisma/client` in `src/infrastructure/database/PrismaRMARepository.ts`.
2. Define a type or use inline type `RMAModel & { items: RMAItemModel[] }` for `record` in `mapToDomain`.
3. Use `RMAItemModel` for `item` in the map function inside `mapToDomain`.
4. Verify tests and compilation.
