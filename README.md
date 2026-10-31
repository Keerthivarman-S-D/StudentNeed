# StudentNeed — Anna University Campus Marketplace

StudentNeed is a verified campus-only peer-to-peer exchange platform engineered for Anna University students (`@student.annauniv.edu`). Students can securely discover textbooks, lab supplies, hostel essentials, and electronics, initiate real-time peer chat, request reservations, and coordinate safe in-person campus meetups.

---

## 1. Prerequisites & GCP Environment

Ensure the following tools and APIs are enabled in your Google Cloud Project:

1. **Google Cloud SDK (`gcloud` CLI)** installed and authenticated.
2. **Node.js 20+** and `npm` installed.
3. Enable required Google Cloud services:
   ```bash
   gcloud services enable \
     run.googleapis.com \
     secretmanager.googleapis.com \
     firestore.googleapis.com \
     identitytoolkit.googleapis.com
   ```

---

## 2. Secret Management Setup

Sensitive operational credentials and API tokens are dynamically managed via Google Cloud Secret Manager.

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Create and populate the secret for Gemini API
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Provision Resend API Key in Secret Manager
gcloud secrets create RESEND_API_KEY --replication-policy="automatic"
echo -n "YOUR_RESEND_API_KEY" | gcloud secrets versions add RESEND_API_KEY --data-file=-

# Grant the default Cloud Run service account access to read the secrets
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding RESEND_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Cloud Firestore Security Rules Configuration

Deploy the locked-down security rules supporting user data isolation and role boundaries:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    function isAuthenticated() {
      return request.auth != null;
    }

    function isInternalSystem() {
      return request.auth != null && 
        (request.auth.token.email == 'internal.system@student.annauniv.edu' ||
         request.auth.token.firebase.identities['email'][0] == 'internal.system@student.annauniv.edu');
    }

    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create, update: if isAuthenticated() && request.auth.uid == userId;
      allow delete: if false;
    }

    match /listings/{listingId} {
      allow read: if true;
      allow create: if isAuthenticated() && request.resource.data.sellerId == request.auth.uid;
      allow update: if isAuthenticated() && (
        resource.data.sellerId == request.auth.uid ||
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'updatedAt'])
      );
      allow delete: if isAuthenticated() && resource.data.sellerId == request.auth.uid;
    }

    match /chats/{chatId} {
      allow read: if isAuthenticated() && request.auth.uid in resource.data.participants;
      allow create: if isAuthenticated() && 
        request.auth.uid in request.resource.data.participants &&
        request.resource.data.participants.size() == 2 &&
        request.resource.data.participants[0] != request.resource.data.participants[1];
      allow update: if isAuthenticated() && request.auth.uid in resource.data.participants;
      allow delete: if false;

      match /messages/{messageId} {
        allow read: if isAuthenticated() && request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
        allow create: if isAuthenticated() && 
          request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants &&
          request.resource.data.senderId == request.auth.uid;
        allow update, delete: if false;
      }
    }

    match /reservations/{reservationId} {
      function isBuyer() { return request.auth.uid == resource.data.buyerId; }
      function isSeller() { return request.auth.uid == resource.data.sellerId; }

      allow read: if isAuthenticated() && (
        resource.data.buyerId == request.auth.uid ||
        resource.data.sellerId == request.auth.uid ||
        request.auth.uid == get(/databases/$(database)/documents/listings/$(resource.data.listingId)).data.sellerId
      );

      allow create: if isAuthenticated() &&
        request.resource.data.buyerId == request.auth.uid &&
        request.resource.data.sellerId != request.auth.uid &&
        request.resource.data.status == 'pending';

      allow update: if isAuthenticated() && (
        (isSeller() && resource.data.status == 'pending' && (request.resource.data.status == 'accepted' || request.resource.data.status == 'rejected') && request.resource.data.buyerId == resource.data.buyerId && request.resource.data.sellerId == resource.data.sellerId && request.resource.data.listingId == resource.data.listingId) ||
        (isBuyer() && resource.data.status == 'rejected' && request.resource.data.status == 'pending' && request.resource.data.buyerId == resource.data.buyerId && request.resource.data.sellerId == resource.data.sellerId && request.resource.data.listingId == resource.data.listingId) ||
        ((isBuyer() || isSeller()) && resource.data.status == 'accepted' && (request.resource.data.status == 'completed' || request.resource.data.status == 'cancelled') && request.resource.data.buyerId == resource.data.buyerId && request.resource.data.sellerId == resource.data.sellerId && request.resource.data.listingId == resource.data.listingId) ||
        ((isBuyer() || isSeller()) && resource.data.status == 'accepted' && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['meetup', 'updatedAt']) && request.resource.data.buyerId == resource.data.buyerId && request.resource.data.sellerId == resource.data.sellerId && request.resource.data.listingId == resource.data.listingId)
      );

      allow delete: if false;
    }

    match /temp_otps/{hashId} {
      allow read, write: if isInternalSystem();
    }
  }
}
```

Deploy the rules via Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 4. Google Cloud Run Deployment

Build and deploy the application container to Google Cloud Run:

```bash
# Build and deploy service
gcloud run deploy studentneed-app \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars NODE_ENV=production,COLLEGE_EMAIL_DOMAIN=@student.annauniv.edu,EMAIL_FROM="StudentNeed <studentneed.info@gmail.com>" \
  --set-secrets RESEND_API_KEY=RESEND_API_KEY:latest
```

---

## 5. Required Campaign Verification Binding

Apply the mandatory verification resource label for automated campaign compliance:

```bash
gcloud run services update studentneed-app \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 6. Local Development

```bash
# Install dependencies
npm install

# Run unified full-stack server
npm run dev

# Build production bundle
npm run build
```
