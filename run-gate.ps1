$ErrorActionPreference = "Continue"

Write-Output "--- npm run lint ---"
npm run lint

Write-Output "--- npm run type-check ---"
npm run type-check

Write-Output "--- npm run test ---"
npm run test

Write-Output "--- npm run test:e2e ---"
npm run test:e2e

Write-Output "--- npx prisma validate ---"
npx prisma validate

Write-Output "--- npx prisma generate ---"
npx prisma generate

Write-Output "--- npx prisma migrate status ---"
npx prisma migrate status

Write-Output "--- npm run db:seed ---"
npm run db:seed

Write-Output "--- npm run build:mock ---"
npm run build:mock

Write-Output "--- PERX_DATA_MODE=mock npm run build ---"
$env:PERX_DATA_MODE="mock"
npm run build

Write-Output "--- PERX_DATA_MODE=database npm run build ---"
$env:PERX_DATA_MODE="database"
npm run build

Write-Output "--- NODE_ENV=production PERX_DATA_MODE=mock npm run build ---"
$env:NODE_ENV="production"
$env:PERX_DATA_MODE="mock"
npm run build
