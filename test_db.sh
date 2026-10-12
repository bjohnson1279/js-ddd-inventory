#!/bin/bash
docker-compose down
docker-compose up -d postgres
sleep 15
pnpm prisma db push
pnpm test
