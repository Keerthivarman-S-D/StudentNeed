# StudentNeed — Hybrid Spark-Compatible Build

StudentNeed is a campus-only peer-to-peer marketplace for Anna University students (`@student.annauniv.edu`). This build keeps the newer marketplace UI and feature work while using the independent Express backend pattern from the earlier working project.

## Architecture

- **Frontend:** React + Vite, deployed as static files to Firebase Hosting.
- **Authentication:** Firebase Authentication email/password (Spark-compatible), with the existing server-side college-email OTP verification flow.
- **Database:** Existing Cloud Firestore database and the security rules in `firestore.rules`.
- **API:** Standalone Express backend (`server.ts`) deployed separately to Render or another independently hosted Node.js service.
- **Email:** Resend for OTP and password-reset email; keep the API key only in the backend environment.
- **Images:** Existing Cloudinary integration; configure credentials only if image uploads are enabled.

This project does **not** deploy Firebase Cloud Functions and does not require `firebase-functions` or `firebase-admin` in the root application. Firebase Hosting serves the frontend only. The frontend calls the Express API using `VITE_API_URL`.

## Free-plan notes

- Firebase email/password Authentication is available on the Firebase Spark plan.
- Firebase Hosting and Cloud Firestore have free quotas and usage limits. Firestore's free quota applies to exactly one database per Firebase project; the first database created qualifies, regardless of its ID. Confirm that the configured `firestoreDatabaseId` is that free-eligible database before relying on Spark-only operation.
- Firebase Cloud Functions are intentionally not used because deployment requires Blaze billing.
- Render's free web services may sleep when idle and have resource limits. Resend and Cloudinary also have their own free-tier quotas. No external free tier is unlimited or guaranteed to remain unchanged.

## Prerequisites

- Node.js 20 or newer and npm.
- Firebase CLI (`npm install -g firebase-tools`).
- Existing Firebase project with Email/Password provider enabled.
- Existing Firestore database and Firebase project configuration in `firebase-applet-config.json`.
- Resend account/API key for sending OTP emails.

## Local development

```bash
npm ci
cp .env.example .env
npm run dev
```

The development server runs Express and Vite together. Local API calls use same-origin routes.

## Build and checks

```bash
npm run lint
npm run build
npm run test:hybrid
```

`npm run build` creates the frontend in `dist/`, bundles the Express backend in `dist-server/server.cjs`, and checks that backend artifacts are not published through Firebase Hosting.

## Deploy the Express backend

Create a Render Web Service from this repository:

- Runtime: Node
- Build command: `npm ci && npm run build`
- Start command: `npm start`

Set backend environment variables in Render's dashboard (never commit real values):

- `NODE_ENV=production`
- `FRONTEND_URL=https://studentneed.me`
- `RESEND_API_KEY` — your Resend key
- `INTERNAL_SYSTEM_EMAIL=internal.system@student.annauniv.edu`
- `INTERNAL_SYSTEM_PASSWORD` — password for the dedicated internal system Firebase Auth account
- `ADMIN_EMAIL=admin@student.annauniv.edu`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — if image uploads are used
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — if web push is used

The internal system account is used by the Express backend for its Firestore REST operations. Keep its credentials private, use a strong unique password, and do not use a personal student account for this purpose.

After deployment, copy the Render service URL, for example `https://your-service.onrender.com`.

## Deploy the frontend to Firebase Hosting

Set the frontend build variable `VITE_API_URL` to the actual deployed Express backend URL and `VITE_COLLEGE_EMAIL_DOMAIN=student.annauniv.edu`.

```bash
npm ci
npm run build:client
firebase deploy --only hosting
```

For a local production build, put those two `VITE_` values in `.env.production` before running `npm run build:client`. The checked-in `.env.production` uses the previous Render service URL as a fallback; replace it if your actual backend URL differs.

## Firebase setup

1. In Firebase Console → Authentication → Sign-in method, enable **Email/Password**.
2. Confirm that `firebase-applet-config.json` points to the intended Firebase project and Firestore database.
3. Confirm the configured Firestore database is the project's one free-eligible database if remaining on Spark.
4. Deploy the repository's current security rules and indexes when you are ready:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Do not replace the repository's security rules with permissive sample rules. Review the existing data model and rules before deployment.

## Important migration notes

- The new project's UI, marketplace pages, validation, onboarding, cross-tab synchronization, and security improvements are retained.
- The frontend still uses Firebase Authentication (`signInWithEmailAndPassword`, `onAuthStateChanged`) for user sessions.
- OTP creation/verification and account finalization remain server-side in `server.ts`.
- The Firebase Hosting config no longer declares Cloud Functions or rewrites `/api/**` to a function.
- The API client uses `VITE_API_URL` and retains the former Render backend URL as a fallback. Change it to your real backend URL before production deployment.
- Existing Firebase project data is not migrated or deleted by this source-code change.
