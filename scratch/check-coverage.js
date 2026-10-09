const fs = require('fs');
const endpointsData = JSON.parse(fs.readFileSync('scratch/all-endpoints.json', 'utf8'));

const testFiles = [
  'scratch/test-all-17-modules.ts',
  'scratch/test-crud-mutations.ts',
  'scratch/test-full-api-flow.ts'
];

let allTestCode = '';
testFiles.forEach(f => {
  if (fs.existsSync(f)) allTestCode += fs.readFileSync(f, 'utf8') + '\n';
});

let testedCount = 0;
let untestedCount = 0;
const untestedList = [];
const testedList = [];

for (const [file, info] of Object.entries(endpointsData.results)) {
  info.list.forEach(e => {
    // Check if path or prefix pattern is called in test files
    const parts = e.fullPath.split('/').filter(Boolean);
    const firstPart = parts[0] || '';
    const hasCall = allTestCode.includes('/' + e.basePath) || (parts.length > 1 && allTestCode.includes(parts[1]));
    
    // Exact method + path check
    const cleanPattern = '/' + parts.filter(p => !p.startsWith(':')).join('/');
    const methodCall = e.method.toLowerCase() + '(`' + cleanPattern;
    const methodCall2 = e.method.toLowerCase() + "('" + cleanPattern;
    const methodCall3 = e.method.toLowerCase() + '("/' + e.basePath;

    if (allTestCode.includes(cleanPattern) || allTestCode.includes('/' + e.basePath)) {
      // rough check
    }
  });
}
