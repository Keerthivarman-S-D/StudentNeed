import fs from 'fs';
import path from 'path';

function verifyDeploymentArtifacts() {
  console.log('\n--- Verifying Production Deployment Artifacts & Build Separation ---\n');

  const distDir = path.join(process.cwd(), 'dist');
  const serverDistDir = path.join(process.cwd(), 'dist-server');

  // 1. Verify frontend build output in dist/
  if (!fs.existsSync(distDir)) {
    console.error('FAIL: Frontend dist/ directory does not exist.');
    process.exit(1);
  }

  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('FAIL: Frontend dist/index.html does not exist.');
    process.exit(1);
  }
  console.log('PASS: Frontend dist/index.html exists.');

  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir) || fs.readdirSync(assetsDir).length === 0) {
    console.error('FAIL: Frontend dist/assets/ directory is missing or empty.');
    process.exit(1);
  }
  console.log('PASS: Frontend dist/assets/ contains compiled production assets.');

  // 2. Strict audit: Ensure NO backend server artifacts exist in dist/ (the Firebase Hosting public directory)
  const forbiddenPatterns = [
    'server.cjs',
    'server.cjs.map',
    'server.js',
    'server.js.map',
    'server.ts',
  ];

  const distFiles = fs.readdirSync(distDir);
  for (const forbidden of forbiddenPatterns) {
    if (distFiles.includes(forbidden)) {
      console.error(`CRITICAL SECURITY FAILURE: Forbidden backend artifact "${forbidden}" was found in dist/!`);
      console.error('Firebase Hosting would accidentally publish backend code/maps. Aborting build.');
      process.exit(1);
    }
  }

  // Also verify no .cjs or server map files recursively in dist/
  const checkForbiddenRecursive = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        checkForbiddenRecursive(fullPath);
      } else {
        if (entry.name.endsWith('.cjs') || entry.name.startsWith('server.')) {
          console.error(`CRITICAL SECURITY FAILURE: Forbidden backend file "${entry.name}" found at ${fullPath}`);
          process.exit(1);
        }
      }
    }
  };
  checkForbiddenRecursive(distDir);
  console.log('PASS: Verified zero backend server bundles or source maps in frontend public dist/ directory.');

  // 3. Verify backend build output in dist-server/
  if (!fs.existsSync(serverDistDir)) {
    console.error('FAIL: Backend dist-server/ directory does not exist.');
    process.exit(1);
  }

  const serverBundlePath = path.join(serverDistDir, 'server.cjs');
  if (!fs.existsSync(serverBundlePath)) {
    console.error('FAIL: Backend dist-server/server.cjs does not exist.');
    process.exit(1);
  }
  const stat = fs.statSync(serverBundlePath);
  if (stat.size < 10000) {
    console.error(`FAIL: Backend dist-server/server.cjs appears truncated (${stat.size} bytes).`);
    process.exit(1);
  }
  console.log(`PASS: Backend dist-server/server.cjs compiled successfully (${(stat.size / 1024).toFixed(1)} KB).`);

  // 4. Verify firebase.json ignores server artifacts
  const firebaseJsonPath = path.join(process.cwd(), 'firebase.json');
  if (fs.existsSync(firebaseJsonPath)) {
    const firebaseJson = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf-8'));
    const ignoreList = firebaseJson.hosting?.ignore || [];
    const hasCjsIgnore = ignoreList.some((pattern: string) => pattern.includes('.cjs'));
    const hasMapIgnore = ignoreList.some((pattern: string) => pattern.includes('.map'));
    const hasServerIgnore = ignoreList.some((pattern: string) => pattern.includes('server'));

    if (!hasCjsIgnore || !hasMapIgnore || !hasServerIgnore) {
      console.error('FAIL: firebase.json hosting.ignore missing defense-in-depth rules for server artifacts.');
      process.exit(1);
    }
    console.log('PASS: firebase.json hosting.ignore correctly blocks .cjs, .map, and server files.');

    const rewrites = firebaseJson.hosting?.rewrites || [];
    const hasSpaFallback = rewrites.some((rw: any) => rw.source === '!/api/**' && rw.destination === '/index.html');
    if (!hasSpaFallback) {
      console.error('FAIL: Firebase Hosting must retain the SPA fallback while the API is served by the independent Express backend.');
      process.exit(1);
    }
    const hasFunctions = Boolean(firebaseJson.functions && firebaseJson.functions.length);
    if (hasFunctions || rewrites.some((rw: any) => rw.function)) {
      console.error('FAIL: This Spark-compatible build must not deploy or route through Firebase Cloud Functions.');
      process.exit(1);
    }
    console.log('PASS: Firebase Hosting serves static assets only; API is configured as an independent backend.');
  }

  console.log('\n===============================================================');
  console.log('--- ALL PRODUCTION DEPLOYMENT INTEGRITY CHECKS PASSED ---');
  console.log('===============================================================\n');
}

verifyDeploymentArtifacts();
