import fs from 'fs';
import path from 'path';

const root = process.cwd();
const server = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
const authContext = fs.readFileSync(path.join(root, 'src/context/AuthContext.tsx'), 'utf8');
const login = fs.readFileSync(path.join(root, 'src/pages/Login.tsx'), 'utf8');
const onboarding = fs.readFileSync(path.join(root, 'src/pages/Onboarding.tsx'), 'utf8');
const firebase = fs.readFileSync(path.join(root, 'src/lib/firebaseAuth.ts'), 'utf8');
const firebaseJson = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const checks: [string, boolean][] = [
  ['Standalone Express backend retains OTP send endpoint', server.includes('/api/auth/send-otp')],
  ['Standalone Express backend retains OTP verification endpoint', server.includes('/api/auth/verify-otp')],
  ['Standalone Express backend retains account creation endpoint', server.includes('/api/auth/create-account')],
  ['Standalone Express backend retains account finalization endpoint', server.includes('/api/auth/finalize-account')],
  ['OTP values are hashed with bcrypt', server.includes('bcrypt.hash') && server.includes('bcrypt.compare')],
  ['OTP registration tokens are generated server-side', server.includes('registrationToken = crypto.randomBytes')],
  ['Frontend continues using Firebase email/password sign-in', login.includes('signInWithEmailAndPassword') && onboarding.includes('signInWithEmailAndPassword')],
  ['Firebase Auth client remains initialized', firebase.includes('getAuth(app)')],
  ['Auth state remains driven by Firebase onAuthStateChanged', authContext.includes('onAuthStateChanged')],
  ['Cloud Functions are not configured for Firebase deployment', !firebaseJson.functions && !firebaseJson.hosting.rewrites.some((r: any) => r.function)],
  ['Cloud Functions dependencies removed from root package', !pkg.dependencies['firebase-functions'] && !pkg.dependencies['firebase-admin']],
  ['Standalone Google Auth library is an explicit backend dependency', Boolean(pkg.dependencies['google-auth-library'])],
  ['Firebase Firestore rules remain in project', fs.existsSync(path.join(root, 'firestore.rules'))],
];

let failures = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) failures++;
}
console.log(`\nHybrid architecture checks: ${checks.length - failures}/${checks.length} passed.`);
if (failures) process.exit(1);
