const fs = require('fs');
const path = require('path');

const controllers = [
  'src/auth/auth.controller.ts',
  'src/brands/brands.controller.ts',
  'src/categories/categories.controller.ts',
  'src/customer-orders/customer-orders.controller.ts',
  'src/customer-orders/telegram/telegram-webhook.controller.ts',
  'src/mails/mails.controller.ts',
  'src/menu/menu.controller.ts',
  'src/permissions/permissions.controller.ts',
  'src/product-variants/product-variants.controller.ts',
  'src/products/products.controller.ts',
  'src/reports/reports.controller.ts',
  'src/requests/requests.controller.ts',
  'src/roles/roles.controller.ts',
  'src/stock/stock.controller.ts',
  'src/stock-adjustments/stock-adjustments.controller.ts',
  'src/suppliers/suppliers.controller.ts',
  'src/users/users.controller.ts',
  'src/warehouses/warehouses.controller.ts'
];

let totalEndpoints = 0;
const results = {};

controllers.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const baseMatch = content.match(/@Controller\(['"]?(.*?)['"]?\)/);
  const basePath = baseMatch ? baseMatch[1] : '';
  const list = [];
  
  // Regex to match decorators like @Get('path'), @Post(), etc.
  const regex = /@(Get|Post|Patch|Put|Delete)\s*\(\s*(?:['"`](.*?)['"`])?\s*\)[\s\S]*?(?:async\s+)?(\w+)\s*\(/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const subPath = match[2] || '';
    const fnName = match[3];
    let fullPath = ('/' + basePath + '/' + subPath).replace(/\/+/g, '/').replace(/\/$/, '');
    if (!fullPath) fullPath = '/';
    list.push({ method, fullPath, fnName });
    totalEndpoints++;
  }
  results[file] = { basePath, list };
});

fs.writeFileSync(
  path.join(__dirname, 'all-endpoints.json'),
  JSON.stringify({ totalEndpoints, results }, null, 2),
  'utf8'
);
console.log('Saved all endpoints to scratch/all-endpoints.json');
console.log('TOTAL ENDPOINTS FOUND:', totalEndpoints);

