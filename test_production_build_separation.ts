import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`PASS: ${testName}`);
    passed++;
  } else {
    console.error(`FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

console.log('\n--- Running StudentNeed Production Build Separation & Security Tests ---\n');

// 1. Verify package.json build script separation
{
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
  assert(pkg.scripts['build:client'] === 'vite build', 'package.json defines separate build:client script');
  assert(
    pkg.scripts['build:server'].includes('dist-server/server.cjs'),
    'package.json outputs backend server to dist-server/server.cjs'
  );
  assert(
    !pkg.scripts['build:server'].includes('--outfile=dist/server.cjs'),
    'package.json build:server does NOT output to public dist/ directory'
  );
  assert(
    pkg.scripts['start'].includes('dist-server/server.cjs'),
    'package.json start command runs backend from dist-server/server.cjs'
  );
  assert(
    pkg.scripts['build'].includes('check:deploy'),
    'package.json build command runs deployment verification check'
  );
}

// 2. Verify firebase.json security configuration
{
  const fbJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase.json'), 'utf-8'));
  const ignore = fbJson.hosting?.ignore || [];
  assert(ignore.includes('**/*.cjs'), 'firebase.json ignore includes **/*.cjs');
  assert(ignore.includes('**/*.map'), 'firebase.json ignore includes **/*.map');
  assert(ignore.includes('**/server.*'), 'firebase.json ignore includes **/server.*');
  assert(ignore.includes('**/dist-server/**'), 'firebase.json ignore includes **/dist-server/**');

  const rewrites = fbJson.hosting?.rewrites || [];
  assert(
    rewrites.some((rw: any) => rw.source === '!/api/**' && rw.destination === '/index.html'),
    'firebase.json rewrites excludes /api/** so backend requests never route to index.html'
  );
}

// 3. Verify scripts/verify-deploy.ts exists
{
  assert(
    fs.existsSync(path.join(process.cwd(), 'scripts/verify-deploy.ts')),
    'scripts/verify-deploy.ts exists to guard production deployments'
  );
}

console.log(`\nBuild Separation Tests Completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
