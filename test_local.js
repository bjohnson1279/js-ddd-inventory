const { Prisma } = require('@prisma/client');
const sql = Prisma.sql`SELECT * FROM users WHERE id = ${1}`;
console.log(sql);
