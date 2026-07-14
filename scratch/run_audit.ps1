
$ErrorActionPreference = "Continue"
echo "--- npm run brand:generate ---" >> scratch\audit.log
npm run brand:generate 2>&1 >> scratch\audit.log
echo "--- npm run lint ---" >> scratch\audit.log
npm run lint 2>&1 >> scratch\audit.log
echo "--- npm run type-check ---" >> scratch\audit.log
npm run type-check 2>&1 >> scratch\audit.log
echo "--- npm run test ---" >> scratch\audit.log
npm run test 2>&1 >> scratch\audit.log
echo "--- npm run test:e2e ---" >> scratch\audit.log
npm run test:e2e 2>&1 >> scratch\audit.log
echo "--- npx prisma validate ---" >> scratch\audit.log
npx prisma validate 2>&1 >> scratch\audit.log
echo "--- npx prisma generate ---" >> scratch\audit.log
npx prisma generate 2>&1 >> scratch\audit.log
echo "--- npm run db:seed ---" >> scratch\audit.log
npm run db:seed 2>&1 >> scratch\audit.log
echo "--- PERX_DATA_MODE=database npm run build ---" >> scratch\audit.log
$env:PERX_DATA_MODE="database"
npm run build 2>&1 >> scratch\audit.log

