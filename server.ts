import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import helmet from "helmet";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { GoogleAuth } from "google-auth-library";
import * as webpush from "web-push";
import { generateGenUIPayload } from "./src/lib/genuiEngine";
import { validateGenUIPayload } from "./src/lib/genuiValidator";

// Load Firebase Config for REST API
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
const { projectId, firestoreDatabaseId, apiKey } = firebaseConfig;

// Configure persistent Web Push VAPID credentials
const vapidPublicKey = (
  process.env.VAPID_PUBLIC_KEY ||
  process.env.VITE_FIREBASE_VAPID_KEY ||
  process.env.FIREBASE_VAPID_KEY ||
  ""
).trim();

const vapidPrivateKey = (
  process.env.VAPID_PRIVATE_KEY ||
  process.env.FIREBASE_VAPID_PRIVATE_KEY ||
  ""
).trim();

const vapidSubject = (
  process.env.VAPID_SUBJECT ||
  "mailto:admin@student.annauniv.edu"
).trim();

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    console.log("[WebPush] VAPID credentials successfully initialized.");
  } catch (err: any) {
    console.warn("[WebPush] Failed to initialize VAPID credentials:", err?.message);
  }
} else {
  console.warn("[WebPush] VAPID keys not configured in environment (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).");
}

// Server-side persistent token caching for internal system account
let serverToken: string | null = null;
let serverTokenExpiry = 0;

async function getServerToken(): Promise<string | null> {
  if (serverToken && Date.now() < serverTokenExpiry - 60000) {
    return serverToken;
  }

  const systemEmail = process.env.INTERNAL_SYSTEM_EMAIL?.trim() || "internal.system@student.annauniv.edu";
  const systemPassword = process.env.INTERNAL_SYSTEM_PASSWORD?.trim();

  if (!systemEmail || !systemPassword) {
    console.warn("[System Auth] INTERNAL_SYSTEM_EMAIL or INTERNAL_SYSTEM_PASSWORD is not set in environment.");
    return null;
  }

  try {
    const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
    const res = await fetch(authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: systemEmail,
        password: systemPassword,
        returnSecureToken: true,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.warn(`[System Auth] System account sign-in rejected (${res.status}):`, data?.error?.message || data);
      return null;
    }
    serverToken = data.idToken;
    serverTokenExpiry = Date.now() + (parseInt(data.expiresIn, 10) || 3600) * 1000;
    return serverToken;
  } catch (err: any) {
    console.warn("[System Auth] Network error during system account sign-in:", err?.message);
    return null;
  }
}

// Interface for shared persistent Firestore-backed OTP store
interface OtpFirestoreDoc {
  hash: string;
  expiresAt: number;
  attempts: number;
  lastRequestedAt: number;
  used: boolean;
  verified: boolean;
  verifiedExpiresAt?: number;
}

// In-memory IP rate limiter for auth endpoints with bounded capacity protection
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const ipRateLimits = new Map<string, RateLimitBucket>();
const MAX_RATE_LIMIT_ENTRIES = 10000;

function checkIpRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = ipRateLimits.get(key);
  if (!bucket || now > bucket.resetAt) {
    if (ipRateLimits.size >= MAX_RATE_LIMIT_ENTRIES) {
      const oldestKey = ipRateLimits.keys().next().value;
      if (oldestKey) ipRateLimits.delete(oldestKey);
    }
    ipRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= maxRequests) {
    return false;
  }
  bucket.count += 1;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of ipRateLimits.entries()) {
    if (now > bucket.resetAt) {
      ipRateLimits.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

// Password security policies and server-side validation
const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 128;

function validatePassword(password: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof password !== "string") {
    return { valid: false, errors: ["Password is required and must be a string."] };
  }
  if (password.length < MIN_PASSWORD_LEN) {
    errors.push("Password must be at least 8 characters long.");
  }
  if (password.length > MAX_PASSWORD_LEN) {
    errors.push(`Password must not exceed ${MAX_PASSWORD_LEN} characters.`);
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least 1 uppercase letter (A-Z).");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least 1 lowercase letter (a-z).");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least 1 number (0-9).");
  }
  if (!SPECIAL_CHARS_REGEX.test(password)) {
    errors.push("Password must contain at least 1 special character (!@#$%^&*()_+-=[]{};':\"\\|,.<>/?).");
  }
  if (/\s/.test(password)) {
    errors.push("Password must not contain any whitespace characters.");
  }
  return { valid: errors.length === 0, errors };
}

// In-memory development fallback store for temporary OTP records when system token is not configured
const devOtpStore = new Map<string, OtpFirestoreDoc>();

async function getOtpRecord(emailDocId: string): Promise<OtpFirestoreDoc | null> {
  try {
    const token = await getServerToken();
    if (!token) {
      if (process.env.NODE_ENV !== "production") {
        const localDoc = devOtpStore.get(emailDocId);
        return localDoc ? { ...localDoc } : null;
      }
      return null;
    }
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/temp_otps/${emailDocId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error("Failed to get OTP record from Firestore:", await res.text());
      return null;
    }
    const json = await res.json();
    const f = json.fields || {};
    return {
      hash: f.hash?.stringValue || "",
      expiresAt: Number(f.expiresAt?.integerValue || 0),
      attempts: Number(f.attempts?.integerValue || 0),
      lastRequestedAt: Number(f.lastRequestedAt?.integerValue || 0),
      used: Boolean(f.used?.booleanValue),
      verified: Boolean(f.verified?.booleanValue),
      verifiedExpiresAt: f.verifiedExpiresAt?.integerValue ? Number(f.verifiedExpiresAt.integerValue) : undefined,
    };
  } catch (err) {
    console.error("Error reading OTP record from Firestore:", err);
    return null;
  }
}

async function saveOtpRecord(emailDocId: string, record: OtpFirestoreDoc): Promise<void> {
  const token = await getServerToken();
  if (!token) {
    if (process.env.NODE_ENV !== "production") {
      devOtpStore.set(emailDocId, { ...record });
      return;
    }
    throw new Error("System authentication token is unavailable in production environment.");
  }
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/temp_otps/${emailDocId}`;
  const fields: Record<string, any> = {
    hash: { stringValue: record.hash },
    expiresAt: { integerValue: String(record.expiresAt) },
    attempts: { integerValue: String(record.attempts) },
    lastRequestedAt: { integerValue: String(record.lastRequestedAt) },
    used: { booleanValue: record.used },
    verified: { booleanValue: record.verified },
  };
  if (record.verifiedExpiresAt !== undefined) {
    fields.verifiedExpiresAt = { integerValue: String(record.verifiedExpiresAt) };
  }
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to save OTP record to Firestore: ${errText}`);
  }
}

async function deleteOtpRecord(emailDocId: string): Promise<void> {
  try {
    const token = await getServerToken();
    if (!token) {
      if (process.env.NODE_ENV !== "production") {
        devOtpStore.delete(emailDocId);
        return;
      }
      return;
    }
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/temp_otps/${emailDocId}`;
    await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.warn("Failed to delete OTP record from Firestore:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT
    ? parseInt(process.env.PORT, 10)
    : 3000;

  // Cloud Run proxy topology configuration: single reverse-proxy hop
  app.set("trust proxy", 1);

  // Environment-aware framing configuration:
  // PRODUCTION: Retains strict clickjacking protection (X-Frame-Options: SAMEORIGIN & CSP frame-ancestors: 'self')
  // DEVELOPMENT: Allows framing by verified AI Studio preview parent origins, configured via environment variable
  const isDevelopment = process.env.NODE_ENV !== "production";

  const getDevFrameAncestors = (): string[] => {
    // Prefer explicit parent origin if declared in environment variables
    if (process.env.AI_STUDIO_PARENT_ORIGIN) {
      return ["'self'", process.env.AI_STUDIO_PARENT_ORIGIN];
    }
    // Inspect platform-provided container CSP header if available
    if (process.env.CSP_HEADER_VALUE) {
      const matches = process.env.CSP_HEADER_VALUE.match(/https?:\/\/[^\s;]+/g);
      if (matches && matches.length > 0) {
        return ["'self'", "https://ai.studio", ...matches];
      }
    }
    return [
      "'self'",
      "https://ai.studio",
      "https://*.google.com",
      "https://*.googleusercontent.com",
    ];
  };

  const frameAncestors = isDevelopment ? getDevFrameAncestors() : ["'self'"];

  // Security Headers via Helmet with customized CSP for Firebase, Cloudinary, Fonts, and Environment-Aware Framing
  app.use(
    helmet({
      xFrameOptions: isDevelopment ? false : { action: "sameorigin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://images.unsplash.com", "https://api.dicebear.com"],
          connectSrc: [
            "'self'",
            "https://identitytoolkit.googleapis.com",
            "https://securetoken.googleapis.com",
            "https://firestore.googleapis.com",
            "https://*.firebaseio.com",
            "https://api.cloudinary.com",
            "https://res.cloudinary.com",
            "https://studentneed-backend.onrender.com",
          ],
          frameAncestors,
          frameSrc: ["'self'"],
          objectSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginOpenerPolicy: isDevelopment ? false : { policy: "same-origin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // Explicit Permissions-Policy: Restrict sensitive device APIs
  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    next();
  });

  // Strict CORS Validation: Explicit allowlist ONLY - zero suffix-based wildcard matching
  const explicitProductionOrigins = new Set([
    "https://studentneed.me",
    "https://www.studentneed.me",
  ]);

  const explicitDevelopmentOrigins = new Set([
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "https://ai.studio",
    "https://ais-dev-gti23zzly6wg7xqqzhxl5a-361860804341.asia-east1.run.app",
    "https://ais-pre-gti23zzly6wg7xqqzhxl5a-361860804341.asia-east1.run.app",
  ]);

  const isAllowedOrigin = (origin: string): boolean => {
    try {
      const normalized = origin.trim().replace(/\/$/, "");

      // 1. Official production domains
      if (explicitProductionOrigins.has(normalized)) {
        return true;
      }

      // 2. Configured frontend URL
      if (process.env.FRONTEND_URL) {
        try {
          if (new URL(process.env.FRONTEND_URL).origin === normalized) return true;
        } catch {}
      }

      // 3. In development / preview mode, check explicit dev origins
      if (isDevelopment) {
        if (explicitDevelopmentOrigins.has(normalized)) {
          return true;
        }
        if (process.env.APP_URL) {
          try {
            if (new URL(process.env.APP_URL).origin === normalized) return true;
          } catch {}
        }
        if (process.env.AI_STUDIO_PARENT_ORIGIN) {
          try {
            if (new URL(process.env.AI_STUDIO_PARENT_ORIGIN).origin === normalized) return true;
          } catch {}
        }
      }

      return false;
    } catch {
      return false;
    }
  };

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (isAllowedOrigin(origin)) {
          return callback(null, true);
        }
        // Gracefully disallow unauthorized origins without crashing Express
        return callback(null, false);
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
      credentials: true,
    })
  );

  // Route-Specific Body Limits:
  // - /api/upload/image: dedicated 6MB limit to support compressed student listing images
  // - All other endpoints: strictly 100KB to mitigate memory exhaustion/DoS attacks
  app.use((req, res, next) => {
    if (req.path === "/api/upload/image") {
      return next();
    }
    express.json({ limit: "100kb" })(req, res, next);
  });

  app.use((req, res, next) => {
    if (req.path === "/api/upload/image") {
      return next();
    }
    express.urlencoded({ limit: "100kb", extended: true })(req, res, next);
  });

  // Helper to lazily initialize Resend client
  const getResendClient = () => {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) return null;
    return new Resend(apiKey);
  };

  app.get("/api/health", (req, res) => {
    const missingProductionSecrets: string[] = [];
    if (process.env.NODE_ENV === "production") {
      if (!process.env.INTERNAL_SYSTEM_PASSWORD?.trim()) missingProductionSecrets.push("INTERNAL_SYSTEM_PASSWORD");
      if (!process.env.INTERNAL_SYSTEM_EMAIL?.trim()) missingProductionSecrets.push("INTERNAL_SYSTEM_EMAIL");
      if (!process.env.RESEND_API_KEY?.trim()) missingProductionSecrets.push("RESEND_API_KEY");
      if (!process.env.CLOUDINARY_API_SECRET?.trim() && !process.env.CLOUDINARY_SECRET?.trim() && !process.env.CLOUDINARY_URL) {
        missingProductionSecrets.push("CLOUDINARY_API_SECRET");
      }
      if (!process.env.VAPID_PUBLIC_KEY?.trim()) missingProductionSecrets.push("VAPID_PUBLIC_KEY");
      if (!process.env.VAPID_PRIVATE_KEY?.trim()) missingProductionSecrets.push("VAPID_PRIVATE_KEY");
    }

    if (missingProductionSecrets.length > 0) {
      return res.status(503).json({
        status: "misconfigured",
        missingConfig: missingProductionSecrets,
        environment: process.env.NODE_ENV || "development",
      });
    }

    res.json({
      status: "healthy",
      environment: process.env.NODE_ENV || "development",
      uptime: Math.round(process.uptime()),
    });
  });

  // --- StudentNeed Campus Assistant & Knowledge Base ---

  const STUDENTNEED_SYSTEM_INSTRUCTION = `You are the friendly, helpful AI Campus Assistant for StudentNeed — the verified peer-to-peer marketplace exclusively for Anna University students (@student.annauniv.edu).

CORE PRODUCT KNOWLEDGE & RULES:
1. StudentNeed is a campus-only platform where verified Anna University students can buy, borrow, donate, or exchange textbooks, lab essentials, electronics, hostel essentials, and college wear without courier fees or strangers.
2. The core exchange flow is "Find → Connect → Meet":
   - Find: Browse the marketplace (/marketplace) or post an item request (/create-request) if looking for something specific.
   - Connect: Message the student via built-in 1-on-1 real-time chat (/chat/:chatId) to discuss condition, price, or submit an item reservation.
   - Meet: Coordinate safe in-person campus meetups at approved campus spots and mark the exchange completed in the app.
3. Supported Listing Types (strictly 4):
   - Sale: Student sells an item at a specified price in ₹.
   - Borrow: Item requested or lent on loan (photos are strictly not permitted for Borrow).
   - Donate: Student gives away an item for free.
   - Exchange: Direct item swap with a peer (photos are strictly not permitted for Exchange).
4. Supported Categories (strictly 8):
   - Textbooks
   - Electronics
   - Stationery
   - Lab Essentials
   - Hostel Essentials
   - Sports
   - College Wear
   - Other
5. Creating Listings (/create-listing):
   - Requires verified student account.
   - Requires title (max 80 chars), category, condition (New, Like New, Good, Fair, Poor), location, description.
   - Expiration period must be chosen: 7, 15, or 30 days (listings automatically expire to avoid outdated posts).
   - Photo limits: Up to 4 photos (JPG, PNG, WEBP up to 5MB each) for Sale and Donate. Photos are strictly NOT permitted for Borrow and Exchange listings.
6. Contacting & Reservations:
   - On /listing/:id, buyers can click "Contact Student" to open a direct chat, or "Reserve Item" to submit a pending reservation.
   - When a reservation is accepted by the seller, the listing status updates to 'reserved'.
   - Once accepted, participants coordinate a campus meetup at one of the approved campus locations:
     * Main Gate
     * Hostel Gate
     * Back Gate
     * MIT Library
     * Canteen
     * Hanger 1
     * Hanger 2
     * MIT Connect
   - One student proposes the meetup location, the other confirms.
   - After meetup, either participant clicks "Complete Exchange" to finalize.
7. Requests (/requests & /create-request):
   - Students can post wanted items with title, category, description, needed-by date, preferred location, and optional budget.
   - Other students can view and reach out if they have the item.
   - Requesters can mark requests as found (completed) or cancel them.
8. Saved Listings:
   - Saved/bookmarked listings use browser localStorage (stored locally on the user's current browser/device, NOT synced to the cloud profile or across devices).
9. Account & Verification:
   - Only @student.annauniv.edu emails are allowed.
   - Verified via 6-digit email OTP (5-minute expiry).
10. STRICT BOUNDARIES & INTEGRITY:
   - NO online payment processing (no credit card/debit card/Stripe/gateway). Payments are handled directly between students at the meetup (cash or student UPI).
   - NO courier/delivery shipping. All exchanges happen in-person on campus.
   - NO external or guest accounts.
   - Do NOT invent features that do not exist in StudentNeed.
   - If the user asks about something outside this knowledge base, clearly state: "This information is currently unavailable in the StudentNeed knowledge base."
   - Keep answers concise, direct, accurate, and student-friendly.`;

  function getDeterministicKnowledgeResponse(userQuery: string): string {
    const q = userQuery.toLowerCase().trim();

    if (!q || q.length < 2) {
      return "Hi there! I am your StudentNeed Campus Assistant. Ask me anything about how StudentNeed works, browsing listings, posting items, categories, or campus meetups!";
    }

    if (q.includes("what is studentneed") || q.includes("about studentneed") || (q.includes("what") && q.includes("studentneed")) || q.includes("overview")) {
      return "StudentNeed is a verified campus-only peer-to-peer exchange platform exclusively for Anna University students (@student.annauniv.edu). Students can buy, borrow, donate, or exchange textbooks, lab essentials, electronics, hostel supplies, and college wear securely without courier fees or strangers.";
    }

    if (q.includes("find connect meet") || q.includes("how it work") || q.includes("how does it work") || q.includes("workflow") || q.includes("steps")) {
      return "StudentNeed works in 3 simple campus-focused steps:\n\n1. **Find**: Browse items on the Marketplace (/marketplace) with filters, or post an Item Request (/create-request) if you can't find what you need.\n2. **Connect**: Chat 1-on-1 with fellow students in real-time (/chat) to discuss details or submit an item reservation.\n3. **Meet**: Coordinate a safe in-person campus meetup at approved spots (like MIT Library or Main Gate) and complete the exchange.";
    }

    if (q.includes("browse") || q.includes("search") || q.includes("find item") || q.includes("filter") || q.includes("sort")) {
      return "To browse and search for items:\n- Head to **Marketplace** (/marketplace).\n- Use the search bar to find keywords across titles and descriptions.\n- Filter by **Listing Type** (Sale, Borrow, Donate, Exchange) and **Category**.\n- Sort results by **Newest**, **Price: Low to High**, or **Price: High to Low**.\n- Click the heart icon to save listings to your browser's local storage for easy access.";
    }

    if (q.includes("post") || q.includes("create listing") || q.includes("list an item") || q.includes("sell an item") || q.includes("how to list") || q.includes("publish")) {
      return "To post an item on StudentNeed:\n1. Log in with your verified student account and click **Post Item** (/create-listing).\n2. Enter the title (up to 80 chars), category, condition (New, Like New, Good, Fair, Poor), campus pickup location, and description.\n3. Select a listing expiration period: **7, 15, or 30 days** (listings expire automatically to prevent stale posts).\n4. **Photos**: For **Sale** and **Donate**, upload **up to 4 photos** (JPG/PNG/WEBP under 5MB). Photos are **strictly not permitted** for Borrow or Exchange listings.\n5. If selling, specify your price in ₹, then submit!";
    }

    if ((q.includes("category") || q.includes("categories")) && (q.includes("type") || q.includes("types") || q.includes("listing"))) {
      return "StudentNeed supports **4 Listing Types** and **8 Categories**:\n\n**Listing Types**:\n- **Sale**: Offer items for purchase at a fixed price in ₹ (up to 4 photos allowed).\n- **Borrow**: Request or lend items temporarily on loan (photos are strictly not permitted).\n- **Donate**: Offer items for free to campus peers.\n- **Exchange**: Direct item-for-item peer swaps (photos are strictly not permitted).\n\n**Categories**:\nTextbooks, Electronics, Stationery, Lab Essentials, Hostel Essentials, Sports, College Wear, and Other.";
    }

    if (q.includes("category") || q.includes("categories")) {
      return "StudentNeed currently supports **8 verified categories**:\n1. **Textbooks**\n2. **Electronics**\n3. **Stationery**\n4. **Lab Essentials**\n5. **Hostel Essentials**\n6. **Sports**\n7. **College Wear**\n8. **Other**";
    }

    if (q.includes("listing type") || q.includes("types of listing") || (q.includes("type") && (q.includes("sale") || q.includes("borrow") || q.includes("donate") || q.includes("exchange")))) {
      return "StudentNeed supports **4 listing types**:\n- **Sale**: Offer items for purchase at a fixed price in ₹ (requires up to 4 photos).\n- **Borrow**: Request or lend items temporarily on loan (**photos not permitted**).\n- **Donate**: Offer useful items for free to fellow campus peers.\n- **Exchange**: Direct item-for-item peer swaps (**photos not permitted**).";
    }

    if (q.includes("contact") || q.includes("reserve") || q.includes("reservation") || q.includes("meetup") || q.includes("location") || q.includes("spot") || q.includes("where to meet")) {
      return "Contacting Sellers & Campus Meetups:\n- On any listing page (/listing/:id), click **Contact Student** to chat or **Reserve Item** to submit a hold request.\n- When the seller accepts the reservation, the item status changes to 'reserved'.\n- Either student can propose an approved campus meetup location:\n  * **Main Gate**\n  * **Hostel Gate**\n  * **Back Gate**\n  * **MIT Library**\n  * **Canteen**\n  * **Hanger 1**\n  * **Hanger 2**\n  * **MIT Connect**\n  * The other student confirms the location. After completing the in-person exchange on campus, either student clicks **Complete Exchange**.";
    }

    if (q.includes("request") || q.includes("can't find") || q.includes("looking for")) {
      return "Looking for something not yet listed?\n- Go to **Requests** (/requests) and click **Create Request** (/create-request).\n- Specify title, category, description, needed-by date, preferred campus location, and optional budget in ₹.\n- Other campus peers can see your request and reach out.\n- Once you obtain the item, you can mark the request as found or cancel it anytime.";
    }

    if (q.includes("saved") || q.includes("bookmark") || q.includes("favorite") || q.includes("heart")) {
      return "Saved Listings:\n- You can save items by clicking the heart icon on any listing card.\n- Saved items are stored in your browser's **localStorage** (`sn_saved_listings`) and can be viewed under **Profile → Saved Items**.\n- Note: Saved items are local to your current browser and are **not** synced across devices or saved to your cloud profile.";
    }

    if (q.includes("pay") || q.includes("payment") || q.includes("upi") || q.includes("cash") || q.includes("delivery") || q.includes("shipping")) {
      return "Payments & Delivery Guidelines:\n- **No Online Payment Gateway**: StudentNeed does not process in-app credit card or digital payments. Payment is settled directly between students in person at the meetup (via cash or student UPI).\n- **No Courier Delivery**: There is no doorstep or parcel shipping. All exchanges must take place in person at designated campus meetup spots.";
    }

    if (q.includes("register") || q.includes("sign up") || q.includes("signup") || q.includes("login") || q.includes("otp") || q.includes("verify email")) {
      return "Registration & Verification:\n- Only official **@student.annauniv.edu** email addresses are permitted.\n- A 6-digit OTP code is sent to your college inbox (5-minute expiry) to verify student identity.\n- Once verified, you create a password and set your name, department, and avatar during onboarding.";
    }

    if (q.includes("photo") || q.includes("image") || q.includes("upload") || q.includes("picture")) {
      return "Photo Rules on StudentNeed:\n- **Sale & Donate listings**: Up to **4 photos** allowed (JPG, PNG, WEBP; max 5MB each).\n- **Borrow & Exchange listings**: Photos are **strictly not permitted**.\n- All photos are securely optimized and hosted via Cloudinary.";
    }

    return "This information is currently unavailable in the StudentNeed knowledge base. I can help you with:\n- What StudentNeed is and the **Find → Connect → Meet** flow\n- How to browse, search, and save items\n- How to post listings (photo rules & expiration periods)\n- Supported listing types (Sale, Borrow, Donate, Exchange) and categories\n- Item reservations and approved campus meetup spots\n- How to create and fulfill campus item requests";
  }

  // 0. StudentNeed Campus AI Assistant Endpoint (Rate-limited, grounded in knowledge base)
  app.post("/api/chat/assistant", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkIpRateLimit(`chat-assistant:${clientIp}`, 30, 10 * 60 * 1000)) {
        return res.status(429).json({
          error: "Too many assistant requests from this IP address. Please wait a few minutes before asking more questions.",
        });
      }

      const { message, history } = req.body;
      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "Message is required." });
      }

      const trimmedMessage = message.trim();
      if (trimmedMessage.length > 600) {
        return res.status(400).json({ error: "Message is too long. Please keep your question under 600 characters." });
      }

      const geminiApiKey = process.env.GEMINI_API_KEY?.trim();

      // If GEMINI_API_KEY is configured, attempt generation with @google/genai
      if (geminiApiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey: geminiApiKey });
          const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";

          // Format recent history (up to 6 turns)
          const formattedContents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
          if (Array.isArray(history)) {
            for (const turn of history.slice(-6)) {
              if (turn && typeof turn.text === "string" && turn.text.trim() && (turn.role === "user" || turn.role === "assistant")) {
                formattedContents.push({
                  role: turn.role === "assistant" ? "model" : "user",
                  parts: [{ text: turn.text.slice(0, 600) }],
                });
              }
            }
          }
          formattedContents.push({
            role: "user",
            parts: [{ text: trimmedMessage }],
          });

          const genuiPrompt = `${STUDENTNEED_SYSTEM_INSTRUCTION}

You are the StudentNeed Campus AI Assistant with Generative UI (GenUI) capabilities.
Respond to the student's question directly, and if possible provide structured JSON in this format:
{
  "reply": "Concise text explanation or advice",
  "intent": "informational" | "item_search" | "comparison" | "data_summary" | "user_input" | "destructive_action" | "unsupported"
}`;

          const response = await ai.models.generateContent({
            model: modelName,
            contents: formattedContents as any,
            config: {
              systemInstruction: genuiPrompt,
              maxOutputTokens: 800,
              temperature: 0.2,
            },
          });

          const rawText = response.text?.trim() || "";

          // Attempt to parse JSON if model returned structured output
          let parsedData: any = null;
          try {
            const cleanJsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (cleanJsonMatch) {
              parsedData = JSON.parse(cleanJsonMatch[0]);
            }
          } catch {
            parsedData = null;
          }

          const fallbackGenUI = generateGenUIPayload(trimmedMessage);
          const replyText = parsedData?.reply?.trim() || rawText || fallbackGenUI.message;

          // If model returned a valid GenUI payload, validate it
          if (parsedData?.genui) {
            const validation = validateGenUIPayload(parsedData.genui);
            if (validation.valid && validation.sanitizedPayload) {
              return res.json({
                reply: replyText,
                genui: validation.sanitizedPayload,
                source: "ai"
              });
            }
          }

          // Otherwise return model's reply with deterministic verified GenUI component
          return res.json({
            reply: replyText,
            genui: fallbackGenUI,
            source: "ai"
          });
        } catch (aiErr: any) {
          // Log safe diagnostic notice without exposing any keys or credentials
          console.warn("[Campus Assistant Notice] Upstream AI dispatch failed, using verified GenUI fallback:", aiErr?.status || aiErr?.code || "Generation unavailable");
        }
      }

      // Safe deterministic knowledge base & GenUI fallback (always available even if GEMINI_API_KEY is unset or fails)
      const deterministicGenUI = generateGenUIPayload(trimmedMessage);
      return res.json({
        reply: deterministicGenUI.message,
        genui: deterministicGenUI,
        source: "knowledge_base"
      });
    } catch (err: any) {
      console.error("[Campus Assistant Endpoint Error]:", err?.message || "Internal error");
      return res.status(500).json({ error: "Unable to process assistant request at this time. Please try again." });
    }
  });

  // 1. Send OTP (Rate-limited via trusted req.ip and email address)
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkIpRateLimit(`send-otp:ip:${clientIp}`, 25, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many verification requests from this network. Please wait 10 minutes." });
      }

      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required." });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const rawDomain = (process.env.COLLEGE_EMAIL_DOMAIN || "student.annauniv.edu").trim().replace(/^@/, '');
      const allowedDomain = `@${rawDomain}`;

      if (!normalizedEmail.endsWith(allowedDomain)) {
        return res.status(403).json({ error: "Please use your official college email address." });
      }

      if (!checkIpRateLimit(`send-otp:email:${normalizedEmail}`, 5, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many verification requests for this email address. Please wait 10 minutes." });
      }

      const emailDocId = crypto.createHash("sha256").update(normalizedEmail).digest("hex");

      // Check cooldown (60s minimum interval) using shared persistent store
      const existingDoc = await getOtpRecord(emailDocId);
      if (existingDoc && existingDoc.lastRequestedAt && Date.now() - existingDoc.lastRequestedAt < 60 * 1000) {
        return res.status(429).json({ error: "Please wait 60 seconds before requesting a new OTP." });
      }

      const otp = crypto.randomInt(100000, 1000000).toString();
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(otp, salt);

      // Persist to shared Firestore temporary store
      await saveOtpRecord(emailDocId, {
        hash,
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0,
        lastRequestedAt: Date.now(),
        used: false,
        verified: false,
      });

      const resend = getResendClient();
      const sender = (process.env.EMAIL_FROM || "StudentNeed <auth@studentneed.me>").trim();

      if (!resend) {
        if (process.env.NODE_ENV !== "production") {
          console.info(`[DEV MODE] Verification dispatched for ${normalizedEmail}. Code ending in ***${otp.slice(-2)}`);
        }
        return res.json({ message: "OTP sent successfully." });
      }

      try {
        const { error } = await resend.emails.send({
          from: sender,
          to: normalizedEmail,
          subject: "Your StudentNeed Verification Code",
          text: `Your StudentNeed verification code is: ${otp}\n\nThis code will expire in 5 minutes. If you did not request this, please ignore this email.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 8px;">
              <h2 style="color: #18181b; margin-top: 0;">StudentNeed Campus Verification</h2>
              <p style="color: #52525b; font-size: 15px;">Use the verification code below to verify your student email address:</p>
              <div style="background-color: #f4f4f5; border-radius: 6px; padding: 16px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #18181b;">${otp}</span>
              </div>
              <p style="color: #71717a; font-size: 13px; margin-bottom: 0;">This code expires in 5 minutes. If you did not request this code, no action is needed.</p>
            </div>
          `,
        });

        if (error) {
          throw new Error(error.message || JSON.stringify(error));
        }

        return res.json({ message: "OTP sent successfully." });
      } catch (err: any) {
        console.error("[Resend Dispatch Error]:", err?.message || err);
        if (process.env.NODE_ENV !== "production") {
          console.info(`[DEV FALLBACK] Resend fallback for ${normalizedEmail}. Code ending in ***${otp.slice(-2)}`);
          return res.json({ message: "OTP sent successfully." });
        }
        await deleteOtpRecord(emailDocId);
        return res.status(500).json({ error: "Failed to deliver verification email. Please try again later." });
      }
    } catch (error: any) {
      console.error("Send OTP Error:", error);
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  });

  // 2. Verify OTP (Rate-limited via trusted req.ip and email target)
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkIpRateLimit(`verify-otp:ip:${clientIp}`, 40, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many verification attempts from this network. Please wait 10 minutes." });
      }

      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ error: "Email and OTP are required." });
      }

      const normalizedEmail = email.toLowerCase().trim();
      if (!checkIpRateLimit(`verify-otp:email:${normalizedEmail}`, 10, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many verification attempts for this account. Please wait 10 minutes." });
      }
      const emailDocId = crypto.createHash("sha256").update(normalizedEmail).digest("hex");
      const data = await getOtpRecord(emailDocId);

      if (!data || data.used) {
        return res.status(400).json({ error: "No pending verification found or OTP expired." });
      }

      if (Date.now() > data.expiresAt) {
        await deleteOtpRecord(emailDocId);
        return res.status(400).json({ error: "This verification code has expired. Please request a new code." });
      }

      if (data.attempts >= 5) {
        await deleteOtpRecord(emailDocId);
        return res.status(429).json({ error: "Too many failed attempts. Please request a new OTP." });
      }

      // Increment attempt counter immediately before hash comparison to prevent concurrent TOCTOU race conditions
      data.attempts += 1;
      await saveOtpRecord(emailDocId, data);

      const isValid = await bcrypt.compare(otp.toString().trim(), data.hash);

      if (!isValid) {
        if (data.attempts >= 5) {
          await deleteOtpRecord(emailDocId);
          return res.status(429).json({ error: "Too many failed attempts. Please request a new OTP." });
        }
        return res.status(400).json({ error: "Invalid verification code. Please try again." });
      }

      // Mark OTP as used to prevent replay, and record verified status with 30-min window
      await saveOtpRecord(emailDocId, {
        ...data,
        used: true,
        verified: true,
        verifiedExpiresAt: Date.now() + 30 * 60 * 1000,
      });

      res.json({ message: "Email verified successfully." });
    } catch (error: any) {
      console.error("Verify OTP Error:", error);
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  });

  // 2b. Account Creation with server-side strong password validation
  const handleAccountCreation = async (req: express.Request, res: express.Response) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkIpRateLimit(`create-account:ip:${clientIp}`, 20, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many account creation requests. Please wait 10 minutes." });
      }

      const { email, password } = req.body;
      if (!email || typeof email !== "string" || !password || typeof password !== "string") {
        return res.status(400).json({ error: "Email and password are required." });
      }

      // Strong password validation on backend - reject invalid passwords immediately
      const validation = validatePassword(password);
      if (!validation.valid) {
        return res.status(400).json({
          error: "Password does not meet the security requirements.",
          details: validation.errors,
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const rawDomain = (process.env.COLLEGE_EMAIL_DOMAIN || "student.annauniv.edu").trim().replace(/^@/, '');
      const allowedDomain = `@${rawDomain}`;

      if (!normalizedEmail.endsWith(allowedDomain)) {
        return res.status(403).json({ error: "Please use your official college email address." });
      }

      // Verify that this email completed OTP verification
      const emailDocId = crypto.createHash("sha256").update(normalizedEmail).digest("hex");
      const verifiedRecord = await getOtpRecord(emailDocId);

      if (!verifiedRecord || !verifiedRecord.verified || !verifiedRecord.verifiedExpiresAt || Date.now() > verifiedRecord.verifiedExpiresAt) {
        return res.status(403).json({ error: "Email not verified or verification expired. Please complete email verification first." });
      }

      // Create user via Google Identity Toolkit
      const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
      const signUpRes = await fetch(signUpUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password: password,
          returnSecureToken: true,
        }),
      });

      const signUpData = await signUpRes.json();
      if (!signUpRes.ok) {
        if (signUpData?.error?.message === "EMAIL_EXISTS") {
          return res.status(409).json({ error: "Email is already in use. Try signing in instead, or use a different email." });
        }
        return res.status(400).json({ error: signUpData?.error?.message || "Failed to create account." });
      }

      // Never log or return the password in the response
      return res.status(201).json({
        message: "Account created successfully.",
        uid: signUpData.localId,
      });
    } catch (error: any) {
      console.error("Create Account Error:", error?.message || "Internal error");
      return res.status(500).json({ error: "Failed to create account. Please try again." });
    }
  };

  app.post("/api/auth/create-account", handleAccountCreation);
  app.post("/api/auth/register", handleAccountCreation);

  // 3. Finalize Account using REST API: Writes public profile without PII and private profile to /users/{uid}/private/profile
  app.post("/api/auth/finalize-account", async (req, res) => {
    try {
      const { uid, email, name, department, avatarUrl, idToken } = req.body;

      if (!uid || !email || !idToken) {
        return res.status(400).json({ error: "UID, email, and idToken are required." });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const rawDomain = (process.env.COLLEGE_EMAIL_DOMAIN || "student.annauniv.edu").trim().replace(/^@/, '');
      const allowedDomain = `@${rawDomain}`;
      if (!normalizedEmail.endsWith(allowedDomain)) {
        return res.status(403).json({ error: "Please use your official college email address." });
      }

      const emailDocId = crypto.createHash("sha256").update(normalizedEmail).digest("hex");
      const verifiedRecord = await getOtpRecord(emailDocId);

      if (!verifiedRecord || !verifiedRecord.verified || !verifiedRecord.verifiedExpiresAt || Date.now() > verifiedRecord.verifiedExpiresAt) {
        return res.status(403).json({ error: "Email not verified or verification expired. You cannot create an account." });
      }

      const finalAvatarUrl = avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${name || 'User'}&backgroundColor=000000`;

      // Verify caller owns the specified UID and email via Google Identity Toolkit
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid or expired session token." });
      }
      const tokenUser = verifyData.users[0];
      if (tokenUser.localId !== uid || tokenUser.email?.toLowerCase().trim() !== normalizedEmail) {
        return res.status(403).json({ error: "Session identity mismatch." });
      }

      // Use Firestore REST API with system privileges to securely create verified public profile
      const systemToken = await getServerToken();
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users?documentId=${uid}`;

      const firestorePayload = {
        fields: {
          id: { stringValue: uid },
          name: { stringValue: name || '' },
          department: { stringValue: department || '' },
          campus: { stringValue: 'Anna University' },
          rating: { integerValue: "0" },
          avatarUrl: { stringValue: finalAvatarUrl },
          exchangesCompleted: { integerValue: "0" },
          role: { stringValue: 'student' },
          isVerified: { booleanValue: true },
          createdAt: { stringValue: new Date().toISOString() }
        }
      };

      const firestoreRes = await fetch(firestoreUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${systemToken}`
        },
        body: JSON.stringify(firestorePayload)
      });

      if (!firestoreRes.ok) {
        // If POST fails, it might already exist, try PATCH
        const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${uid}`;
        const patchRes = await fetch(patchUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${systemToken}`
          },
          body: JSON.stringify(firestorePayload)
        });

        if (!patchRes.ok) {
           const errText = await patchRes.text();
           console.error("Firestore REST Error:", errText);
           return res.status(500).json({ error: "Failed to create user profile in database." });
        }
      }

      // Securely store private PII (institutional email, phone, private settings) in isolated subcollection
      const privateProfileUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${uid}/private/profile`;
      const privatePayload = {
        fields: {
          email: { stringValue: normalizedEmail },
          phone: { stringValue: "" },
          uid: { stringValue: uid },
          createdAt: { stringValue: new Date().toISOString() },
          updatedAt: { stringValue: new Date().toISOString() }
        }
      };
      await fetch(privateProfileUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${systemToken}`
        },
        body: JSON.stringify(privatePayload)
      });

      // Clean up the verified temporary OTP record to prevent replay
      await deleteOtpRecord(emailDocId);
      res.json({ message: "Account finalized successfully." });
    } catch (error: any) {
      console.error("Finalize Account Error:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  });

  // 4. Forgot Password (Rate-limited, dispatches via Resend with verified StudentNeed domain)
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkIpRateLimit(`forgot-password:${clientIp}`, 5, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many password reset requests from this IP address. Please wait 10 minutes." });
      }

      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required." });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const rawDomain = (process.env.COLLEGE_EMAIL_DOMAIN || "student.annauniv.edu").trim().replace(/^@/, '');
      const allowedDomain = `@${rawDomain}`;

      if (!normalizedEmail.endsWith(allowedDomain)) {
        return res.status(403).json({ error: "Please use your official college email address." });
      }

      // Check cooldown (60s minimum interval) to prevent spamming
      const emailDocId = crypto.createHash("sha256").update(`reset_${normalizedEmail}`).digest("hex");
      const existingDoc = await getOtpRecord(emailDocId);
      if (existingDoc && existingDoc.lastRequestedAt && Date.now() - existingDoc.lastRequestedAt < 60 * 1000) {
        return res.status(429).json({ error: "Please wait 60 seconds before requesting another reset email." });
      }

      // 1. Attempt to generate secure OOB reset link via GoogleAuth / Service Account (works on GCP Cloud Run)
      let resetLink: string | null = null;
      try {
        const googleAuth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/identitytoolkit'] });
        const client = await googleAuth.getClient();
        const tokenResponse = await client.getAccessToken();
        if (tokenResponse?.token) {
          const oobUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:sendOobCode`;
          const oobRes = await fetch(oobUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tokenResponse.token}`,
            },
            body: JSON.stringify({
              requestType: "PASSWORD_RESET",
              email: normalizedEmail,
              returnOobLink: true,
            }),
          });
          if (oobRes.ok) {
            const oobData = await oobRes.json();
            if (oobData.oobLink) {
              resetLink = oobData.oobLink;
            }
          } else {
            const errText = await oobRes.text();
            console.warn("[Password Reset] Elevated OOB link generation notice:", errText);
          }
        }
      } catch (authErr: any) {
        // Fallback for environments without direct GCP service account access
        console.warn("[Password Reset] Service account credentials unavailable:", authErr?.message);
      }

      // 2. Trigger Firebase Auth password reset action via standard REST API
      const fbUrl = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`;
      const fbRes = await fetch(fbUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "PASSWORD_RESET",
          email: normalizedEmail,
        }),
      });

      if (!fbRes.ok) {
        const fbErr = await fbRes.text();
        if (fbErr.includes("EMAIL_NOT_FOUND")) {
          // Mitigate account enumeration: return uniform success response when email is not registered
          await saveOtpRecord(emailDocId, {
            hash: "reset",
            expiresAt: Date.now() + 15 * 60 * 1000,
            attempts: 0,
            lastRequestedAt: Date.now(),
            used: false,
            verified: false,
          });
          return res.json({ message: "Password reset email sent." });
        }
        console.error("[Password Reset Firebase Error]:", fbErr);
        return res.status(500).json({ error: "Unable to send password reset email. Please try again." });
      }

      // Record request timestamp in Firestore temporary store for 60s cooldown
      await saveOtpRecord(emailDocId, {
        hash: "reset",
        expiresAt: Date.now() + 15 * 60 * 1000,
        attempts: 0,
        lastRequestedAt: Date.now(),
        used: false,
        verified: false,
      });

      // 3. Dispatch email via Resend with verified StudentNeed domain
      const resend = getResendClient();
      const sender = (process.env.EMAIL_FROM || "StudentNeed <auth@studentneed.me>").trim();

      if (!resend) {
        if (process.env.NODE_ENV !== "production") {
          console.info(`[DEV MODE] Password reset dispatched for ${normalizedEmail}. Reset link: ${resetLink || `https://${firebaseConfig.authDomain}/__/auth/action?mode=resetPassword`}`);
        }
        return res.json({ message: "Password reset email sent." });
      }

      const actionUrl = resetLink || `https://${firebaseConfig.authDomain}/__/auth/action?mode=resetPassword`;

      try {
        const { data: resendData, error: resendError } = await resend.emails.send({
          from: sender,
          to: normalizedEmail,
          subject: "Reset your StudentNeed password",
          text: `Hello,\n\nA password reset request was received for your StudentNeed account (${normalizedEmail}).\n\nPlease use the link below to set a new password:\n${actionUrl}\n\nIf you did not request this, you can safely ignore this email. Your password will remain unchanged.`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e4e4e7; border-radius: 12px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 50%; background-color: #e0e7ff; color: #4338ca; margin-bottom: 12px; font-size: 22px;">
                  🔒
                </div>
                <h2 style="color: #18181b; margin: 0; font-size: 22px; font-weight: 700;">Reset Your Password</h2>
                <p style="color: #71717a; font-size: 14px; margin-top: 6px;">StudentNeed Campus Marketplace</p>
              </div>
              <p style="color: #3f3f46; font-size: 15px; line-height: 1.5;">
                We received a request to reset the password associated with your verified student email address (<strong>${normalizedEmail}</strong>).
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${actionUrl}" style="background-color: #18181b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="color: #71717a; font-size: 13px; line-height: 1.4;">
                If the button above doesn't work, copy and paste this link into your browser:<br/>
                <a href="${actionUrl}" style="color: #4f46e5; word-break: break-all; font-size: 12px;">${actionUrl}</a>
              </p>
              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
              <p style="color: #a1a1aa; font-size: 12px; margin: 0; text-align: center;">
                If you did not make this request, you can safely ignore this email. Your account remains secure.
              </p>
            </div>
          `,
        });

        if (resendError) {
          console.error("[Resend Password Reset Error]:", resendError.message || JSON.stringify(resendError));
          return res.status(500).json({ error: "Unable to send password reset email. Please try again." });
        }

        console.info(`[Password Reset] Dispatched successfully via Resend to ${normalizedEmail} (ID: ${resendData?.id})`);
        return res.json({ message: "Password reset email sent." });
      } catch (sendErr: any) {
        console.error("[Resend Exception]:", sendErr?.message || sendErr);
        if (process.env.NODE_ENV !== "production") {
          console.info(`[DEV FALLBACK] Password reset dispatched for ${normalizedEmail}.`);
          return res.json({ message: "Password reset email sent." });
        }
        return res.status(500).json({ error: "Unable to send password reset email. Please try again." });
      }
    } catch (error: any) {
      console.error("Forgot Password Error:", error?.message || error);
      res.status(500).json({ error: "Unable to send password reset email. Please try again." });
    }
  });

  // 5. Change Password with server-side strong password validation
  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkIpRateLimit(`change-password:ip:${clientIp}`, 15, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many password change attempts. Please wait 10 minutes." });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required to change password." });
      }
      const idToken = authHeader.split(" ")[1];

      // Verify caller token via Google Identity Toolkit lookup
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid or expired session. Please sign in again." });
      }

      const callerUid = verifyData.users[0].localId;
      if (!checkIpRateLimit(`change-password:uid:${callerUid}`, 5, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many password changes requested. Please wait 10 minutes." });
      }

      const { newPassword } = req.body;
      if (!newPassword || typeof newPassword !== "string") {
        return res.status(400).json({ error: "New password is required." });
      }

      // Backend strong password validation
      const validation = validatePassword(newPassword);
      if (!validation.valid) {
        return res.status(400).json({
          error: "Password does not meet the security requirements.",
          details: validation.errors,
        });
      }

      // Update password via Google Identity Toolkit
      const updateUrl = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`;
      const updateRes = await fetch(updateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          password: newPassword,
          returnSecureToken: true,
        }),
      });

      const updateData = await updateRes.json();
      if (!updateRes.ok) {
        return res.status(400).json({ error: updateData?.error?.message || "Failed to update password." });
      }

      // Never log or return the password in the response
      return res.json({ message: "Password updated successfully." });
    } catch (error: any) {
      console.error("Change Password Error:", error?.message || "Internal error");
      return res.status(500).json({ error: "Failed to update password. Please try again." });
    }
  });

  // 6. Direct Password Validation Endpoint (for API checks and testing)
  app.post("/api/auth/validate-password", (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkIpRateLimit(`validate-pwd:ip:${clientIp}`, 60, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests. Please wait a minute." });
    }

    const { password } = req.body;
    const validation = validatePassword(password);
    if (!validation.valid) {
      return res.status(400).json({
        valid: false,
        error: "Password does not meet security requirements.",
        details: validation.errors,
      });
    }

    return res.json({
      valid: true,
      message: "Password satisfies all security requirements.",
    });
  });

  // Helper to retrieve Cloudinary configuration securely from environment variables
  const getCloudinaryConfig = () => {
    let apiKeyVal = process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_KEY;
    let apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_SECRET;
    let cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || "ddc64bq61";

    if ((!apiKeyVal || !apiSecret) && process.env.CLOUDINARY_URL) {
      try {
        const parsed = new URL(process.env.CLOUDINARY_URL);
        if (!apiKeyVal && parsed.username) apiKeyVal = decodeURIComponent(parsed.username);
        if (!apiSecret && parsed.password) apiSecret = decodeURIComponent(parsed.password);
        if (parsed.hostname) cloudName = parsed.hostname;
      } catch (e) {
        console.warn("Could not parse CLOUDINARY_URL:", e);
      }
    }

    apiKeyVal = apiKeyVal ? apiKeyVal.trim().replace(/^["']|["']$/g, "") : undefined;
    apiSecret = apiSecret ? apiSecret.trim().replace(/^["']|["']$/g, "") : undefined;
    cloudName = cloudName ? cloudName.trim().replace(/^["']|["']$/g, "") : "ddc64bq61";

    return { apiKeyVal, apiSecret, cloudName };
  };

  // 4. Authenticated Image Upload Proxy (Validates Firebase Auth ID token and payload format)
  app.post("/api/upload/image", express.json({ limit: "6mb" }), async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkIpRateLimit(`upload-image:${clientIp}`, 30, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many upload requests. Please wait a few minutes." });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required for image upload." });
      }
      const idToken = authHeader.split(" ")[1];
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid or expired authentication session." });
      }

      const { file, folder } = req.body;
      if (!file || typeof file !== "string") {
        return res.status(400).json({ error: "Missing image data payload." });
      }

      const allowedFolders = ["studentneed/listings", "studentneed/avatars"];
      const uploadFolder = allowedFolders.includes(folder) ? folder : "studentneed/listings";

      // Validate base64/data URI image format and size
      let mimeType = "";
      if (file.startsWith("data:")) {
        const mimeMatch = file.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
        if (mimeMatch) {
          mimeType = mimeMatch[1].toLowerCase();
        }
      }
      const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
      if (mimeType && !allowedMimes.includes(mimeType)) {
        return res.status(400).json({ error: "Invalid image format. Only JPEG, PNG, and WebP are allowed." });
      }

      const { apiKeyVal, apiSecret, cloudName } = getCloudinaryConfig();

      if (!apiSecret || !apiKeyVal) {
        return res.status(500).json({ error: "Storage service configuration error: Cloudinary signing credentials missing on the server." });
      }

      const timestamp = Math.round(Date.now() / 1000);
      const stringToSign = `folder=${uploadFolder}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash("sha1").update(stringToSign).digest("hex");

      const formData = new URLSearchParams();
      formData.append("file", file);
      formData.append("folder", uploadFolder);
      formData.append("timestamp", timestamp.toString());
      formData.append("api_key", apiKeyVal);
      formData.append("signature", signature);

      const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });

      const cloudData = await cloudRes.json();
      if (!cloudRes.ok || !cloudData.secure_url) {
        return res.status(cloudRes.status || 500).json({ error: cloudData?.error?.message || "Failed to upload image to storage." });
      }

      return res.json({ secure_url: cloudData.secure_url });
    } catch (err: any) {
      console.error("Backend image upload error:", err);
      return res.status(500).json({ error: "Internal error processing image upload." });
    }
  });

  // 5. Backend Upload Signature Generator for Signed Cloudinary Uploads
  app.post("/api/upload/signature", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkIpRateLimit(`upload-sig:${clientIp}`, 30, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many upload requests. Please wait a few minutes." });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required for upload signature." });
      }
      const idToken = authHeader.split(" ")[1];
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid or expired authentication session." });
      }

      const { folder } = req.body;
      const allowedFolders = ["studentneed/listings", "studentneed/avatars"];
      const uploadFolder = allowedFolders.includes(folder) ? folder : "studentneed/listings";
      const { apiKeyVal, apiSecret, cloudName } = getCloudinaryConfig();

      if (!apiSecret || !apiKeyVal) {
        return res.status(500).json({
          error: "Cloudinary signing credentials are not configured on the server."
        });
      }

      // Compute Cloudinary SHA-1 signature
      const timestamp = Math.round(Date.now() / 1000);
      const stringToSign = `folder=${uploadFolder}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash("sha1").update(stringToSign).digest("hex");

      return res.json({
        signed: true,
        signature,
        timestamp,
        apiKey: apiKeyVal,
        cloudName,
        folder: uploadFolder
      });
    } catch (err: any) {
      console.error("Upload signature error:", err);
      return res.status(500).json({ error: "Failed to generate upload signature." });
    }
  });

  // --- Event-Driven Notification System Helper ---
  interface ServerNotificationInput {
    notificationId?: string;
    recipientUid: string;
    type: "chat" | "reservation" | "request" | "listing" | "system";
    title: string;
    body: string;
    targetType: "chat" | "reservation" | "listing" | "request" | "system";
    targetId: string;
    actorUid?: string;
    actorName?: string;
    eventId?: string;
    link?: string;
    metadata?: Record<string, any>;
  }

  async function createServerNotification(notif: ServerNotificationInput): Promise<string> {
    const systemToken = await getServerToken();
    const cleanEventId = notif.eventId ? notif.eventId.replace(/[^a-zA-Z0-9_-]/g, "_") : "";
    const effectiveId =
      notif.notificationId ||
      (cleanEventId
        ? `notif_${cleanEventId}_${notif.recipientUid}`
        : `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);

    const notifUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/notifications/${effectiveId}`;

    if (systemToken) {
      try {
        await fetch(notifUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${systemToken}`,
          },
          body: JSON.stringify({
            fields: {
              notificationId: { stringValue: effectiveId },
              recipientUid: { stringValue: notif.recipientUid },
              type: { stringValue: notif.type },
              title: { stringValue: notif.title },
              body: { stringValue: notif.body },
              createdAt: { timestampValue: new Date().toISOString() },
              read: { booleanValue: false },
              readAt: { nullValue: null },
              targetType: { stringValue: notif.targetType },
              targetId: { stringValue: notif.targetId },
              actorUid: { stringValue: notif.actorUid || "" },
              actorName: { stringValue: notif.actorName || "" },
              eventId: { stringValue: notif.eventId || "" },
              link: { stringValue: notif.link || "" },
            },
          }),
        });
      } catch (err) {
        console.warn("[Notifications] Failed to write notification to Firestore:", err);
      }
    }
    return effectiveId;
  }

  // 6. Atomic Reservation Acceptance & Listing Status Synchronization
  app.post("/api/reservations/accept", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkIpRateLimit(`accept-res:${clientIp}`, 20, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many acceptance requests. Please wait a few minutes." });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const idToken = authHeader.split(" ")[1];
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid or expired authentication session." });
      }
      const callerUid = verifyData.users[0].localId;

      const { reservationId } = req.body;
      if (!reservationId || typeof reservationId !== "string") {
        return res.status(400).json({ error: "reservationId is required." });
      }

      const systemToken = await getServerToken();
      const effectiveToken = systemToken || idToken;

      // 1. Fetch reservation document
      const resUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/reservations/${reservationId}`;
      const resDocResponse = await fetch(resUrl, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      if (resDocResponse.status === 404) {
        return res.status(404).json({ error: "Reservation not found." });
      }
      const resJson = await resDocResponse.json();
      const fields = resJson.fields || {};
      const sellerId = fields.sellerId?.stringValue;
      const listingId = fields.listingId?.stringValue;
      const currentStatus = fields.status?.stringValue;

      // Verify caller is the seller
      if (callerUid !== sellerId) {
        return res.status(403).json({ error: "Only the seller can accept a reservation request." });
      }

      // Verify reservation is pending
      if (currentStatus !== "pending") {
        return res.status(400).json({ error: `Cannot accept reservation from '${currentStatus}' status. Must be 'pending'.` });
      }

      if (!listingId) {
        return res.status(400).json({ error: "Reservation is missing listingId." });
      }

      // 2. Fetch associated listing document
      const listingUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/listings/${listingId}`;
      const listingRes = await fetch(listingUrl, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      if (!listingRes.ok) {
        return res.status(404).json({ error: "Associated listing not found." });
      }
      const listingJson = await listingRes.json();
      const listingFields = listingJson.fields || {};
      const listingSellerId = listingFields.sellerId?.stringValue;
      const listingStatus = listingFields.status?.stringValue;

      if (listingSellerId !== callerUid) {
        return res.status(403).json({ error: "Reservation seller does not match listing owner." });
      }

      // 3. STRICT ATOMIC CHECK: Listing MUST be available or active
      if (listingStatus !== "available" && listingStatus !== "active") {
        return res.status(409).json({
          error: `Cannot accept reservation: this listing is already '${listingStatus}' by another reservation.`,
          listingStatus,
        });
      }

      const nowIso = new Date().toISOString();

      // 4. Atomic Commit with write preconditions to prevent multi-acceptance race conditions
      const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents:commit`;
      const commitPayload = {
        writes: [
          {
            updateMask: { fieldPaths: ["status", "updatedAt"] },
            update: {
              name: listingJson.name,
              fields: {
                ...listingFields,
                status: { stringValue: "reserved" },
                updatedAt: { timestampValue: nowIso },
              },
            },
            currentDocument: { updateTime: listingJson.updateTime },
          },
          {
            updateMask: { fieldPaths: ["status", "updatedAt", "acceptedAt", "acceptedBy"] },
            update: {
              name: resJson.name,
              fields: {
                ...fields,
                status: { stringValue: "accepted" },
                updatedAt: { timestampValue: nowIso },
                acceptedAt: { timestampValue: nowIso },
                acceptedBy: { stringValue: callerUid },
              },
            },
            currentDocument: { updateTime: resJson.updateTime },
          },
        ],
      };

      const commitRes = await fetch(commitUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify(commitPayload),
      });

      if (!commitRes.ok) {
        const commitErr = await commitRes.json().catch(() => ({}));
        if (commitRes.status === 409 || commitRes.status === 412 || commitErr?.error?.status === "ABORTED" || commitErr?.error?.status === "FAILED_PRECONDITION") {
          return res.status(409).json({
            error: "Concurrent reservation conflict detected: another reservation or status change was processed first.",
          });
        }
        console.error("Atomic accept commit error:", commitErr);
        return res.status(commitRes.status || 500).json({ error: "Failed to atomically accept reservation." });
      }

      const buyerId = fields.buyerId?.stringValue;
      if (buyerId) {
        const listingTitle = listingFields.title?.stringValue || "your reserved item";
        const targetChatId = fields.chatId?.stringValue;
        const targetUrl = targetChatId ? `/chat/${targetChatId}` : "/reserved";

        // Create persistent event-driven Firestore notification
        await createServerNotification({
          notificationId: `notif_res_accepted_${reservationId}_${buyerId}`,
          recipientUid: buyerId,
          type: "reservation",
          title: "Reservation Accepted! 🎉",
          body: `The seller accepted your meetup request for "${listingTitle}".`,
          targetType: "reservation",
          targetId: reservationId,
          actorUid: callerUid,
          eventId: `res_${reservationId}_accepted`,
          link: targetUrl,
          metadata: { reservationId, listingId, chatId: targetChatId || "" },
        }).catch((err) => console.warn("[Notifications] Accept notification write warning:", err));

        sendPushToUser(buyerId, {
          title: "Reservation Accepted! 🎉",
          body: `The seller accepted your meetup request for "${listingTitle}".`,
          url: targetUrl,
          tag: `res_${reservationId}`,
          data: {
            type: "reservation_accepted",
            reservationId,
            chatId: targetChatId || "",
            url: targetUrl,
          },
        }).catch((err) => console.warn("[WebPush] Accept reservation push warning:", err));
      }

      return res.json({
        message: "Reservation successfully accepted. Listing is now reserved.",
        reservationId,
        listingId,
        status: "accepted",
      });
    } catch (err: any) {
      console.error("Accept reservation error:", err);
      return res.status(500).json({ error: "Internal server error accepting reservation." });
    }
  });

  // 7. Authorized Reservation Completion & Listing Status Synchronization
  app.post("/api/reservations/complete", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkIpRateLimit(`complete-res:${clientIp}`, 20, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many completion requests. Please wait a few minutes." });
      }
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const idToken = authHeader.split(" ")[1];
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid or expired authentication session." });
      }
      const callerUid = verifyData.users[0].localId;

      const { reservationId } = req.body;
      if (!reservationId || typeof reservationId !== "string") {
        return res.status(400).json({ error: "reservationId is required." });
      }

      const systemToken = await getServerToken();
      // Fetch reservation document from Firestore REST
      const resUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/reservations/${reservationId}`;
      const resDocResponse = await fetch(resUrl, {
        headers: { Authorization: `Bearer ${systemToken}` }
      });
      if (resDocResponse.status === 404) {
        return res.status(404).json({ error: "Reservation not found." });
      }
      const resJson = await resDocResponse.json();
      const fields = resJson.fields || {};
      const buyerId = fields.buyerId?.stringValue;
      const sellerId = fields.sellerId?.stringValue;
      const listingId = fields.listingId?.stringValue;
      const currentStatus = fields.status?.stringValue;

      // Verify caller is buyer or seller
      if (callerUid !== buyerId && callerUid !== sellerId) {
        return res.status(403).json({ error: "Only reservation participants can complete the exchange." });
      }

      // Verify status is accepted
      if (currentStatus !== "accepted") {
        return res.status(400).json({ error: `Cannot complete reservation from '${currentStatus}' status. Must be 'accepted'.` });
      }

      // Verify listing
      if (!listingId) {
        return res.status(400).json({ error: "Reservation is missing listingId." });
      }
      const listingUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/listings/${listingId}`;
      const listingRes = await fetch(listingUrl, {
        headers: { Authorization: `Bearer ${systemToken}` }
      });
      if (!listingRes.ok) {
        return res.status(400).json({ error: "Associated listing not found." });
      }
      const listingJson = await listingRes.json();
      const listingSellerId = listingJson.fields?.sellerId?.stringValue;
      if (listingSellerId !== sellerId) {
        return res.status(400).json({ error: "Reservation seller does not match listing owner." });
      }

      const nowIso = new Date().toISOString();

      // Update reservation to completed
      await fetch(resUrl + `?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=completedAt&updateMask.fieldPaths=completedBy`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${systemToken}`,
        },
        body: JSON.stringify({
          fields: {
            ...fields,
            status: { stringValue: "completed" },
            updatedAt: { timestampValue: nowIso },
            completedAt: { timestampValue: nowIso },
            completedBy: { stringValue: callerUid },
          }
        })
      });

      // Update listing status to completed
      await fetch(listingUrl + `?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${systemToken}`,
        },
        body: JSON.stringify({
          fields: {
            ...listingJson.fields,
            status: { stringValue: "completed" },
            updatedAt: { timestampValue: nowIso },
          }
        })
      });

      const counterpartyUid = callerUid === buyerId ? sellerId : buyerId;
      if (counterpartyUid) {
        const listingTitle = listingJson.fields?.title?.stringValue || "your exchange item";
        const targetChatId = fields.chatId?.stringValue;
        const targetUrl = targetChatId ? `/chat/${targetChatId}` : "/reserved";

        await createServerNotification({
          notificationId: `notif_res_completed_${reservationId}_${counterpartyUid}`,
          recipientUid: counterpartyUid,
          type: "reservation",
          title: "Exchange Completed ✅",
          body: `Your exchange for "${listingTitle}" has been marked complete!`,
          targetType: "reservation",
          targetId: reservationId,
          actorUid: callerUid,
          eventId: `res_${reservationId}_completed`,
          link: targetUrl,
          metadata: { reservationId, listingId: fields.listingId?.stringValue || "", chatId: targetChatId || "" },
        }).catch((err) => console.warn("[Notifications] Complete notification write warning:", err));

        sendPushToUser(counterpartyUid, {
          title: "Exchange Completed ✅",
          body: `Your exchange for "${listingTitle}" has been marked complete!`,
          url: targetUrl,
          tag: `res_${reservationId}`,
          data: {
            type: "reservation_completed",
            reservationId,
            chatId: targetChatId || "",
            url: targetUrl,
          },
        }).catch((err) => console.warn("[WebPush] Complete reservation push warning:", err));
      }

      return res.json({ message: "Reservation and listing successfully marked as completed." });
    } catch (err: any) {
      console.error("Complete reservation error:", err);
      return res.status(500).json({ error: "Internal server error completing reservation." });
    }
  });

  app.post("/api/reservations/cancel", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkIpRateLimit(`cancel-res:${clientIp}`, 20, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many cancellation requests. Please wait a few minutes." });
      }
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const idToken = authHeader.split(" ")[1];
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid or expired authentication session." });
      }
      const callerUid = verifyData.users[0].localId;

      const { reservationId } = req.body;
      if (!reservationId || typeof reservationId !== "string") {
        return res.status(400).json({ error: "reservationId is required." });
      }

      const systemToken = await getServerToken();
      if (!systemToken) {
        return res.status(503).json({ error: "System authentication service unavailable." });
      }

      // Fetch reservation document from Firestore REST
      const resUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/reservations/${reservationId}`;
      const resDocResponse = await fetch(resUrl, {
        headers: { Authorization: `Bearer ${systemToken}` }
      });
      if (resDocResponse.status === 404) {
        return res.status(404).json({ error: "Reservation not found." });
      }
      const resJson = await resDocResponse.json();
      const fields = resJson.fields || {};
      const buyerId = fields.buyerId?.stringValue;
      const sellerId = fields.sellerId?.stringValue;
      const listingId = fields.listingId?.stringValue;
      const currentStatus = fields.status?.stringValue;

      // Status-dependent participant check:
      // 1. If status is pending: ONLY the buyer can cancel
      // 2. If status is accepted: either the buyer or seller can cancel
      // 3. Otherwise: cannot cancel terminal states (completed, rejected, cancelled)
      if (currentStatus === "pending") {
        if (callerUid !== buyerId) {
          return res.status(403).json({ error: "Only the buyer can cancel a pending reservation request." });
        }
      } else if (currentStatus === "accepted") {
        if (callerUid !== buyerId && callerUid !== sellerId) {
          return res.status(403).json({ error: "Only reservation participants can cancel the reservation." });
        }
      } else {
        return res.status(400).json({ error: `Cannot cancel reservation from '${currentStatus}' status.` });
      }

      const nowIso = new Date().toISOString();

      // Update reservation to cancelled
      await fetch(resUrl + `?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=cancelledAt&updateMask.fieldPaths=cancelledBy`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${systemToken}`,
        },
        body: JSON.stringify({
          fields: {
            ...fields,
            status: { stringValue: "cancelled" },
            updatedAt: { timestampValue: nowIso },
            cancelledAt: { timestampValue: nowIso },
            cancelledBy: { stringValue: callerUid },
          }
        })
      });

      // If the reservation was accepted, revert the associated listing from 'reserved' back to 'available'
      if (currentStatus === "accepted" && listingId) {
        const listingUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/listings/${listingId}`;
        const listingRes = await fetch(listingUrl, {
          headers: { Authorization: `Bearer ${systemToken}` }
        });
        if (listingRes.ok) {
          const listingJson = await listingRes.json();
          const currentListingStatus = listingJson.fields?.status?.stringValue;
          if (currentListingStatus === "reserved") {
            await fetch(listingUrl + `?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${systemToken}`,
              },
              body: JSON.stringify({
                fields: {
                  ...listingJson.fields,
                  status: { stringValue: "available" },
                  updatedAt: { timestampValue: nowIso },
                }
              })
            });
          }
        }
      }

      const targetUser = callerUid === buyerId ? sellerId : buyerId;
      if (targetUser) {
        const targetChatId = fields.chatId?.stringValue;
        const targetUrl = targetChatId ? `/chat/${targetChatId}` : "/reserved";

        await createServerNotification({
          notificationId: `notif_res_cancelled_${reservationId}_${targetUser}`,
          recipientUid: targetUser,
          type: "reservation",
          title: "Reservation Cancelled",
          body: "A reservation request has been cancelled.",
          targetType: "reservation",
          targetId: reservationId,
          actorUid: callerUid,
          eventId: `res_${reservationId}_cancelled`,
          link: targetUrl,
          metadata: { reservationId, chatId: targetChatId || "" },
        }).catch((err) => console.warn("[Notifications] Cancel notification write warning:", err));

        sendPushToUser(targetUser, {
          title: "Reservation Cancelled",
          body: "A reservation request has been cancelled.",
          url: targetUrl,
          tag: `res_${reservationId}`,
          data: {
            type: "reservation_cancelled",
            reservationId,
            chatId: targetChatId || "",
            url: targetUrl,
          },
        }).catch((err) => console.warn("[WebPush] Cancel reservation push warning:", err));
      }

      return res.json({ message: "Reservation successfully cancelled." });
    } catch (err: any) {
      console.error("Cancel reservation error:", err);
      return res.status(500).json({ error: "Internal server error cancelling reservation." });
    }
  });

  // 7b. Notify Seller of New Reservation Request
  app.post("/api/reservations/notify-created", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const idToken = authHeader.split(" ")[1];
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid authentication session." });
      }
      const callerUid = verifyData.users[0].localId;

      const { reservationId } = req.body || {};
      if (!reservationId || typeof reservationId !== "string") {
        return res.status(400).json({ error: "reservationId is required." });
      }

      const systemToken = await getServerToken();
      const effectiveToken = systemToken || idToken;

      const resDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/reservations/${reservationId}`;
      const resDocRes = await fetch(resDocUrl, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      if (!resDocRes.ok) {
        return res.status(resDocRes.status).json({ error: "Reservation document not found." });
      }
      const resJson = await resDocRes.json();
      const fields = resJson.fields || {};
      const buyerId = fields.buyerId?.stringValue;
      const sellerId = fields.sellerId?.stringValue;
      const listingId = fields.listingId?.stringValue;
      const chatId = fields.chatId?.stringValue;

      if (callerUid !== buyerId) {
        return res.status(403).json({ error: "Forbidden: You are not the creator of this reservation." });
      }
      if (!sellerId || sellerId === buyerId) {
        return res.status(400).json({ error: "Invalid reservation participants." });
      }

      let listingTitle = "an item";
      try {
        const listingDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/listings/${listingId}`;
        const lRes = await fetch(listingDocUrl, { headers: { Authorization: `Bearer ${effectiveToken}` } });
        if (lRes.ok) {
          const lJson = await lRes.json();
          listingTitle = lJson.fields?.title?.stringValue || "an item";
        }
      } catch {}

      let buyerName = "A campus student";
      try {
        const userDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${buyerId}`;
        const uRes = await fetch(userDocUrl, { headers: { Authorization: `Bearer ${effectiveToken}` } });
        if (uRes.ok) {
          const uJson = await uRes.json();
          buyerName = uJson.fields?.name?.stringValue || "A campus student";
        }
      } catch {}

      const targetUrl = chatId ? `/chat/${chatId}` : "/reserved";

      await createServerNotification({
        notificationId: `notif_res_created_${reservationId}_${sellerId}`,
        recipientUid: sellerId,
        type: "reservation",
        title: "New Reservation Request",
        body: `${buyerName} requested to reserve "${listingTitle}".`,
        targetType: "reservation",
        targetId: reservationId,
        actorUid: buyerId,
        actorName: buyerName,
        eventId: `res_${reservationId}_created`,
        link: targetUrl,
        metadata: { reservationId, listingId, chatId: chatId || "" },
      });

      sendPushToUser(sellerId, {
        title: "New Reservation Request",
        body: `${buyerName} requested to reserve "${listingTitle}".`,
        url: targetUrl,
        tag: `res_${reservationId}`,
        data: {
          type: "reservation_request",
          reservationId,
          chatId: chatId || "",
          url: targetUrl,
        },
      }).catch((err) => console.warn("[WebPush] New reservation push warning:", err));

      return res.json({ success: true, message: "Seller notified of reservation request." });
    } catch (err: any) {
      console.error("notify-created error:", err);
      return res.status(500).json({ error: "Failed to dispatch reservation notification." });
    }
  });

  // 7c. Authorized Reservation Decline
  app.post("/api/reservations/decline", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const idToken = authHeader.split(" ")[1];
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid authentication session." });
      }
      const callerUid = verifyData.users[0].localId;

      const { reservationId } = req.body || {};
      if (!reservationId || typeof reservationId !== "string") {
        return res.status(400).json({ error: "reservationId is required." });
      }

      const systemToken = await getServerToken();
      const effectiveToken = systemToken || idToken;

      const resDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/reservations/${reservationId}`;
      const resDocRes = await fetch(resDocUrl, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      if (!resDocRes.ok) {
        return res.status(resDocRes.status).json({ error: "Reservation not found." });
      }
      const resJson = await resDocRes.json();
      const fields = resJson.fields || {};
      const sellerId = fields.sellerId?.stringValue;
      const buyerId = fields.buyerId?.stringValue;
      const listingId = fields.listingId?.stringValue;
      const chatId = fields.chatId?.stringValue;

      if (callerUid !== sellerId) {
        return res.status(403).json({ error: "Forbidden: Only the seller can decline this reservation." });
      }

      const nowIso = new Date().toISOString();
      await fetch(resDocUrl + `?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({
          fields: {
            ...fields,
            status: { stringValue: "rejected" },
            updatedAt: { timestampValue: nowIso },
          },
        }),
      });

      let listingTitle = "your reserved item";
      try {
        const listingDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/listings/${listingId}`;
        const lRes = await fetch(listingDocUrl, { headers: { Authorization: `Bearer ${effectiveToken}` } });
        if (lRes.ok) {
          const lJson = await lRes.json();
          listingTitle = lJson.fields?.title?.stringValue || "your reserved item";
        }
      } catch {}

      if (buyerId) {
        const targetUrl = chatId ? `/chat/${chatId}` : "/reserved";

        await createServerNotification({
          notificationId: `notif_res_declined_${reservationId}_${buyerId}`,
          recipientUid: buyerId,
          type: "reservation",
          title: "Reservation Declined",
          body: `Your reservation request for "${listingTitle}" was declined.`,
          targetType: "reservation",
          targetId: reservationId,
          actorUid: callerUid,
          eventId: `res_${reservationId}_declined`,
          link: targetUrl,
          metadata: { reservationId, listingId, chatId: chatId || "" },
        });

        sendPushToUser(buyerId, {
          title: "Reservation Declined",
          body: `Your reservation request for "${listingTitle}" was declined.`,
          url: targetUrl,
          tag: `res_${reservationId}`,
          data: {
            type: "reservation_declined",
            reservationId,
            chatId: chatId || "",
            url: targetUrl,
          },
        }).catch((err) => console.warn("[WebPush] Decline reservation push warning:", err));
      }

      return res.json({ success: true, message: "Reservation successfully declined." });
    } catch (err: any) {
      console.error("decline reservation error:", err);
      return res.status(500).json({ error: "Failed to decline reservation." });
    }
  });

  // 7d. Notify Counterparty of Meetup Status Confirmation or Proposal
  app.post("/api/reservations/notify-meetup", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const idToken = authHeader.split(" ")[1];
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid authentication session." });
      }
      const callerUid = verifyData.users[0].localId;

      const { reservationId, status: meetupStatus, location } = req.body || {};
      if (!reservationId) return res.status(400).json({ error: "reservationId is required." });

      const systemToken = await getServerToken();
      const effectiveToken = systemToken || idToken;

      const resDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/reservations/${reservationId}`;
      const resDocRes = await fetch(resDocUrl, { headers: { Authorization: `Bearer ${effectiveToken}` } });
      if (!resDocRes.ok) return res.status(404).json({ error: "Reservation not found." });
      const resJson = await resDocRes.json();
      const fields = resJson.fields || {};
      const sellerId = fields.sellerId?.stringValue;
      const buyerId = fields.buyerId?.stringValue;
      const chatId = fields.chatId?.stringValue;

      if (callerUid !== sellerId && callerUid !== buyerId) {
        return res.status(403).json({ error: "Forbidden: You are not a party to this reservation." });
      }

      const counterpartyUid = callerUid === buyerId ? sellerId : buyerId;
      if (!counterpartyUid) return res.json({ success: true });

      const isConfirmed = meetupStatus === "confirmed";
      const title = isConfirmed ? "Meetup Confirmed 📍" : "Meetup Proposed 📍";
      const body = isConfirmed
        ? `Meetup location "${location || "Campus"}" was confirmed.`
        : `A meetup at "${location || "Campus"}" was proposed.`;

      const targetUrl = chatId ? `/chat/${chatId}` : "/reserved";

      await createServerNotification({
        notificationId: `notif_meetup_${reservationId}_${isConfirmed ? "confirmed" : "proposed"}_${counterpartyUid}`,
        recipientUid: counterpartyUid,
        type: "reservation",
        title,
        body,
        targetType: "reservation",
        targetId: reservationId,
        actorUid: callerUid,
        eventId: `res_${reservationId}_meetup_${isConfirmed ? "confirmed" : "proposed"}`,
        link: targetUrl,
        metadata: { reservationId, chatId: chatId || "", location: location || "" },
      });

      sendPushToUser(counterpartyUid, {
        title,
        body,
        url: targetUrl,
        tag: `res_${reservationId}`,
        data: {
          type: "meetup_update",
          reservationId,
          chatId: chatId || "",
          url: targetUrl,
        },
      }).catch((err) => console.warn("[WebPush] Meetup update push warning:", err));

      return res.json({ success: true, message: "Counterparty notified of meetup status." });
    } catch (err: any) {
      console.error("notify-meetup error:", err);
      return res.status(500).json({ error: "Failed to dispatch meetup notification." });
    }
  });

  // 7e. Notify Requester of Response to Campus Request
  app.post("/api/requests/notify-response", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const idToken = authHeader.split(" ")[1];
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid authentication session." });
      }
      const callerUid = verifyData.users[0].localId;

      const { requestId, chatId } = req.body || {};
      if (!requestId) return res.status(400).json({ error: "requestId is required." });

      const systemToken = await getServerToken();
      const effectiveToken = systemToken || idToken;

      // Check requests collection first, fallback to item_requests
      let reqDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/requests/${requestId}`;
      let reqRes = await fetch(reqDocUrl, { headers: { Authorization: `Bearer ${effectiveToken}` } });
      if (!reqRes.ok) {
        reqDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/item_requests/${requestId}`;
        reqRes = await fetch(reqDocUrl, { headers: { Authorization: `Bearer ${effectiveToken}` } });
      }
      if (!reqRes.ok) return res.status(404).json({ error: "Request not found." });
      const reqJson = await reqRes.json();
      const requesterId = reqJson.fields?.requesterId?.stringValue;
      const requestTitle = reqJson.fields?.title?.stringValue || "campus item";

      // Server-side expiry validation: Expired requests must not accept new responses
      let expiresAtMs: number | null = null;
      if (reqJson.fields?.expiresAt?.timestampValue) {
        expiresAtMs = Date.parse(reqJson.fields.expiresAt.timestampValue);
      } else if (reqJson.fields?.expiresAt?.stringValue) {
        expiresAtMs = Date.parse(reqJson.fields.expiresAt.stringValue);
      }

      const reqStatus = reqJson.fields?.status?.stringValue;
      if (reqStatus === "expired" || (expiresAtMs !== null && !isNaN(expiresAtMs) && expiresAtMs <= Date.now())) {
        return res.status(400).json({ error: "This request has expired and is no longer accepting new responses." });
      }

      if (reqStatus === "cancelled" || reqStatus === "completed") {
        return res.status(400).json({ error: "This request is no longer active." });
      }

      if (callerUid === requesterId) {
        return res.status(400).json({ error: "Cannot notify self on own request." });
      }

      let callerName = "A campus student";
      try {
        const uRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${callerUid}`,
          { headers: { Authorization: `Bearer ${effectiveToken}` } }
        );
        if (uRes.ok) {
          const uJson = await uRes.json();
          callerName = uJson.fields?.name?.stringValue || "A campus student";
        }
      } catch {}

      const targetUrl = chatId ? `/chat/${chatId}` : "/requests";

      await createServerNotification({
        notificationId: `notif_req_${requestId}_${callerUid}_${requesterId}`,
        recipientUid: requesterId,
        type: "request",
        title: "New Response to Your Request",
        body: `${callerName} offered to help with your request for "${requestTitle}".`,
        targetType: "request",
        targetId: requestId,
        actorUid: callerUid,
        actorName: callerName,
        eventId: `req_${requestId}_${callerUid}`,
        link: targetUrl,
        metadata: { requestId, chatId: chatId || "" },
      });

      sendPushToUser(requesterId, {
        title: "New Response to Your Request",
        body: `${callerName} offered to help with your request for "${requestTitle}".`,
        url: targetUrl,
        tag: `req_${requestId}`,
        data: {
          type: "request_response",
          requestId,
          chatId: chatId || "",
          url: targetUrl,
        },
      }).catch((err) => console.warn("[WebPush] Request response push warning:", err));

      return res.json({ success: true, message: "Requester notified." });
    } catch (err: any) {
      console.error("notify-response error:", err);
      return res.status(500).json({ error: "Failed to notify requester." });
    }
  });

  // 7f. Bulk Mark All Notifications As Read for Caller
  app.post("/api/notifications/mark-all-read", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const idToken = authHeader.split(" ")[1];
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid authentication session." });
      }
      const callerUid = verifyData.users[0].localId;

      const systemToken = await getServerToken();
      const effectiveToken = systemToken || idToken;

      // Query unread notifications for caller
      const runQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents:runQuery`;
      const queryPayload = {
        structuredQuery: {
          from: [{ collectionId: "notifications" }],
          where: {
            compositeFilter: {
              op: "AND",
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: "recipientUid" },
                    op: "EQUAL",
                    value: { stringValue: callerUid },
                  },
                },
                {
                  fieldFilter: {
                    field: { fieldPath: "read" },
                    op: "EQUAL",
                    value: { booleanValue: false },
                  },
                },
              ],
            },
          },
          limit: 100,
        },
      };

      const queryRes = await fetch(runQueryUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify(queryPayload),
      });

      let updatedCount = 0;
      if (queryRes.ok) {
        const docs = await queryRes.json();
        const nowIso = new Date().toISOString();
        for (const item of docs) {
          if (item.document?.name) {
            await fetch(item.document.name + `?updateMask.fieldPaths=read&updateMask.fieldPaths=readAt`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${effectiveToken}`,
              },
              body: JSON.stringify({
                fields: {
                  ...item.document.fields,
                  read: { booleanValue: true },
                  readAt: { timestampValue: nowIso },
                },
              }),
            }).catch(() => {});
            updatedCount++;
          }
        }
      }

      return res.json({ success: true, updatedCount });
    } catch (err: any) {
      console.error("mark-all-read error:", err);
      return res.status(500).json({ error: "Failed to mark all as read." });
    }
  });

  // --- Real Mobile & Desktop Web Push Notification System ---

  interface PushSubscriptionDevice {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
    userAgent?: string;
    updatedAt: string;
  }

  // In-memory development fallback store for push subscriptions when system token is not configured
  const devPushStore = new Map<string, Record<string, PushSubscriptionDevice>>();

  // FCM v1 REST API Dispatch
  async function sendFcmToUser(
    userId: string,
    payload: { title: string; body: string; url?: string; tag?: string; data?: any }
  ): Promise<{ sent: number; failed: number; pruned: number }> {
    let sent = 0;
    let failed = 0;
    let pruned = 0;

    try {
      const systemToken = await getServerToken();
      const fcmDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${userId}/private/fcm_tokens`;

      const fcmDocRes = await fetch(fcmDocUrl, {
        headers: systemToken ? { Authorization: `Bearer ${systemToken}` } : {},
      });

      if (!fcmDocRes.ok) {
        return { sent: 0, failed: 0, pruned: 0 };
      }

      const fcmDocJson = await fcmDocRes.json();
      const fields = fcmDocJson.fields || {};

      const tokens: string[] = [];
      if (fields.token?.stringValue) {
        tokens.push(fields.token.stringValue);
      }
      if (fields.tokens?.arrayValue?.values) {
        for (const val of fields.tokens.arrayValue.values) {
          if (val.stringValue && !tokens.includes(val.stringValue)) {
            tokens.push(val.stringValue);
          }
        }
      }
      if (fields.tokensJson?.stringValue) {
        try {
          const parsed = JSON.parse(fields.tokensJson.stringValue);
          if (Array.isArray(parsed)) {
            for (const t of parsed) {
              if (typeof t === "string" && !tokens.includes(t)) tokens.push(t);
            }
          }
        } catch {}
      }

      if (tokens.length === 0) {
        return { sent: 0, failed: 0, pruned: 0 };
      }

      let fcmAccessToken: string | null = null;
      try {
        const fcmAuth = new GoogleAuth({
          scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
        });
        const client = await fcmAuth.getClient();
        const tokenRes = await client.getAccessToken();
        fcmAccessToken = tokenRes?.token || null;
      } catch (authErr: any) {
        console.warn("[FCM] GoogleAuth credential acquisition notice:", authErr?.message || authErr);
      }

      if (!fcmAccessToken) {
        console.warn("[FCM] Access token not available for FCM v1 send. If testing locally, ensure Google ADC or service account is configured.");
        return { sent: 0, failed: 0, pruned: 0 };
      }

      const fcmSendUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
      const tokensToKeep: string[] = [];

      for (const token of tokens) {
        try {
          const fcmMessage = {
            message: {
              token,
              notification: {
                title: payload.title,
                body: payload.body,
              },
              webpush: {
                headers: {
                  Urgency: "high",
                },
                notification: {
                  title: payload.title,
                  body: payload.body,
                  icon: "/studentneed-monogram.png",
                  badge: "/favicon.png",
                  tag: payload.tag || "studentneed_fcm",
                },
                fcm_options: {
                  link: payload.url || "/",
                },
              },
              data: {
                url: payload.url || "/",
                title: payload.title,
                body: payload.body,
                tag: payload.tag || "studentneed_fcm",
                chatId: String(payload.data?.chatId || ""),
                reservationId: String(payload.data?.reservationId || ""),
                requestId: String(payload.data?.requestId || ""),
              },
            },
          };

          const res = await fetch(fcmSendUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${fcmAccessToken}`,
            },
            body: JSON.stringify(fcmMessage),
          });

          if (res.ok) {
            sent++;
            tokensToKeep.push(token);
          } else {
            failed++;
            const errData: any = await res.json().catch(() => ({}));
            const errorCode = errData?.error?.details?.[0]?.errorCode || errData?.error?.status || "";
            if (
              res.status === 404 ||
              res.status === 410 ||
              errorCode === "UNREGISTERED" ||
              errorCode === "INVALID_ARGUMENT"
            ) {
              pruned++;
              console.log(`[FCM] Token expired or unregistered for user ${userId}, pruning.`);
            } else {
              tokensToKeep.push(token);
              console.warn(`[FCM] Dispatch error (${res.status}):`, errData?.error?.message || errData);
            }
          }
        } catch (sendErr: any) {
          failed++;
          tokensToKeep.push(token);
          console.warn("[FCM] Network error sending to token:", sendErr?.message || sendErr);
        }
      }

      if (pruned > 0 && systemToken) {
        if (tokensToKeep.length === 0) {
          await fetch(fcmDocUrl, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${systemToken}` },
          }).catch(() => {});
        } else {
          await fetch(fcmDocUrl, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${systemToken}`,
            },
            body: JSON.stringify({
              fields: {
                token: { stringValue: tokensToKeep[0] },
                tokens: {
                  arrayValue: {
                    values: tokensToKeep.map((t) => ({ stringValue: t })),
                  },
                },
                tokensJson: { stringValue: JSON.stringify(tokensToKeep) },
                updatedAt: { timestampValue: new Date().toISOString() },
              },
            }),
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error("[FCM] sendFcmToUser unexpected error:", err);
    }

    return { sent, failed, pruned };
  }

  // Web Push VAPID Dispatch
  async function sendWebPushToUser(
    userId: string,
    payload: { title: string; body: string; url?: string; tag?: string; data?: any }
  ): Promise<{ sent: number; failed: number; pruned: number }> {
    if (!vapidPublicKey || !vapidPrivateKey) {
      return { sent: 0, failed: 0, pruned: 0 };
    }

    const systemToken = await getServerToken();
    const subDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${userId}/private/push_subscriptions`;

    let subscriptionsMap: Record<string, PushSubscriptionDevice> = {};

    if (systemToken) {
      try {
        const res = await fetch(subDocUrl, {
          headers: { Authorization: `Bearer ${systemToken}` },
        });

        if (res.ok) {
          const docJson = await res.json();
          const rawJson = docJson.fields?.subscriptionsJson?.stringValue;
          if (rawJson) {
            subscriptionsMap = JSON.parse(rawJson);
          }
        }
      } catch (err) {
        console.warn("[WebPush] Failed to fetch subscription from Firestore:", err);
      }
    } else {
      const cached = devPushStore.get(userId);
      if (cached) {
        subscriptionsMap = { ...cached };
      }
    }

    const deviceKeys = Object.keys(subscriptionsMap);
    if (deviceKeys.length === 0) {
      return { sent: 0, failed: 0, pruned: 0 };
    }

    let sent = 0;
    let failed = 0;
    let pruned = 0;
    const keysToRemove: string[] = [];

    const stringPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: "/studentneed-monogram.png",
      badge: "/favicon.png",
      url: payload.url || "/",
      tag: payload.tag || "default",
      data: payload.data || { url: payload.url || "/" },
    });

    for (const devKey of deviceKeys) {
      const devSub = subscriptionsMap[devKey];
      if (!devSub?.endpoint || !devSub?.keys?.p256dh || !devSub?.keys?.auth) {
        keysToRemove.push(devKey);
        pruned++;
        continue;
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: devSub.endpoint,
            keys: {
              p256dh: devSub.keys.p256dh,
              auth: devSub.keys.auth,
            },
          },
          stringPayload
        );
        sent++;
      } catch (err: any) {
        failed++;
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          keysToRemove.push(devKey);
          pruned++;
        } else {
          console.warn(`[WebPush] Push error on device ${devKey}:`, err?.message || err);
        }
      }
    }

    if (keysToRemove.length > 0) {
      for (const k of keysToRemove) {
        delete subscriptionsMap[k];
      }
      devPushStore.set(userId, subscriptionsMap);
      if (systemToken) {
        await fetch(
          subDocUrl +
            `?updateMask.fieldPaths=subscriptionsJson&updateMask.fieldPaths=deviceCount&updateMask.fieldPaths=updatedAt`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${systemToken}`,
            },
            body: JSON.stringify({
              fields: {
                subscriptionsJson: { stringValue: JSON.stringify(subscriptionsMap) },
                deviceCount: { integerValue: Object.keys(subscriptionsMap).length.toString() },
                updatedAt: { timestampValue: new Date().toISOString() },
              },
            }),
          }
        ).catch((err) => console.warn("[WebPush] Failed to prune expired subscriptions:", err));
      }
    }

    return { sent, failed, pruned };
  }

  // Combined Push Dispatch (FCM + Web Push)
  async function sendPushToUser(
    userId: string,
    payload: { title: string; body: string; url?: string; tag?: string; data?: any }
  ): Promise<{ sent: number; failed: number; pruned: number }> {
    const [fcmResult, webPushResult] = await Promise.all([
      sendFcmToUser(userId, payload),
      sendWebPushToUser(userId, payload),
    ]);

    return {
      sent: fcmResult.sent + webPushResult.sent,
      failed: fcmResult.failed + webPushResult.failed,
      pruned: fcmResult.pruned + webPushResult.pruned,
    };
  }

  // 8a. Retrieve Public VAPID Key
  app.get("/api/push/vapid-public-key", (req, res) => {
    const key = vapidPublicKey;
    if (!key) {
      return res.status(503).json({ error: "Web Push VAPID public key is not configured on this server." });
    }
    return res.json({ publicKey: key });
  });

  // 8b. Register Push Subscription for Current Verified User
  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const idToken = authHeader.split(" ")[1];
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid or expired authentication session." });
      }
      const callerUid = verifyData.users[0].localId;

      const { subscription } = req.body || {};
      if (!subscription || typeof subscription !== "object") {
        return res.status(400).json({ error: "Valid subscription object is required." });
      }
      const { endpoint, keys } = subscription;
      if (!endpoint || typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
        return res.status(400).json({ error: "Invalid subscription endpoint URL." });
      }
      if (
        !keys ||
        typeof keys.p256dh !== "string" ||
        !keys.p256dh.trim() ||
        typeof keys.auth !== "string" ||
        !keys.auth.trim()
      ) {
        return res.status(400).json({ error: "Invalid subscription keys (p256dh and auth are required)." });
      }

      const systemToken = await getServerToken();
      const effectiveToken = systemToken || idToken;

      const subDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${callerUid}/private/push_subscriptions`;

      let subscriptionsMap: Record<string, any> = {};
      const existingRes = await fetch(subDocUrl, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      if (existingRes.ok) {
        const existingData = await existingRes.json();
        const rawJson = existingData.fields?.subscriptionsJson?.stringValue;
        if (rawJson) {
          try {
            subscriptionsMap = JSON.parse(rawJson);
          } catch {}
        }
      } else if (!systemToken) {
        const cached = devPushStore.get(callerUid);
        if (cached) subscriptionsMap = { ...cached };
      }

      const deviceKey = "dev_" + crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 24);
      subscriptionsMap[deviceKey] = {
        endpoint,
        keys: {
          p256dh: keys.p256dh.trim(),
          auth: keys.auth.trim(),
        },
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 200) : "",
        updatedAt: new Date().toISOString(),
      };

      devPushStore.set(callerUid, subscriptionsMap);

      const patchRes = await fetch(subDocUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({
          fields: {
            subscriptionsJson: { stringValue: JSON.stringify(subscriptionsMap) },
            deviceCount: { integerValue: Object.keys(subscriptionsMap).length.toString() },
            updatedAt: { timestampValue: new Date().toISOString() },
          },
        }),
      });

      if (!patchRes.ok) {
        console.warn("Firestore push subscription write warning:", await patchRes.text());
        if (process.env.NODE_ENV === "production") {
          return res.status(500).json({ error: "Failed to store push subscription." });
        }
      }

      return res.json({ success: true, deviceKey });
    } catch (err: any) {
      console.error("Push subscribe error:", err);
      return res.status(500).json({ error: "Internal server error subscribing to notifications." });
    }
  });

  // 8c. Unsubscribe Device
  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const idToken = authHeader.split(" ")[1];
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid or expired authentication session." });
      }
      const callerUid = verifyData.users[0].localId;

      const { endpoint } = req.body || {};
      if (!endpoint || typeof endpoint !== "string") {
        return res.status(400).json({ error: "Subscription endpoint is required." });
      }

      const systemToken = await getServerToken();
      const effectiveToken = systemToken || idToken;

      const subDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${callerUid}/private/push_subscriptions`;
      let subscriptionsMap: Record<string, any> = {};
      const existingRes = await fetch(subDocUrl, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      if (existingRes.ok) {
        const existingData = await existingRes.json();
        const rawJson = existingData.fields?.subscriptionsJson?.stringValue;
        if (rawJson) {
          try {
            subscriptionsMap = JSON.parse(rawJson);
          } catch {}
        }
      } else if (!systemToken) {
        const cached = devPushStore.get(callerUid);
        if (cached) subscriptionsMap = { ...cached };
      }

      let removed = false;
      for (const [k, v] of Object.entries(subscriptionsMap)) {
        if (v?.endpoint === endpoint) {
          delete subscriptionsMap[k];
          removed = true;
        }
      }

      devPushStore.set(callerUid, subscriptionsMap);

      if (removed) {
        await fetch(subDocUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${effectiveToken}`,
          },
          body: JSON.stringify({
            fields: {
              subscriptionsJson: { stringValue: JSON.stringify(subscriptionsMap) },
              deviceCount: { integerValue: Object.keys(subscriptionsMap).length.toString() },
              updatedAt: { timestampValue: new Date().toISOString() },
            },
          }),
        }).catch(() => {});
      }

      return res.json({ success: true, removed });
    } catch (err: any) {
      console.error("Push unsubscribe error:", err);
      return res.status(500).json({ error: "Internal server error unsubscribing." });
    }
  });

  // 8c-2. Register FCM Device Token
  app.post("/api/push/fcm-token", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const idToken = authHeader.split(" ")[1];
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid or expired authentication session." });
      }
      const callerUid = verifyData.users[0].localId;
      const { token } = req.body || {};
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Valid FCM token is required." });
      }

      const systemToken = await getServerToken();
      const effectiveToken = systemToken || idToken;

      const fcmDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${callerUid}/private/fcm_tokens`;

      // Read existing tokens to support multi-device push
      let existingTokens: string[] = [];
      try {
        const getRes = await fetch(fcmDocUrl, {
          headers: { Authorization: `Bearer ${effectiveToken}` },
        });
        if (getRes.ok) {
          const docJson = await getRes.json();
          const f = docJson.fields || {};
          if (f.token?.stringValue) existingTokens.push(f.token.stringValue);
          if (f.tokens?.arrayValue?.values) {
            for (const v of f.tokens.arrayValue.values) {
              if (v.stringValue && !existingTokens.includes(v.stringValue)) {
                existingTokens.push(v.stringValue);
              }
            }
          }
          if (f.tokensJson?.stringValue) {
            try {
              const parsed = JSON.parse(f.tokensJson.stringValue);
              if (Array.isArray(parsed)) {
                for (const t of parsed) {
                  if (typeof t === "string" && !existingTokens.includes(t)) {
                    existingTokens.push(t);
                  }
                }
              }
            } catch {}
          }
        }
      } catch {}

      // Add new token if not present, keep latest 10 devices
      if (!existingTokens.includes(token)) {
        existingTokens.push(token);
      }
      if (existingTokens.length > 10) {
        existingTokens = existingTokens.slice(-10);
      }

      await fetch(fcmDocUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({
          fields: {
            token: { stringValue: token },
            tokens: {
              arrayValue: {
                values: existingTokens.map((t) => ({ stringValue: t })),
              },
            },
            tokensJson: { stringValue: JSON.stringify(existingTokens) },
            updatedAt: { timestampValue: new Date().toISOString() },
          },
        }),
      });

      return res.json({ success: true, message: "FCM token registered.", deviceCount: existingTokens.length });
    } catch (err: any) {
      console.error("fcm-token error:", err);
      return res.status(500).json({ error: "Failed to register FCM token." });
    }
  });

  // 8c-3. Unregister FCM Device Token on Logout
  app.post("/api/push/fcm-unsubscribe", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const idToken = authHeader.split(" ")[1];
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid authentication session." });
      }
      const callerUid = verifyData.users[0].localId;
      const { token } = req.body || {};

      const systemToken = await getServerToken();
      const effectiveToken = systemToken || idToken;

      const fcmDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${callerUid}/private/fcm_tokens`;

      if (token && typeof token === "string") {
        try {
          const getRes = await fetch(fcmDocUrl, {
            headers: { Authorization: `Bearer ${effectiveToken}` },
          });
          if (getRes.ok) {
            const docJson = await getRes.json();
            const f = docJson.fields || {};
            let remainingTokens: string[] = [];
            if (f.tokens?.arrayValue?.values) {
              for (const v of f.tokens.arrayValue.values) {
                if (v.stringValue && v.stringValue !== token && !remainingTokens.includes(v.stringValue)) {
                  remainingTokens.push(v.stringValue);
                }
              }
            }
            if (remainingTokens.length === 0 && f.token?.stringValue && f.token.stringValue !== token) {
              remainingTokens.push(f.token.stringValue);
            }

            if (remainingTokens.length > 0) {
              await fetch(fcmDocUrl, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${effectiveToken}`,
                },
                body: JSON.stringify({
                  fields: {
                    token: { stringValue: remainingTokens[remainingTokens.length - 1] },
                    tokens: {
                      arrayValue: {
                        values: remainingTokens.map((t) => ({ stringValue: t })),
                      },
                    },
                    tokensJson: { stringValue: JSON.stringify(remainingTokens) },
                    updatedAt: { timestampValue: new Date().toISOString() },
                  },
                }),
              });
              return res.json({ success: true, message: "FCM device token unregistered.", remainingDevices: remainingTokens.length });
            }
          }
        } catch {}
      }

      await fetch(fcmDocUrl, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });

      return res.json({ success: true, message: "FCM token unregistered." });
    } catch (err: any) {
      console.error("fcm-unsubscribe error:", err);
      return res.status(500).json({ error: "Failed to unregister FCM token." });
    }
  });

  // 8d. Secure, Authorized Chat Message Push Notification Dispatch
  app.post("/api/push/notify-message", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkIpRateLimit(`push-notify:${clientIp}`, 60, 60 * 1000)) {
        return res.status(429).json({ error: "Too many notification requests. Please slow down." });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required." });
      }
      const idToken = authHeader.split(" ")[1];
      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.users || !verifyData.users[0]) {
        return res.status(401).json({ error: "Invalid or expired authentication session." });
      }
      const callerUid = verifyData.users[0].localId;

      const { chatId, messageId } = req.body || {};
      if (!chatId || typeof chatId !== "string" || !messageId || typeof messageId !== "string") {
        return res.status(400).json({ error: "Both chatId and messageId are required strings." });
      }

      const systemToken = await getServerToken();
      const effectiveToken = systemToken || idToken;

      // 1. Fetch chat document to verify participant status
      const chatDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/chats/${chatId}`;
      const chatRes = await fetch(chatDocUrl, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      if (chatRes.status === 404) {
        return res.status(404).json({ error: "Chat conversation not found." });
      }
      if (chatRes.status === 403) {
        return res.status(403).json({ error: "Forbidden: You are not a participant in this conversation." });
      }
      if (!chatRes.ok) {
        return res.status(chatRes.status).json({ error: "Failed to verify chat conversation." });
      }
      const chatJson = await chatRes.json();
      const participantsList = chatJson.fields?.participants?.arrayValue?.values || [];
      const participants: string[] = participantsList.map((v: any) => v.stringValue).filter(Boolean);

      if (!participants.includes(callerUid)) {
        return res.status(403).json({ error: "Forbidden: You are not a participant in this conversation." });
      }

      // 2. Fetch the exact message document to verify caller is author
      const messageDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/chats/${chatId}/messages/${messageId}`;
      const msgRes = await fetch(messageDocUrl, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      if (msgRes.status === 404) {
        return res.status(404).json({ error: "Message not found in the specified chat." });
      }
      if (msgRes.status === 403) {
        return res.status(403).json({ error: "Forbidden: You cannot access this message." });
      }
      if (!msgRes.ok) {
        return res.status(msgRes.status).json({ error: "Failed to verify message document." });
      }
      const msgJson = await msgRes.json();
      const senderId = msgJson.fields?.senderId?.stringValue;
      if (senderId !== callerUid) {
        return res.status(403).json({ error: "Forbidden: You can only trigger notifications for your own messages." });
      }

      const messageText = msgJson.fields?.text?.stringValue || "";
      const textSnippet = messageText.length > 100 ? messageText.slice(0, 97) + "..." : messageText;

      // 3. Fetch sender's public profile name
      let senderName = "Campus Peer";
      try {
        const profileUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${callerUid}`;
        const profileRes = await fetch(profileUrl, {
          headers: { Authorization: `Bearer ${effectiveToken}` },
        });
        if (profileRes.ok) {
          const profileJson = await profileRes.json();
          senderName = profileJson.fields?.name?.stringValue || "Campus Peer";
        }
      } catch {}

      // 4. Determine recipients exclusively from trusted chat participants (excluding sender)
      const recipients = participants.filter((p) => p !== callerUid);
      if (recipients.length === 0) {
        return res.json({ success: true, message: "No other participants to notify." });
      }

      let totalSent = 0;
      let totalPruned = 0;
      for (const recipientUid of recipients) {
        // Create persistent event-driven Firestore notification
        await createServerNotification({
          notificationId: `notif_chat_${messageId}_${recipientUid}`,
          recipientUid,
          type: "chat",
          title: `New message from ${senderName}`,
          body: textSnippet || "Sent you a message.",
          targetType: "chat",
          targetId: chatId,
          actorUid: callerUid,
          actorName: senderName,
          eventId: `chat_${chatId}_${messageId}`,
          link: `/chat/${chatId}`,
          metadata: { chatId, messageId },
        }).catch((err) => console.warn("[Notifications] Chat message notif warning:", err));

        const result = await sendPushToUser(recipientUid, {
          title: `New message from ${senderName}`,
          body: textSnippet || "Sent you a message.",
          url: `/chat/${chatId}`,
          tag: `chat_${chatId}`,
          data: {
            type: "chat_message",
            chatId,
            messageId,
            url: `/chat/${chatId}`,
          },
        });
        totalSent += result.sent;
        totalPruned += result.pruned;
      }

      return res.json({
        success: true,
        deliveredCount: totalSent,
        prunedCount: totalPruned,
        recipientsCount: recipients.length,
      });
    } catch (err: any) {
      console.error("Push notify-message error:", err);
      return res.status(500).json({ error: "Internal server error dispatching push notification." });
    }
  });

  // --- Listing Expiration & Automatic Cleanup System ---

  function extractCloudinaryPublicId(imageUrl: string): string | null {
    if (!imageUrl || typeof imageUrl !== "string") return null;
    const match = imageUrl.match(/\/upload\/(?:v\d+\/)?([^\.\?\#]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  }

  async function destroyCloudinaryImage(
    publicId: string,
    apiKeyVal?: string,
    apiSecret?: string,
    cloudName?: string
  ): Promise<boolean> {
    if (!publicId || !apiKeyVal || !apiSecret || !cloudName) {
      return false;
    }
    try {
      const timestamp = Math.round(Date.now() / 1000);
      const toSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash("sha1").update(toSign).digest("hex");

      const params = new URLSearchParams();
      params.append("public_id", publicId);
      params.append("timestamp", timestamp.toString());
      params.append("api_key", apiKeyVal);
      params.append("signature", signature);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
        method: "POST",
        body: params,
      });
      const data = await res.json().catch(() => ({}));
      return data.result === "ok" || data.result === "not found";
    } catch (err) {
      console.warn(`[Cleanup] Failed to destroy Cloudinary image ${publicId}:`, err);
      return false;
    }
  }

  async function fetchFirestoreListings(systemToken: string, limit = 300): Promise<any[]> {
    try {
      const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents:runQuery`;
      const res = await fetch(queryUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${systemToken}`,
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "listings" }],
            limit,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("[Cleanup Job] Failed to query listings for cleanup via runQuery:", errText);
        return [];
      }

      const results = await res.json();
      if (!Array.isArray(results)) {
        return [];
      }

      return results
        .filter((item: any) => Boolean(item.document))
        .map((item: any) => item.document);
    } catch (err) {
      console.error("[Cleanup Job] Exception querying listings via runQuery:", err);
      return [];
    }
  }

  async function runExpiredListingsCleanup(): Promise<{ processed: number; deleted: number; imagesPurged: number }> {
    let processed = 0;
    let deleted = 0;
    let imagesPurged = 0;

    try {
      const systemToken = await getServerToken();
      if (!systemToken) {
        console.warn("[Cleanup Job] System token unavailable, skipping expired listing cleanup.");
        return { processed: 0, deleted: 0, imagesPurged: 0 };
      }
      const { apiKeyVal, apiSecret, cloudName } = getCloudinaryConfig();

      const documents = await fetchFirestoreListings(systemToken, 300);
      processed = documents.length;

      const now = Date.now();

      for (const doc of documents) {
        const docName = doc.name;
        const listingId = docName.split("/").pop();
        const fields = doc.fields || {};

        const status = fields.status?.stringValue;
        if (status === "completed") {
          continue;
        }

        let expiresAtMs: number | null = null;
        if (fields.expiresAt?.timestampValue) {
          expiresAtMs = Date.parse(fields.expiresAt.timestampValue);
        } else if (fields.expiresAt?.stringValue) {
          expiresAtMs = Date.parse(fields.expiresAt.stringValue);
        }

        let isExpired = false;
        if (status === "expired") {
          isExpired = true;
        } else if (expiresAtMs !== null && !isNaN(expiresAtMs)) {
          if (expiresAtMs <= now) {
            isExpired = true;
          }
        } else {
          // Legacy listing without expiresAt: check if createdAt is older than 30 days
          let createdAtMs: number | null = null;
          if (fields.createdAt?.timestampValue) {
            createdAtMs = Date.parse(fields.createdAt.timestampValue);
          } else if (fields.createdAt?.stringValue) {
            createdAtMs = Date.parse(fields.createdAt.stringValue);
          }
          if (createdAtMs !== null && !isNaN(createdAtMs) && now - createdAtMs > 30 * 24 * 60 * 60 * 1000) {
            isExpired = true;
          }
        }

        if (isExpired && listingId) {
          // 1. Destroy images in Cloudinary
          const imagesList = fields.images?.arrayValue?.values || [];
          for (const imgVal of imagesList) {
            const imgUrl = imgVal.stringValue;
            if (imgUrl) {
              const publicId = extractCloudinaryPublicId(imgUrl);
              if (publicId && apiKeyVal && apiSecret) {
                const destroyed = await destroyCloudinaryImage(publicId, apiKeyVal, apiSecret, cloudName);
                if (destroyed) imagesPurged++;
              }
            }
          }

          // 2. Delete the listing document
          const delUrl = `https://firestore.googleapis.com/v1/${docName}`;
          const delRes = await fetch(delUrl, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${systemToken}` },
          });

          if (delRes.ok) {
            deleted++;
          }
        }
      }

      console.log(`[Cleanup Job] Processed ${processed} listings, purged ${deleted} expired listings and ${imagesPurged} Cloudinary assets.`);
    } catch (err) {
      console.error("[Cleanup Job] Error running cleanup:", err);
    }

    return { processed, deleted, imagesPurged };
  }

  async function verifyAdminCaller(req: express.Request): Promise<{ uid: string; email: string } | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    const idToken = authHeader.split(" ")[1];
    try {
      const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const lookupRes = await fetch(lookupUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!lookupRes.ok) return null;
      const lookupData = await lookupRes.json();
      const user = lookupData.users?.[0];
      if (!user || !user.email) return null;
      const email = user.email.toLowerCase().trim();
      const configuredAdmin = process.env.ADMIN_EMAIL?.toLowerCase().trim();
      if (email === "admin@student.annauniv.edu" || (configuredAdmin && email === configuredAdmin)) {
        return { uid: user.localId, email };
      }
      try {
        const sysToken = await getServerToken();
        if (sysToken) {
          const userDocRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${user.localId}`, {
            headers: { Authorization: `Bearer ${sysToken}` },
          });
          if (userDocRes.ok) {
            const userDoc = await userDocRes.json();
            const userData = parseFirestoreDoc(userDoc);
            if (userData.role === "admin") {
              return { uid: user.localId, email };
            }
          }
        }
      } catch {
        // ignore lookup error
      }
      return null;
    } catch {
      return null;
    }
  }

  async function verifyStudentCaller(req: express.Request): Promise<{ uid: string; email: string } | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    const idToken = authHeader.split(" ")[1];
    try {
      const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const lookupRes = await fetch(lookupUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!lookupRes.ok) return null;
      const lookupData = await lookupRes.json();
      const user = lookupData.users?.[0];
      if (!user || !user.email) return null;
      return { uid: user.localId, email: user.email.toLowerCase().trim() };
    } catch {
      return null;
    }
  }

  async function verifyAdminOrSystem(req: express.Request): Promise<boolean> {
    const admin = await verifyAdminCaller(req);
    if (admin) return true;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return false;
    }
    const idToken = authHeader.split(" ")[1];
    try {
      const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const lookupRes = await fetch(lookupUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!lookupRes.ok) return false;
      const lookupData = await lookupRes.json();
      const user = lookupData.users?.[0];
      if (!user || !user.email) return false;
      const email = user.email.toLowerCase().trim();
      const systemEmail = (process.env.INTERNAL_SYSTEM_EMAIL || "internal.system@student.annauniv.edu").toLowerCase().trim();
      const configuredAdmin = process.env.ADMIN_EMAIL?.toLowerCase().trim();
      if (email === systemEmail || email === "internal.system@student.annauniv.edu" || email === "admin@student.annauniv.edu" || (configuredAdmin && email === configuredAdmin)) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Trigger manual or scheduler-driven cleanup of expired listings
  app.post("/api/listings/cleanup-expired", async (req, res) => {
    try {
      const isAdmin = await verifyAdminOrSystem(req);
      if (!isAdmin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }
      const result = await runExpiredListingsCleanup();
      return res.json({
        message: "Expired listings cleanup complete.",
        ...result,
      });
    } catch (err: any) {
      console.error("Cleanup endpoint error:", err);
      return res.status(500).json({ error: "Internal server error running cleanup." });
    }
  });

  // One-time backfill migration for legacy listings missing expiresAt
  app.post("/api/listings/backfill-expiration", async (req, res) => {
    try {
      const isAdmin = await verifyAdminOrSystem(req);
      if (!isAdmin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const systemToken = await getServerToken();
      if (!systemToken) {
        return res.status(503).json({ error: "System authentication service unavailable." });
      }

      const documents = await fetchFirestoreListings(systemToken, 300);
      let backfilledCount = 0;

      for (const doc of documents) {
        const fields = doc.fields || {};
        if (!fields.expiresAt) {
          let baseDate = Date.now();
          if (fields.createdAt?.timestampValue) {
            baseDate = Date.parse(fields.createdAt.timestampValue);
          } else if (fields.createdAt?.stringValue) {
            baseDate = Date.parse(fields.createdAt.stringValue);
          }
          const defaultExpirationIso = new Date(baseDate + 30 * 24 * 60 * 60 * 1000).toISOString();
          const patchUrl = `https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=expiresAt&updateMask.fieldPaths=expirationDays`;
          await fetch(patchUrl, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${systemToken}`,
            },
            body: JSON.stringify({
              fields: {
                ...fields,
                expiresAt: { timestampValue: defaultExpirationIso },
                expirationDays: { integerValue: "30" },
              },
            }),
          });
          backfilledCount++;
        }
      }

      return res.json({
        message: "Backfill migration complete.",
        totalInspected: documents.length,
        backfilledCount,
      });
    } catch (err: any) {
      console.error("Backfill migration error:", err);
      return res.status(500).json({ error: "Internal server error running backfill migration." });
    }
  });

  // Scheduled retention cleanup for expired requests past their 30-day retention window
  async function runExpiredRequestsCleanup(): Promise<{ processed: number; deleted: number }> {
    let processed = 0;
    let deleted = 0;

    try {
      const systemToken = await getServerToken();
      if (!systemToken) {
        console.warn("[Requests Cleanup Job] System token unavailable, skipping expired requests cleanup.");
        return { processed: 0, deleted: 0 };
      }

      const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents:runQuery`;
      const res = await fetch(queryUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${systemToken}`,
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "requests" }],
            limit: 300,
          },
        }),
      });

      if (!res.ok) {
        console.warn(`[Requests Cleanup Query] Returned HTTP ${res.status}`);
        return { processed: 0, deleted: 0 };
      }

      const results = await res.json();
      if (!Array.isArray(results)) return { processed: 0, deleted: 0 };

      const documents = results
        .filter((item: any) => Boolean(item.document))
        .map((item: any) => item.document);

      processed = documents.length;
      const now = Date.now();

      for (const doc of documents) {
        const docName = doc.name;
        const requestId = docName.split("/").pop();
        const fields = doc.fields || {};

        let deleteAtMs: number | null = null;
        if (fields.deleteAt?.timestampValue) {
          deleteAtMs = Date.parse(fields.deleteAt.timestampValue);
        } else if (fields.deleteAt?.stringValue) {
          deleteAtMs = Date.parse(fields.deleteAt.stringValue);
        }

        let shouldDelete = false;
        if (deleteAtMs !== null && !isNaN(deleteAtMs)) {
          // Retention period expired (30 days post-expiry)
          if (deleteAtMs <= now) {
            shouldDelete = true;
          }
        } else {
          // Legacy request without deleteAt: check if createdAt is older than 31 days and status is expired/cancelled
          let createdAtMs: number | null = null;
          if (fields.createdAt?.timestampValue) {
            createdAtMs = Date.parse(fields.createdAt.timestampValue);
          } else if (fields.createdAt?.stringValue) {
            createdAtMs = Date.parse(fields.createdAt.stringValue);
          }
          const status = fields.status?.stringValue;
          if (createdAtMs !== null && !isNaN(createdAtMs) && now - createdAtMs > 31 * 24 * 60 * 60 * 1000) {
            if (status === "expired" || status === "cancelled") {
              shouldDelete = true;
            }
          }
        }

        if (shouldDelete && requestId) {
          // Permanently remove request doc while preserving conversations and notifications for student history
          const delUrl = `https://firestore.googleapis.com/v1/${docName}`;
          const delRes = await fetch(delUrl, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${systemToken}` },
          });

          if (delRes.ok) {
            deleted++;
          }
        }
      }

      console.log(`[Requests Cleanup Job] Processed ${processed} requests, purged ${deleted} requests past retention window.`);
    } catch (err) {
      console.error("[Requests Cleanup Job] Error running cleanup:", err);
    }

    return { processed, deleted };
  }

  // Request Renewal Endpoint: Extends request by 24h, advances renewalCount, and preserves original ID/history
  app.post("/api/requests/renew", async (req, res) => {
    try {
      const student = await verifyStudentCaller(req);
      if (!student) {
        return res.status(401).json({ error: "Authentication required to renew request." });
      }

      const { requestId } = req.body || {};
      if (!requestId || typeof requestId !== "string") {
        return res.status(400).json({ error: "requestId is required." });
      }

      const systemToken = await getServerToken();
      if (!systemToken) {
        return res.status(503).json({ error: "System authentication service unavailable." });
      }

      // Fetch request document
      const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/requests/${requestId}`;
      const docRes = await fetch(docUrl, {
        headers: { Authorization: `Bearer ${systemToken}` },
      });

      if (!docRes.ok) {
        return res.status(404).json({ error: "Request not found." });
      }

      const docJson = await docRes.json();
      const fields = docJson.fields || {};
      const requesterId = fields.requesterId?.stringValue;

      // Ownership enforcement: Only authenticated owner may renew
      if (requesterId !== student.uid) {
        return res.status(403).json({ error: "Unauthorized: only the requester can renew this request." });
      }

      const status = fields.status?.stringValue;
      if (status === "cancelled" || status === "completed") {
        return res.status(400).json({ error: "Cancelled or completed requests cannot be renewed." });
      }

      const currentRenewalCount = fields.renewalCount?.integerValue
        ? parseInt(fields.renewalCount.integerValue, 10)
        : fields.renewalCount?.doubleValue
        ? Math.floor(fields.renewalCount.doubleValue)
        : 0;
      const newRenewalCount = currentRenewalCount + 1;

      const now = Date.now();
      const newExpiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
      const newDeleteAt = new Date(now + 31 * 24 * 60 * 60 * 1000).toISOString(); // 30-day retention after 24h expiry
      const renewedAt = new Date(now).toISOString();

      const patchUrl = `${docUrl}?updateMask.fieldPaths=status&updateMask.fieldPaths=expiresAt&updateMask.fieldPaths=deleteAt&updateMask.fieldPaths=renewedAt&updateMask.fieldPaths=renewalCount&updateMask.fieldPaths=updatedAt`;

      const patchRes = await fetch(patchUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${systemToken}`,
        },
        body: JSON.stringify({
          fields: {
            ...fields,
            status: { stringValue: "open" },
            expiresAt: { timestampValue: newExpiresAt },
            deleteAt: { timestampValue: newDeleteAt },
            renewedAt: { timestampValue: renewedAt },
            renewalCount: { integerValue: String(newRenewalCount) },
            updatedAt: { timestampValue: renewedAt },
          },
        }),
      });

      if (!patchRes.ok) {
        const patchErr = await patchRes.text();
        console.error("Failed to patch renewed request:", patchErr);
        return res.status(500).json({ error: "Failed to renew request." });
      }

      return res.json({
        success: true,
        message: "Request renewed successfully for another 24 hours.",
        requestId,
        expiresAt: newExpiresAt,
        deleteAt: newDeleteAt,
        renewalCount: newRenewalCount,
        renewedAt,
      });
    } catch (err: any) {
      console.error("Renewal endpoint error:", err);
      return res.status(500).json({ error: "Internal server error renewing request." });
    }
  });

  // Trigger manual or scheduler-driven cleanup of expired requests past retention period
  app.post("/api/requests/cleanup-expired", async (req, res) => {
    try {
      const isAdmin = await verifyAdminOrSystem(req);
      if (!isAdmin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }
      const result = await runExpiredRequestsCleanup();
      return res.json({
        message: "Expired requests retention cleanup complete.",
        ...result,
      });
    } catch (err: any) {
      console.error("Requests cleanup endpoint error:", err);
      return res.status(500).json({ error: "Internal server error running requests cleanup." });
    }
  });

  // One-time backfill migration for legacy requests missing expiresAt
  app.post("/api/requests/backfill-expiration", async (req, res) => {
    try {
      const isAdmin = await verifyAdminOrSystem(req);
      if (!isAdmin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const systemToken = await getServerToken();
      if (!systemToken) {
        return res.status(503).json({ error: "System authentication service unavailable." });
      }

      const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents:runQuery`;
      const qRes = await fetch(queryUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${systemToken}`,
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "requests" }],
            limit: 300,
          },
        }),
      });

      if (!qRes.ok) {
        return res.status(500).json({ error: "Failed to query requests for backfill." });
      }

      const results = await qRes.json();
      const documents = Array.isArray(results)
        ? results.filter((item: any) => Boolean(item.document)).map((item: any) => item.document)
        : [];

      let backfilledCount = 0;
      const now = Date.now();

      for (const doc of documents) {
        const fields = doc.fields || {};
        if (!fields.expiresAt) {
          let createdAtMs = now;
          if (fields.createdAt?.timestampValue) {
            createdAtMs = Date.parse(fields.createdAt.timestampValue);
          } else if (fields.createdAt?.stringValue) {
            createdAtMs = Date.parse(fields.createdAt.stringValue);
          }

          const status = fields.status?.stringValue || "open";
          // If active, grant 24h grace period from now so active legacy requests are not abruptly hidden;
          // otherwise set to createdAt + 24h
          let expiresAtIso: string;
          if (status === "open" || status === "active") {
            expiresAtIso = new Date(now + 24 * 60 * 60 * 1000).toISOString();
          } else {
            expiresAtIso = new Date(createdAtMs + 24 * 60 * 60 * 1000).toISOString();
          }
          const deleteAtIso = new Date(Date.parse(expiresAtIso) + 30 * 24 * 60 * 60 * 1000).toISOString();

          const patchUrl = `https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=expiresAt&updateMask.fieldPaths=deleteAt&updateMask.fieldPaths=renewalCount`;
          await fetch(patchUrl, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${systemToken}`,
            },
            body: JSON.stringify({
              fields: {
                ...fields,
                expiresAt: { timestampValue: expiresAtIso },
                deleteAt: { timestampValue: deleteAtIso },
                renewalCount: { integerValue: "0" },
              },
            }),
          });
          backfilledCount++;
        }
      }

      return res.json({
        message: "Legacy requests backfill migration complete.",
        totalInspected: documents.length,
        backfilledCount,
      });
    } catch (err: any) {
      console.error("Requests backfill error:", err);
      return res.status(500).json({ error: "Internal server error running backfill migration." });
    }
  });

  // Account deletion endpoint: cascades delete across listings, Cloudinary assets, and Firestore data
  app.post("/api/account/delete", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required to delete account." });
      }
      const idToken = authHeader.split(" ")[1];

      // 1. Verify user identity
      const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      const lookupRes = await fetch(lookupUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!lookupRes.ok) {
        return res.status(401).json({ error: "Invalid or expired session token." });
      }
      const lookupData = await lookupRes.json();
      const user = lookupData.users?.[0];
      if (!user) {
        return res.status(401).json({ error: "User account not found." });
      }

      const uid = user.localId;
      const systemToken = await getServerToken();
      if (!systemToken) {
        return res.status(503).json({ error: "System authentication service unavailable." });
      }
      const { apiKeyVal, apiSecret, cloudName } = getCloudinaryConfig();

      // 2. Query and delete all user requests
      const requestDocs = await fetchFirestoreCollection(systemToken, "requests", 300);
      for (const reqDoc of requestDocs) {
        const fields = reqDoc.fields || {};
        if (fields.requesterId?.stringValue === uid) {
          await fetch(`https://firestore.googleapis.com/v1/${reqDoc.name}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${systemToken}` },
          });
        }
      }

      // 3. Process and cancel all active reservations involving this user
      const reservationDocs = await fetchFirestoreCollection(systemToken, "reservations", 300);
      for (const resDoc of reservationDocs) {
        const fields = resDoc.fields || {};
        const buyerId = fields.buyerId?.stringValue;
        const sellerId = fields.sellerId?.stringValue;
        const status = fields.status?.stringValue;
        const listingId = fields.listingId?.stringValue;

        if (buyerId === uid || sellerId === uid) {
          if (status === "pending" || status === "accepted") {
            const patchUrl = `https://firestore.googleapis.com/v1/${resDoc.name}?updateMask.fieldPaths=status&updateMask.fieldPaths=cancelReason&updateMask.fieldPaths=updatedAt`;
            await fetch(patchUrl, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${systemToken}`,
              },
              body: JSON.stringify({
                fields: {
                  status: { stringValue: "cancelled" },
                  cancelReason: { stringValue: buyerId === uid ? "Buyer account deleted" : "Seller account deleted" },
                  updatedAt: { timestampValue: new Date().toISOString() },
                },
              }),
            });

            // If buyer deleted account while reservation was accepted, release listing back to available
            if (buyerId === uid && status === "accepted" && listingId) {
              const listingUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/listings/${listingId}?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`;
              await fetch(listingUrl, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${systemToken}`,
                },
                body: JSON.stringify({
                  fields: {
                    status: { stringValue: "available" },
                    updatedAt: { timestampValue: new Date().toISOString() },
                  },
                }),
              });
            }
          }
        }
      }

      // 4. Query and delete all user listings and their Cloudinary assets
      const documents = await fetchFirestoreListings(systemToken, 300);
      for (const doc of documents) {
          const fields = doc.fields || {};
          if (fields.sellerId?.stringValue === uid) {
            // Destroy listing images
            const imagesList = fields.images?.arrayValue?.values || [];
            for (const imgVal of imagesList) {
              const imgUrl = imgVal.stringValue;
              if (imgUrl) {
                const publicId = extractCloudinaryPublicId(imgUrl);
                if (publicId && apiKeyVal && apiSecret) {
                  await destroyCloudinaryImage(publicId, apiKeyVal, apiSecret, cloudName);
                }
              }
            }
            // Delete listing doc
            await fetch(`https://firestore.googleapis.com/v1/${doc.name}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${systemToken}` },
            });
          }
        }

      // 3. Destroy custom Cloudinary avatar if present
      const userDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${uid}`;
      const userDocRes = await fetch(userDocUrl, {
        headers: { Authorization: `Bearer ${systemToken}` },
      });
      if (userDocRes.ok) {
        const userDoc = await userDocRes.json();
        const avatarUrl = userDoc.fields?.avatarUrl?.stringValue;
        if (avatarUrl && avatarUrl.includes("res.cloudinary.com/ddc64bq61/")) {
          const avatarPublicId = extractCloudinaryPublicId(avatarUrl);
          if (avatarPublicId && apiKeyVal && apiSecret) {
            await destroyCloudinaryImage(avatarPublicId, apiKeyVal, apiSecret, cloudName);
          }
        }
      }

      // 4. Delete Firestore user document & private profile
      await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${uid}/private/profile`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${systemToken}` },
      });
      await fetch(userDocUrl, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${systemToken}` },
      });

      // 5. Delete user from Firebase Auth
      await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      return res.json({ message: "Account and associated data deleted successfully." });
    } catch (err: any) {
      console.error("Account deletion error:", err);
      return res.status(500).json({ error: "Internal server error during account deletion." });
    }
  });

  // =========================================================================
  // --- Admin Moderation, Prohibited Content, Reporting & Audit System ---
  // =========================================================================

  function getEffectiveToken(req: express.Request, sysToken: string | null): string | null {
    if (sysToken) return sysToken;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.split(" ")[1];
    }
    return null;
  }

  function parseFirestoreDoc(doc: any): any {
    if (!doc) return null;
    const id = doc.name ? doc.name.split("/").pop() : "";
    const fields = doc.fields || {};
    const result: any = { id };
    for (const [key, val] of Object.entries(fields) as [string, any][]) {
      if (val.stringValue !== undefined) result[key] = val.stringValue;
      else if (val.integerValue !== undefined) result[key] = parseInt(val.integerValue, 10);
      else if (val.doubleValue !== undefined) result[key] = parseFloat(val.doubleValue);
      else if (val.booleanValue !== undefined) result[key] = val.booleanValue;
      else if (val.timestampValue !== undefined) result[key] = val.timestampValue;
      else if (val.arrayValue !== undefined) {
        result[key] = (val.arrayValue.values || []).map((v: any) => {
          if (v.stringValue !== undefined) return v.stringValue;
          if (v.mapValue !== undefined) return parseFirestoreDoc({ fields: v.mapValue.fields });
          return v;
        });
      } else if (val.mapValue !== undefined) {
        result[key] = parseFirestoreDoc({ fields: val.mapValue.fields });
      }
    }
    return result;
  }

  function toFirestoreFields(data: Record<string, any>): Record<string, any> {
    const fields: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val === undefined || val === null) continue;
      if (typeof val === "string") {
        fields[key] = { stringValue: val };
      } else if (typeof val === "number") {
        if (Number.isInteger(val)) {
          fields[key] = { integerValue: String(val) };
        } else {
          fields[key] = { doubleValue: val };
        }
      } else if (typeof val === "boolean") {
        fields[key] = { booleanValue: val };
      } else if (Array.isArray(val)) {
        fields[key] = {
          arrayValue: {
            values: val.map((item) => {
              if (typeof item === "string") return { stringValue: item };
              if (typeof item === "object" && item !== null) {
                return { mapValue: { fields: toFirestoreFields(item) } };
              }
              return { stringValue: String(item) };
            }),
          },
        };
      } else if (typeof val === "object") {
        fields[key] = { mapValue: { fields: toFirestoreFields(val) } };
      }
    }
    return fields;
  }

  async function fetchFirestoreCollection(systemToken: string, collectionId: string, limit = 300): Promise<any[]> {
    try {
      const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents:runQuery`;
      const res = await fetch(queryUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${systemToken}`,
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId }],
            limit,
          },
        }),
      });

      if (!res.ok) {
        console.warn(`[Firestore Query] ${collectionId} returned HTTP ${res.status}`);
        return [];
      }
      const results = await res.json();
      if (!Array.isArray(results)) return [];
      return results
        .filter((item: any) => Boolean(item.document))
        .map((item: any) => parseFirestoreDoc(item.document));
    } catch (err) {
      console.error(`[Admin API] Error querying collection ${collectionId}:`, err);
      return [];
    }
  }

  interface FirestoreWrite {
    updateMask?: { fieldPaths: string[] };
    update: {
      name: string;
      fields: Record<string, any>;
    };
    currentDocument?: {
      updateTime?: string;
      exists?: boolean;
    };
  }

  async function commitAdminMutationWithAudit(
    systemToken: string,
    targetWrite: FirestoreWrite,
    auditEntry: {
      adminId: string;
      adminEmail: string;
      action: string;
      targetType: "listing" | "user" | "report" | "request";
      targetId: string;
      targetUserId?: string;
      reason: string;
      metadata?: Record<string, any>;
    },
    extraWrites: FirestoreWrite[] = []
  ): Promise<{ logId: string; timestamp: string }> {
    const logId = `audit_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const timestamp = new Date().toISOString();
    const entryDoc = {
      id: logId,
      adminId: auditEntry.adminId,
      adminEmail: auditEntry.adminEmail,
      action: auditEntry.action,
      targetType: auditEntry.targetType,
      targetId: auditEntry.targetId,
      targetUserId: auditEntry.targetUserId || "",
      reason: auditEntry.reason,
      timestamp,
      metadata: auditEntry.metadata || {},
    };

    const auditDocName = `projects/${projectId}/databases/${firestoreDatabaseId}/documents/admin_audit_logs/${logId}`;
    const auditWrite: FirestoreWrite = {
      update: {
        name: auditDocName,
        fields: toFirestoreFields(entryDoc),
      },
    };

    const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents:commit`;
    const commitPayload = {
      writes: [
        targetWrite,
        ...extraWrites,
        auditWrite,
      ],
    };

    const res = await fetch(commitUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${systemToken}`,
      },
      body: JSON.stringify(commitPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Admin Commit] Atomic mutation + audit commit failed (HTTP ${res.status}):`, errText);
      throw new Error(`Atomic commit failed with HTTP ${res.status}: ${errText}`);
    }

    return { logId, timestamp };
  }

  async function logAdminAudit(
    systemToken: string,
    entry: {
      adminId: string;
      adminEmail: string;
      action: string;
      targetType: "listing" | "user" | "report" | "request";
      targetId: string;
      targetUserId?: string;
      reason: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    const logId = `audit_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const timestamp = new Date().toISOString();
    const entryDoc = {
      id: logId,
      adminId: entry.adminId,
      adminEmail: entry.adminEmail,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      targetUserId: entry.targetUserId || "",
      reason: entry.reason,
      timestamp,
      metadata: entry.metadata || {},
    };

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/admin_audit_logs?documentId=${logId}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${systemToken}`,
      },
      body: JSON.stringify({
        fields: toFirestoreFields(entryDoc),
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[Admin Audit] Failed to persist audit log to Firestore (HTTP ${res.status}):`, errBody);
      throw new Error(`Audit log persistence failed with HTTP ${res.status}`);
    }
  }

  async function logActivity(
    systemToken: string,
    entry: {
      userId: string;
      userEmail?: string;
      action: string;
      targetType: string;
      targetId: string;
      details?: Record<string, any>;
    }
  ): Promise<void> {
    const logId = `act_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const timestamp = new Date().toISOString();
    const actDoc = {
      id: logId,
      userId: entry.userId,
      userEmail: entry.userEmail || "",
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      timestamp,
      details: entry.details || {},
    };

    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/activity_logs?documentId=${logId}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${systemToken}`,
        },
        body: JSON.stringify({
          fields: toFirestoreFields(actDoc),
        }),
      });
      if (!res.ok) {
        console.warn(`[Activity Log] Failed to persist activity log (HTTP ${res.status})`);
      }
    } catch (err) {
      console.warn("Failed to log activity:", err);
    }
  }

  // Content moderation scanner (Tier 1: Block, Tier 2: Flag, Tier 3: Allow)
  function scanContentDeterministic(title: string, description: string): {
    decision: "allow" | "flag" | "block";
    reason?: string;
    category?: string;
    confidence?: "high" | "medium" | "low";
  } {
    const combined = `${title} ${description}`.toLowerCase();

    // 1. Illegal Drugs & Controlled Substances
    const drugPatterns = [
      /\b(weed|marijuana|ganja|charas|cannabis|hashish|pot|bhang)\b/i,
      /\b(cocaine|heroin|meth|lsd|mdma|ecstasy|shrooms|ketamine)\b/i,
      /\b(vape|juul|e-cigarette|nicotine|cigarette|bidi|tobacco|hookah)\b/i,
      /\b(prescription\s+drug|xanax|adderall|tramadol|oxycodone|codeine|sleeping\s+pills)\b/i,
      /\b(alcohol|vodka|whiskey|rum|beer|wine|liquor)\b/i,
    ];
    for (const p of drugPatterns) {
      if (p.test(combined)) {
        return {
          decision: "block",
          reason: "Illegal substances, drugs, alcohol, or controlled tobacco/vape products are strictly prohibited on StudentNeed.",
          category: "Drugs & Controlled Substances",
          confidence: "high",
        };
      }
    }

    // Replace legitimate student tools (e.g. glue gun, staple gun, nerf gun, water gun) before weapon scanning
    const benignSupplyPattern = /\b(glue\s+gun|hot\s+glue\s+gun|staple\s+gun|heat\s+gun|nerf\s+gun|water\s+gun|massage\s+gun|barcode\s+gun|tag\s+gun|spray\s+gun)\b/gi;
    const sanitizedCombined = combined.replace(benignSupplyPattern, " benign_craft_supply ");

    // 2. Weapons & Harmful Instruments
    const weaponPatterns = [
      /\b(gun|firearm|pistol|revolver|rifle|shotgun|ammunition|bullets|ammo)\b/i,
      /\b(taser|stun\s*gun|pepper\s*spray|knuckle\s*duster|brass\s*knuckles)\b/i,
      /\b(switchblade|dagger|machete|katana|hunting\s+knife|combat\s+knife)\b/i,
      /\b(explosive|bomb|grenade|dynamite|firecrackers|crackers)\b/i,
    ];
    for (const p of weaponPatterns) {
      if (p.test(sanitizedCombined)) {
        return {
          decision: "block",
          reason: "Weapons, ammunition, explosives, and dangerous items are strictly prohibited on campus.",
          category: "Weapons & Dangerous Items",
          confidence: "high",
        };
      }
    }

    // 3. Exam Leaks & Academic Malpractice
    const examPatterns = [
      /\b(leaked\s+question\s+paper|exam\s+paper\s+leak|leaked\s+exam|anna\s+univ\s+paper\s+leak)\b/i,
      /\b(paid\s+proxy|exam\s+cheating\s+device|proxy\s+attendance|forged\s+certificate)\b/i,
      /\b(hall\s+ticket\s+forgery|fake\s+marksheet|fake\s+degree)\b/i,
    ];
    for (const p of examPatterns) {
      if (p.test(combined)) {
        return {
          decision: "block",
          reason: "Academic dishonesty, exam paper leaks, and forged university documents are strictly illegal.",
          category: "Academic Malpractice",
          confidence: "high",
        };
      }
    }

    // 4. Financial Scams & Fraud
    const scamPatterns = [
      /\b(free\s+money|easy\s+cash|double\s+your\s+money|get\s+rich\s+quick|pyramid\s+scheme)\b/i,
      /\b(crypto\s+investment|bitcoin\s+multiplier|binance\s+investment|telegram\s+signals)\b/i,
      /\b(earn\s+from\s+home\s+daily|earn\s+5000\s+daily|instant\s+withdrawal)\b/i,
      /\b(send\s+otp|share\s+otp|credit\s+card\s+hack|upi\s+hack|atm\s+cloning)\b/i,
    ];
    for (const p of scamPatterns) {
      if (p.test(combined)) {
        return {
          decision: "block",
          reason: "Financial scams, fraudulent investment schemes, and deceptive listings are strictly prohibited.",
          category: "Scam & Fraud",
          confidence: "high",
        };
      }
    }

    // 5. Hazardous Chemicals
    const hazardPatterns = [
      /\b(concentrated\s+cyanide|mercury|radioactive|uranium|thorium)\b/i,
      /\b(sulfuric\s+acid\s+pure|nitric\s+acid\s+pure|hydrochloric\s+acid\s+bulk)\b/i,
      /\b(poisons|venom|toxic\s+waste)\b/i,
    ];
    for (const p of hazardPatterns) {
      if (p.test(combined)) {
        return {
          decision: "block",
          reason: "Dangerous, hazardous, or toxic chemicals are prohibited on StudentNeed.",
          category: "Hazardous Materials",
          confidence: "high",
        };
      }
    }

    // 6. Sexually Explicit / Adult Services
    const adultPatterns = [
      /\b(porn|adult\s+video|xxx|sex\s+toy|escort|dating\s+service)\b/i,
    ];
    for (const p of adultPatterns) {
      if (p.test(combined)) {
        return {
          decision: "block",
          reason: "Adult content and sexually explicit items are prohibited.",
          category: "Adult Content",
          confidence: "high",
        };
      }
    }

    // Tier 2: Uncertain / Suspicious (Flag for admin review)
    const suspiciousPatterns = [
      /\b(whatsapp\s+me\s+at|contact\s+telegram|telegram\s*:\s*@|call\s+me\s+on\s+whatsapp)\b/i,
      /\b(dm\s+on\s+insta|instagram\s*:\s*@|external\s+payment|pay\s+outside)\b/i,
      /\b(no\s+meetup|advance\s+payment\s+only|courier\s+available)\b/i,
    ];
    for (const p of suspiciousPatterns) {
      if (p.test(combined)) {
        return {
          decision: "flag",
          reason: "Listing references off-platform communication or shipping, which flags potential scam risk.",
          category: "Off-platform risk",
          confidence: "medium",
        };
      }
    }

    return { decision: "allow" };
  }

  // Endpoint: Check Listing Content Safety
  app.post("/api/moderation/check-listing", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkIpRateLimit(`check-listing:${clientIp}`, 30, 10 * 60 * 1000)) {
        const systemToken = await getServerToken();
        if (systemToken) {
          await logActivity(systemToken, {
            userId: "anonymous",
            action: "suspicious_rate_limit",
            targetType: "security",
            targetId: clientIp,
            details: { endpoint: "/api/moderation/check-listing" }
          });
        }
        return res.status(429).json({ error: "Too many checks requested. Please wait a few minutes." });
      }

      const { title, description } = req.body;
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required." });
      }

      const deterministic = scanContentDeterministic(title, description || "");
      return res.json(deterministic);
    } catch (err: any) {
      console.error("Moderation check error:", err);
      return res.status(500).json({ error: "Internal server error during content check." });
    }
  });

  // Endpoint: Submit User Report
  app.post("/api/reports/submit", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkIpRateLimit(`report-submit:${clientIp}`, 10, 10 * 60 * 1000)) {
        const systemToken = await getServerToken();
        if (systemToken) {
          await logActivity(systemToken, {
            userId: "anonymous",
            action: "suspicious_rate_limit",
            targetType: "security",
            targetId: clientIp,
            details: { endpoint: "/api/reports/submit" }
          });
        }
        return res.status(429).json({ error: "Too many report requests from this IP. Please wait a few minutes." });
      }

      const caller = await verifyStudentCaller(req);
      if (!caller) {
        return res.status(401).json({ error: "Authentication required to report a listing." });
      }

      const { listingId, reason, description } = req.body;
      if (!listingId || !reason) {
        return res.status(400).json({ error: "Listing ID and report reason are required." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      // Check caller account status
      const userDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${caller.uid}`;
      const userDocRes = await fetch(userDocUrl, {
        headers: { Authorization: `Bearer ${systemToken}` },
      });
      if (userDocRes.ok) {
        const userDoc = parseFirestoreDoc(await userDocRes.json());
        if (userDoc.status === "suspended" || userDoc.status === "banned") {
          return res.status(403).json({ error: "Your account is suspended. You cannot submit reports." });
        }
      }

      // 1. Fetch listing details
      const listingUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/listings/${listingId}`;
      const listingRes = await fetch(listingUrl, {
        headers: { Authorization: `Bearer ${systemToken}` },
      });
      if (!listingRes.ok) {
        return res.status(404).json({ error: "Reported listing not found." });
      }
      const rawListingDoc = await listingRes.json();
      const listingData = parseFirestoreDoc(rawListingDoc);
      const reportedUserId = listingData.sellerId || "";
      const listingTitle = listingData.title || "";

      // 2. Prevent duplicate reports from the same user for the same listing while pending or reviewing
      const allReports = await fetchFirestoreCollection(systemToken, "reports", 500);
      const existingReport = allReports.find((r) =>
        r.reporterId === caller.uid &&
        r.listingId === listingId &&
        (r.status === "pending" || r.status === "reviewing")
      );

      if (existingReport) {
        return res.status(400).json({
          error: "You have already submitted an active report for this listing. Our admin moderation team is currently reviewing it.",
          isDuplicate: true,
        });
      }

      // 3. Create report document
      const reportId = `rep_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
      const createReportUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/reports?documentId=${reportId}`;
      const nowIso = new Date().toISOString();

      await fetch(createReportUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${systemToken}`,
        },
        body: JSON.stringify({
          fields: toFirestoreFields({
            id: reportId,
            reporterId: caller.uid,
            reporterEmail: caller.email,
            reportedUserId,
            listingId,
            listingTitle,
            reason,
            description: description || "",
            status: "pending",
            createdAt: nowIso,
          }),
        }),
      });

      // 4. Increment reportCount on listing (if permitted)
      try {
        const currentReportCount = typeof listingData.reportCount === "number" ? listingData.reportCount : 0;
        const patchListingUrl = `https://firestore.googleapis.com/v1/${rawListingDoc.name}?updateMask.fieldPaths=reportCount`;
        await fetch(patchListingUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${systemToken}`,
          },
          body: JSON.stringify({
            fields: {
              ...rawListingDoc.fields,
              reportCount: { integerValue: String(currentReportCount + 1) },
            },
          }),
        });
      } catch (patchErr) {
        console.warn("Could not increment listing reportCount:", patchErr);
      }

      // 5. Log activity
      await logActivity(systemToken, {
        userId: caller.uid,
        userEmail: caller.email,
        action: "report_submitted",
        targetType: "listing",
        targetId: listingId,
        details: { reportId, reason },
      });

      return res.json({
        message: "Report submitted successfully. Thank you for helping keep our campus marketplace safe.",
        reportId,
      });
    } catch (err: any) {
      console.error("Report submit error:", err);
      return res.status(500).json({ error: "Internal server error submitting report." });
    }
  });

  // Admin Endpoint: Overview Statistics
  app.get("/api/admin/overview", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const [users, listings, reports, requests, reservations, activityLogs, auditLogs] = await Promise.all([
        fetchFirestoreCollection(systemToken, "users", 500),
        fetchFirestoreCollection(systemToken, "listings", 500),
        fetchFirestoreCollection(systemToken, "reports", 500),
        fetchFirestoreCollection(systemToken, "requests", 500),
        fetchFirestoreCollection(systemToken, "reservations", 500),
        fetchFirestoreCollection(systemToken, "activity_logs", 25),
        fetchFirestoreCollection(systemToken, "admin_audit_logs", 25),
      ]);

      const totalUsers = users.length;
      const suspendedUsers = users.filter((u) => u.status === "suspended").length;
      const bannedUsers = users.filter((u) => u.status === "banned").length;
      const activeUsers = totalUsers - suspendedUsers - bannedUsers;

      const totalListings = listings.length;
      const activeListings = listings.filter((l) => l.status === "available" || l.status === "active").length;
      const reportedListings = listings.filter((l) => typeof l.reportCount === "number" && l.reportCount > 0).length;
      const removedListings = listings.filter((l) => l.status === "removed" || l.status === "hidden").length;

      const totalRequests = requests.length;
      const activeRequests = requests.filter((r) => r.status === "open" || r.status === "active").length;
      const removedRequests = requests.filter((r) => r.status === "removed" || r.status === "cancelled").length;

      const totalReservations = reservations.length;
      const activeReservations = reservations.filter((r) => r.status === "pending" || r.status === "accepted").length;
      const pendingReports = reports.filter((r) => r.status === "pending" || r.status === "reviewing").length;

      const removedListingsAndRequests = removedListings + removedRequests;

      // Merge and normalize recent moderation & system events (bounded to top 15)
      const userMap = new Map<string, any>();
      for (const u of users) {
        userMap.set(u.id, u);
      }

      const normalizedActivity = [
        ...activityLogs.map((a) => {
          const user = userMap.get(a.userId);
          return {
            id: a.id,
            timestamp: a.timestamp || a.createdAt || new Date().toISOString(),
            source: "activity" as const,
            action: a.action,
            actorEmail: a.userEmail || user?.email || "student",
            actorName: user?.name || "Student",
            targetType: a.targetType || "item",
            targetId: a.targetId || "",
            details: a.details || {},
          };
        }),
        ...auditLogs.map((l) => ({
          id: l.id,
          timestamp: l.timestamp || new Date().toISOString(),
          source: "audit" as const,
          action: l.action,
          actorEmail: l.adminEmail || "Admin",
          actorName: "Moderator",
          targetType: l.targetType || "item",
          targetId: l.targetId || "",
          details: { reason: l.reason, metadata: l.metadata },
        })),
      ];

      normalizedActivity.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      const recentActivity = normalizedActivity.slice(0, 15);

      return res.json({
        totalUsers,
        activeUsers,
        suspendedUsers,
        bannedUsers,
        totalListings,
        activeListings,
        reportedListings,
        removedListings,
        totalRequests,
        activeRequests,
        removedRequests,
        totalReservations,
        activeReservations,
        pendingReports,
        removedListingsAndRequests,
        recentActivity,
      });
    } catch (err: any) {
      console.error("Admin overview error:", err);
      return res.status(500).json({ error: "Internal server error fetching admin overview." });
    }
  });

  // Admin Endpoint: Users List with Moderation Info
  app.get("/api/admin/users", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const [users, listings, reports, requests, reservations] = await Promise.all([
        fetchFirestoreCollection(systemToken, "users", 500),
        fetchFirestoreCollection(systemToken, "listings", 500),
        fetchFirestoreCollection(systemToken, "reports", 500),
        fetchFirestoreCollection(systemToken, "requests", 500),
        fetchFirestoreCollection(systemToken, "reservations", 500),
      ]);

      const listingsCountMap = new Map<string, number>();
      for (const l of listings) {
        if (l.sellerId) {
          listingsCountMap.set(l.sellerId, (listingsCountMap.get(l.sellerId) || 0) + 1);
        }
      }

      const requestsCountMap = new Map<string, number>();
      for (const reqItem of requests) {
        if (reqItem.requesterId) {
          requestsCountMap.set(reqItem.requesterId, (requestsCountMap.get(reqItem.requesterId) || 0) + 1);
        }
      }

      const reservationsCountMap = new Map<string, number>();
      for (const resItem of reservations) {
        if (resItem.buyerId) {
          reservationsCountMap.set(resItem.buyerId, (reservationsCountMap.get(resItem.buyerId) || 0) + 1);
        }
        if (resItem.sellerId) {
          reservationsCountMap.set(resItem.sellerId, (reservationsCountMap.get(resItem.sellerId) || 0) + 1);
        }
      }

      const reportsReceivedMap = new Map<string, number>();
      for (const r of reports) {
        if (r.reportedUserId) {
          reportsReceivedMap.set(r.reportedUserId, (reportsReceivedMap.get(r.reportedUserId) || 0) + 1);
        }
      }

      const enhancedUsers = users.map((u) => {
        return {
          ...u,
          status: u.status || "active",
          warningCount: typeof u.warningCount === "number" ? u.warningCount : 0,
          warnings: Array.isArray(u.warnings) ? u.warnings : [],
          listingsCount: listingsCountMap.get(u.id) || 0,
          requestsCount: requestsCountMap.get(u.id) || 0,
          reservationsCount: reservationsCountMap.get(u.id) || 0,
          reportsReceivedCount: reportsReceivedMap.get(u.id) || 0,
        };
      });

      return res.json({ users: enhancedUsers });
    } catch (err: any) {
      console.error("Admin users error:", err);
      return res.status(500).json({ error: "Internal server error fetching users." });
    }
  });

  // Admin Endpoint: Warn User
  app.post("/api/admin/users/warn", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const { userId, reason } = req.body;
      if (!userId || !reason || typeof reason !== "string" || !reason.trim()) {
        return res.status(400).json({ error: "User ID and warning reason are required." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const userUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${userId}`;
      const userRes = await fetch(userUrl, {
        headers: { Authorization: `Bearer ${systemToken}` },
      });
      if (!userRes.ok) {
        return res.status(404).json({ error: "User not found." });
      }
      const rawUserDoc = await userRes.json();
      const userData = parseFirestoreDoc(rawUserDoc);

      const currentCount = typeof userData.warningCount === "number" ? userData.warningCount : 0;
      const currentWarnings = Array.isArray(userData.warnings) ? userData.warnings : [];
      const newWarning = {
        reason: reason.trim(),
        date: new Date().toISOString(),
        adminEmail: admin.email,
      };
      const updatedWarnings = [...currentWarnings, newWarning];
      const nowIso = new Date().toISOString();

      const targetWrite: FirestoreWrite = {
        update: {
          name: rawUserDoc.name,
          fields: {
            ...rawUserDoc.fields,
            warningCount: { integerValue: String(currentCount + 1) },
            warnings: {
              arrayValue: {
                values: updatedWarnings.map((w) => ({
                  mapValue: { fields: toFirestoreFields(w) },
                })),
              },
            },
            lastActivityAt: { stringValue: nowIso },
          },
        },
        updateMask: {
          fieldPaths: ["warningCount", "warnings", "lastActivityAt"],
        },
        currentDocument: rawUserDoc.updateTime ? { updateTime: rawUserDoc.updateTime } : undefined,
      };

      await commitAdminMutationWithAudit(systemToken, targetWrite, {
        adminId: admin.uid,
        adminEmail: admin.email,
        action: "USER_WARNED",
        targetType: "user",
        targetId: userId,
        targetUserId: userId,
        reason: reason.trim(),
        metadata: { warningNumber: currentCount + 1 },
      });

      await logActivity(systemToken, {
        userId,
        action: "moderation_action",
        targetType: "user",
        targetId: userId,
        details: { action: "USER_WARNED", reason: reason.trim() },
      });

      return res.json({ message: "Warning successfully issued to user." });
    } catch (err: any) {
      console.error("Admin warn error:", err);
      return res.status(500).json({ error: "Internal server error warning user." });
    }
  });

  // Admin Endpoint: Suspend User
  app.post("/api/admin/users/suspend", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const { userId, reason } = req.body;
      if (!userId || !reason || typeof reason !== "string" || !reason.trim()) {
        return res.status(400).json({ error: "User ID and suspension reason are required." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const userUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${userId}`;
      const userRes = await fetch(userUrl, {
        headers: { Authorization: `Bearer ${systemToken}` },
      });
      if (!userRes.ok) {
        return res.status(404).json({ error: "User not found." });
      }
      const rawUserDoc = await userRes.json();
      const nowIso = new Date().toISOString();

      const targetWrite: FirestoreWrite = {
        update: {
          name: rawUserDoc.name,
          fields: {
            ...rawUserDoc.fields,
            status: { stringValue: "suspended" },
            statusReason: { stringValue: reason.trim() },
            suspendedAt: { stringValue: nowIso },
            statusUpdatedAt: { stringValue: nowIso },
          },
        },
        updateMask: {
          fieldPaths: ["status", "statusReason", "suspendedAt", "statusUpdatedAt"],
        },
        currentDocument: rawUserDoc.updateTime ? { updateTime: rawUserDoc.updateTime } : undefined,
      };

      await commitAdminMutationWithAudit(systemToken, targetWrite, {
        adminId: admin.uid,
        adminEmail: admin.email,
        action: "USER_SUSPENDED",
        targetType: "user",
        targetId: userId,
        targetUserId: userId,
        reason: reason.trim(),
      });

      await logActivity(systemToken, {
        userId,
        action: "moderation_action",
        targetType: "user",
        targetId: userId,
        details: { action: "USER_SUSPENDED", reason: reason.trim() },
      });

      return res.json({ message: "User suspended successfully." });
    } catch (err: any) {
      console.error("Admin suspend error:", err);
      return res.status(500).json({ error: "Internal server error suspending user." });
    }
  });

  // Admin Endpoint: Ban User
  app.post("/api/admin/users/ban", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const { userId, reason } = req.body;
      if (!userId || !reason || typeof reason !== "string" || !reason.trim()) {
        return res.status(400).json({ error: "User ID and ban reason are required." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const userUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${userId}`;
      const userRes = await fetch(userUrl, {
        headers: { Authorization: `Bearer ${systemToken}` },
      });
      if (!userRes.ok) {
        return res.status(404).json({ error: "User not found." });
      }
      const rawUserDoc = await userRes.json();
      const nowIso = new Date().toISOString();

      const targetWrite: FirestoreWrite = {
        update: {
          name: rawUserDoc.name,
          fields: {
            ...rawUserDoc.fields,
            status: { stringValue: "banned" },
            statusReason: { stringValue: reason.trim() },
            bannedAt: { stringValue: nowIso },
            statusUpdatedAt: { stringValue: nowIso },
          },
        },
        updateMask: {
          fieldPaths: ["status", "statusReason", "bannedAt", "statusUpdatedAt"],
        },
        currentDocument: rawUserDoc.updateTime ? { updateTime: rawUserDoc.updateTime } : undefined,
      };

      await commitAdminMutationWithAudit(systemToken, targetWrite, {
        adminId: admin.uid,
        adminEmail: admin.email,
        action: "USER_BANNED",
        targetType: "user",
        targetId: userId,
        targetUserId: userId,
        reason: reason.trim(),
      });

      await logActivity(systemToken, {
        userId,
        action: "moderation_action",
        targetType: "user",
        targetId: userId,
        details: { action: "USER_BANNED", reason: reason.trim() },
      });

      return res.json({ message: "User banned successfully." });
    } catch (err: any) {
      console.error("Admin ban error:", err);
      return res.status(500).json({ error: "Internal server error banning user." });
    }
  });

  // Admin Endpoint: Restore User
  app.post("/api/admin/users/restore", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const { userId, reason } = req.body;
      if (!userId || !reason || typeof reason !== "string" || !reason.trim()) {
        return res.status(400).json({ error: "User ID and restoration reason are required." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const userUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${userId}`;
      const userRes = await fetch(userUrl, {
        headers: { Authorization: `Bearer ${systemToken}` },
      });
      if (!userRes.ok) {
        return res.status(404).json({ error: "User not found." });
      }
      const rawUserDoc = await userRes.json();
      const nowIso = new Date().toISOString();

      const targetWrite: FirestoreWrite = {
        update: {
          name: rawUserDoc.name,
          fields: {
            ...rawUserDoc.fields,
            status: { stringValue: "active" },
            statusReason: { stringValue: reason.trim() },
            restoredAt: { stringValue: nowIso },
            statusUpdatedAt: { stringValue: nowIso },
          },
        },
        updateMask: {
          fieldPaths: ["status", "statusReason", "restoredAt", "statusUpdatedAt"],
        },
        currentDocument: rawUserDoc.updateTime ? { updateTime: rawUserDoc.updateTime } : undefined,
      };

      await commitAdminMutationWithAudit(systemToken, targetWrite, {
        adminId: admin.uid,
        adminEmail: admin.email,
        action: "USER_RESTORED",
        targetType: "user",
        targetId: userId,
        targetUserId: userId,
        reason: reason.trim(),
      });

      await logActivity(systemToken, {
        userId,
        action: "moderation_action",
        targetType: "user",
        targetId: userId,
        details: { action: "USER_RESTORED", reason: reason.trim() },
      });

      return res.json({ message: "User restored successfully." });
    } catch (err: any) {
      console.error("Admin restore user error:", err);
      return res.status(500).json({ error: "Internal server error restoring user." });
    }
  });

  // Admin Endpoint: Listings List
  app.get("/api/admin/listings", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const [listings, users] = await Promise.all([
        fetchFirestoreCollection(systemToken, "listings", 500),
        fetchFirestoreCollection(systemToken, "users", 500),
      ]);

      const userMap = new Map<string, any>();
      for (const u of users) {
        userMap.set(u.id, u);
      }

      const enhancedListings = listings.map((l) => {
        const seller = userMap.get(l.sellerId);
        return {
          ...l,
          sellerName: seller?.name || "Student",
          sellerEmail: seller?.email || "",
          reportCount: typeof l.reportCount === "number" ? l.reportCount : 0,
        };
      });

      return res.json({ listings: enhancedListings });
    } catch (err: any) {
      console.error("Admin listings error:", err);
      return res.status(500).json({ error: "Internal server error fetching listings." });
    }
  });

  // Admin Endpoint: Moderate Listing (Hide, Remove, Restore)
  app.post("/api/admin/listings/moderate", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const { listingId, action, reason } = req.body;
      if (!listingId || !action || !reason || typeof reason !== "string" || !reason.trim()) {
        return res.status(400).json({ error: "Listing ID, action, and moderation reason are required." });
      }

      if (!["hide", "remove", "restore"].includes(action)) {
        return res.status(400).json({ error: "Invalid action. Must be 'hide', 'remove', or 'restore'." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const listingUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/listings/${listingId}`;
      const listingRes = await fetch(listingUrl, {
        headers: { Authorization: `Bearer ${systemToken}` },
      });
      if (!listingRes.ok) {
        return res.status(404).json({ error: "Listing not found." });
      }
      const rawListingDoc = await listingRes.json();
      const listingData = parseFirestoreDoc(rawListingDoc);

      const targetStatus = action === "hide" ? "hidden" : action === "remove" ? "removed" : "active";
      const auditAction = action === "hide" ? "LISTING_HIDDEN" : action === "remove" ? "LISTING_REMOVED" : "LISTING_RESTORED";
      const nowIso = new Date().toISOString();

      const targetWrite: FirestoreWrite = {
        update: {
          name: rawListingDoc.name,
          fields: {
            ...rawListingDoc.fields,
            status: { stringValue: targetStatus },
            moderationReason: { stringValue: reason.trim() },
            moderatedAt: { stringValue: nowIso },
            moderatedBy: { stringValue: admin.email },
          },
        },
        updateMask: {
          fieldPaths: ["status", "moderationReason", "moderatedAt", "moderatedBy"],
        },
        currentDocument: rawListingDoc.updateTime ? { updateTime: rawListingDoc.updateTime } : undefined,
      };

      await commitAdminMutationWithAudit(systemToken, targetWrite, {
        adminId: admin.uid,
        adminEmail: admin.email,
        action: auditAction,
        targetType: "listing",
        targetId: listingId,
        targetUserId: listingData.sellerId,
        reason: reason.trim(),
        metadata: { newStatus: targetStatus },
      });

      await logActivity(systemToken, {
        userId: listingData.sellerId || admin.uid,
        action: "moderation_action",
        targetType: "listing",
        targetId: listingId,
        details: { action: auditAction, reason: reason.trim(), newStatus: targetStatus },
      });

      return res.json({ message: `Listing successfully ${targetStatus === 'active' ? 'restored' : targetStatus}.` });
    } catch (err: any) {
      console.error("Admin moderate listing error:", err);
      return res.status(500).json({ error: "Internal server error moderating listing." });
    }
  });

  // Admin Endpoint: Edit Listing Details Safely
  app.post("/api/admin/listings/edit", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const { listingId, title, description, category, condition, type, price, wantedItem, location, reason } = req.body;
      if (!listingId || !title || !description || !category || !type || !location) {
        return res.status(400).json({ error: "Missing required listing fields: listingId, title, description, category, type, and location are required." });
      }

      if (type === "Exchange" && (!wantedItem || typeof wantedItem !== "string" || !wantedItem.trim())) {
        return res.status(400).json({ error: "Wanted item description is required for exchange listings." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const listingUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/listings/${listingId}`;
      const listingRes = await fetch(listingUrl, {
        headers: { Authorization: `Bearer ${systemToken}` },
      });
      if (!listingRes.ok) {
        return res.status(404).json({ error: "Listing not found." });
      }
      const rawListingDoc = await listingRes.json();
      const listingData = parseFirestoreDoc(rawListingDoc);

      const nowIso = new Date().toISOString();
      const updatedFields: Record<string, any> = {
        ...rawListingDoc.fields,
        title: { stringValue: String(title).trim() },
        description: { stringValue: String(description).trim() },
        category: { stringValue: String(category).trim() },
        type: { stringValue: String(type).trim() },
        location: { stringValue: String(location).trim() },
        updatedAt: { timestampValue: nowIso },
      };

      const updateMask = ["title", "description", "category", "type", "location", "updatedAt"];
      if (condition) {
        updatedFields.condition = { stringValue: String(condition).trim() };
        updateMask.push("condition");
      }
      if (type === "Exchange" && wantedItem) {
        updatedFields.wantedItem = { stringValue: String(wantedItem).trim() };
        updateMask.push("wantedItem");
      }
      if (price !== undefined && price !== null && price !== "") {
        const numPrice = Number(price);
        if (isNaN(numPrice) || numPrice < 0) {
          return res.status(400).json({ error: "Invalid price value." });
        }
        updatedFields.price = Number.isInteger(numPrice) ? { integerValue: String(numPrice) } : { doubleValue: numPrice };
        updateMask.push("price");
      }

      const targetWrite: FirestoreWrite = {
        update: {
          name: rawListingDoc.name,
          fields: updatedFields,
        },
        updateMask: { fieldPaths: updateMask },
        currentDocument: rawListingDoc.updateTime ? { updateTime: rawListingDoc.updateTime } : undefined,
      };

      await commitAdminMutationWithAudit(systemToken, targetWrite, {
        adminId: admin.uid,
        adminEmail: admin.email,
        action: "EDIT_LISTING",
        targetType: "listing",
        targetId: listingId,
        targetUserId: listingData.sellerId,
        reason: (reason || "Admin edited listing details").trim(),
        metadata: { title, category, type },
      });

      await logActivity(systemToken, {
        userId: listingData.sellerId || admin.uid,
        action: "moderation_action",
        targetType: "listing",
        targetId: listingId,
        details: { action: "EDIT_LISTING", reason: (reason || "Admin update").trim() },
      });

      return res.json({ message: "Listing updated successfully." });
    } catch (err: any) {
      console.error("Admin edit listing error:", err);
      return res.status(500).json({ error: "Internal server error editing listing." });
    }
  });

  // Admin Endpoint: Requests List
  app.get("/api/admin/requests", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const [requests, users] = await Promise.all([
        fetchFirestoreCollection(systemToken, "requests", 500),
        fetchFirestoreCollection(systemToken, "users", 500),
      ]);

      const userMap = new Map<string, any>();
      for (const u of users) {
        userMap.set(u.id, u);
      }

      const enhancedRequests = requests.map((r) => {
        const requester = userMap.get(r.requesterId);
        return {
          ...r,
          requesterName: requester?.name || "Student",
          requesterEmail: requester?.email || "",
          requesterDepartment: requester?.department || "",
        };
      });

      enhancedRequests.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return res.json({ requests: enhancedRequests });
    } catch (err: any) {
      console.error("Admin requests error:", err);
      return res.status(500).json({ error: "Internal server error fetching requests." });
    }
  });

  // Admin Endpoint: Edit Request Details Safely
  app.post("/api/admin/requests/edit", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const { requestId, title, description, category, neededBy, location, budget, reason } = req.body;
      if (!requestId || !title || typeof title !== "string" || !title.trim() ||
          !description || typeof description !== "string" || !description.trim() ||
          !category || typeof category !== "string" || !category.trim() ||
          !neededBy || typeof neededBy !== "string" || !neededBy.trim() ||
          !location || typeof location !== "string" || !location.trim()) {
        return res.status(400).json({ error: "Missing required request fields: title, description, category, neededBy, and location are required." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const requestUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/requests/${requestId}`;
      const requestRes = await fetch(requestUrl, {
        headers: { Authorization: `Bearer ${systemToken}` },
      });
      if (!requestRes.ok) {
        return res.status(404).json({ error: "Request not found." });
      }
      const rawRequestDoc = await requestRes.json();
      const requestData = parseFirestoreDoc(rawRequestDoc);

      const nowIso = new Date().toISOString();
      const updatedFields: Record<string, any> = {
        ...rawRequestDoc.fields,
        title: { stringValue: title.trim() },
        description: { stringValue: description.trim() },
        category: { stringValue: category.trim() },
        neededBy: { stringValue: neededBy.trim() },
        location: { stringValue: location.trim() },
        updatedAt: { timestampValue: nowIso },
      };

      const updateMask = ["title", "description", "category", "neededBy", "location", "updatedAt"];
      if (budget !== undefined && budget !== null && budget !== "") {
        const numBudget = Number(budget);
        if (!isNaN(numBudget) && numBudget >= 0) {
          updatedFields.budget = Number.isInteger(numBudget) ? { integerValue: String(numBudget) } : { doubleValue: numBudget };
          updateMask.push("budget");
        }
      }

      const targetWrite: FirestoreWrite = {
        update: {
          name: rawRequestDoc.name,
          fields: updatedFields,
        },
        updateMask: { fieldPaths: updateMask },
        currentDocument: rawRequestDoc.updateTime ? { updateTime: rawRequestDoc.updateTime } : undefined,
      };

      await commitAdminMutationWithAudit(systemToken, targetWrite, {
        adminId: admin.uid,
        adminEmail: admin.email,
        action: "EDIT_REQUEST",
        targetType: "request",
        targetId: requestId,
        targetUserId: requestData.requesterId,
        reason: (reason || "Admin update request details").trim(),
        metadata: { title, category },
      });

      await logActivity(systemToken, {
        userId: requestData.requesterId || admin.uid,
        action: "moderation_action",
        targetType: "request",
        targetId: requestId,
        details: { action: "EDIT_REQUEST", reason: (reason || "Admin update").trim() },
      });

      return res.json({ message: "Request updated successfully." });
    } catch (err: any) {
      console.error("Admin edit request error:", err);
      return res.status(500).json({ error: "Internal server error editing request." });
    }
  });

  // Admin Endpoint: Moderate Request (Remove / Restore)
  app.post("/api/admin/requests/moderate", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const { requestId, action, reason } = req.body;
      if (!requestId || !action || !reason || typeof reason !== "string" || !reason.trim()) {
        return res.status(400).json({ error: "Request ID, action, and reason are required." });
      }

      if (!["remove", "restore"].includes(action)) {
        return res.status(400).json({ error: "Invalid action. Must be 'remove' or 'restore'." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const requestUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/requests/${requestId}`;
      const requestRes = await fetch(requestUrl, {
        headers: { Authorization: `Bearer ${systemToken}` },
      });
      if (!requestRes.ok) {
        return res.status(404).json({ error: "Request not found." });
      }
      const rawRequestDoc = await requestRes.json();
      const requestData = parseFirestoreDoc(rawRequestDoc);

      const targetStatus = action === "remove" ? "removed" : "open";
      const auditAction = action === "remove" ? "REMOVE_REQUEST" : "RESTORE_REQUEST";
      const nowIso = new Date().toISOString();

      const targetWrite: FirestoreWrite = {
        update: {
          name: rawRequestDoc.name,
          fields: {
            ...rawRequestDoc.fields,
            status: { stringValue: targetStatus },
            moderationReason: { stringValue: reason.trim() },
            moderatedAt: { stringValue: nowIso },
            moderatedBy: { stringValue: admin.email },
            updatedAt: { timestampValue: nowIso },
          },
        },
        updateMask: {
          fieldPaths: ["status", "moderationReason", "moderatedAt", "moderatedBy", "updatedAt"],
        },
        currentDocument: rawRequestDoc.updateTime ? { updateTime: rawRequestDoc.updateTime } : undefined,
      };

      await commitAdminMutationWithAudit(systemToken, targetWrite, {
        adminId: admin.uid,
        adminEmail: admin.email,
        action: auditAction,
        targetType: "request",
        targetId: requestId,
        targetUserId: requestData.requesterId,
        reason: reason.trim(),
        metadata: { newStatus: targetStatus },
      });

      await logActivity(systemToken, {
        userId: requestData.requesterId || admin.uid,
        action: "moderation_action",
        targetType: "request",
        targetId: requestId,
        details: { action: auditAction, reason: reason.trim(), newStatus: targetStatus },
      });

      return res.json({ message: `Request successfully ${action === "remove" ? "removed" : "restored"}.` });
    } catch (err: any) {
      console.error("Admin moderate request error:", err);
      return res.status(500).json({ error: "Internal server error moderating request." });
    }
  });

  // Admin Endpoint: Reservations List (Strictly Read-Only)
  app.get("/api/admin/reservations", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const [reservations, listings, users] = await Promise.all([
        fetchFirestoreCollection(systemToken, "reservations", 500),
        fetchFirestoreCollection(systemToken, "listings", 500),
        fetchFirestoreCollection(systemToken, "users", 500),
      ]);

      const userMap = new Map<string, any>();
      for (const u of users) {
        userMap.set(u.id, u);
      }

      const listingMap = new Map<string, any>();
      for (const l of listings) {
        listingMap.set(l.id, l);
      }

      const enhancedReservations = reservations.map((resItem) => {
        const buyer = userMap.get(resItem.buyerId);
        const seller = userMap.get(resItem.sellerId);
        const listing = listingMap.get(resItem.listingId);
        return {
          ...resItem,
          buyerName: buyer?.name || "Student Buyer",
          buyerEmail: buyer?.email || "",
          sellerName: seller?.name || "Student Seller",
          sellerEmail: seller?.email || "",
          listingTitle: listing?.title || "Listing Item",
          listingPrice: listing?.price !== undefined ? listing.price : 0,
          listingType: listing?.type || "Sale",
          listingImage: Array.isArray(listing?.images) && listing.images.length > 0 ? listing.images[0] : "",
        };
      });

      enhancedReservations.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return res.json({ reservations: enhancedReservations });
    } catch (err: any) {
      console.error("Admin reservations error:", err);
      return res.status(500).json({ error: "Internal server error fetching reservations." });
    }
  });

  // Admin Endpoint: Reports List
  app.get("/api/admin/reports", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const allReports = await fetchFirestoreCollection(systemToken, "reports", 500);
      const { status } = req.query;

      let filtered = allReports;
      if (status && typeof status === "string" && status !== "all") {
        filtered = allReports.filter((r) => r.status === status);
      }

      filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return res.json({ reports: filtered });
    } catch (err: any) {
      console.error("Admin reports error:", err);
      return res.status(500).json({ error: "Internal server error fetching reports." });
    }
  });

  // Admin Endpoint: Resolve/Dismiss Report
  app.post("/api/admin/reports/resolve", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const { reportId, resolution, actionTaken } = req.body;
      if (!reportId || !actionTaken) {
        return res.status(400).json({ error: "Report ID and actionTaken are required." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const reportUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/reports/${reportId}`;
      const reportRes = await fetch(reportUrl, {
        headers: { Authorization: `Bearer ${systemToken}` },
      });
      if (!reportRes.ok) {
        return res.status(404).json({ error: "Report not found." });
      }
      const rawReportDoc = await reportRes.json();
      const reportData = parseFirestoreDoc(rawReportDoc);

      const targetReportStatus = actionTaken === "dismiss" ? "dismissed" : actionTaken === "review" ? "reviewing" : "resolved";
      const nowIso = new Date().toISOString();

      // 1. Update the report document write
      const targetWrite: FirestoreWrite = {
        update: {
          name: rawReportDoc.name,
          fields: {
            ...rawReportDoc.fields,
            status: { stringValue: targetReportStatus },
            resolution: { stringValue: (resolution || "").trim() },
            actionTaken: { stringValue: actionTaken },
            reviewedBy: { stringValue: admin.email },
            reviewedAt: { stringValue: nowIso },
          },
        },
        updateMask: {
          fieldPaths: ["status", "resolution", "actionTaken", "reviewedBy", "reviewedAt"],
        },
        currentDocument: rawReportDoc.updateTime ? { updateTime: rawReportDoc.updateTime } : undefined,
      };

      const extraWrites: FirestoreWrite[] = [];

      // 2. Cascade actions if specified
      if (actionTaken === "hide_listing" || actionTaken === "remove_listing") {
        if (reportData.listingId) {
          const listUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/listings/${reportData.listingId}`;
          const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${systemToken}` } });
          if (listRes.ok) {
            const rawListDoc = await listRes.json();
            const listStatus = actionTaken === "hide_listing" ? "hidden" : "removed";
            extraWrites.push({
              update: {
                name: rawListDoc.name,
                fields: {
                  ...rawListDoc.fields,
                  status: { stringValue: listStatus },
                  moderationReason: { stringValue: resolution || "Moderated via report" },
                  moderatedAt: { stringValue: nowIso },
                  moderatedBy: { stringValue: admin.email },
                },
              },
              updateMask: {
                fieldPaths: ["status", "moderationReason", "moderatedAt", "moderatedBy"],
              },
              currentDocument: rawListDoc.updateTime ? { updateTime: rawListDoc.updateTime } : undefined,
            });
          }
        }
      } else if (actionTaken === "suspend_user" && reportData.reportedUserId) {
        const userUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${reportData.reportedUserId}`;
        const userRes = await fetch(userUrl, { headers: { Authorization: `Bearer ${systemToken}` } });
        if (userRes.ok) {
          const rawUserDoc = await userRes.json();
          extraWrites.push({
            update: {
              name: rawUserDoc.name,
              fields: {
                ...rawUserDoc.fields,
                status: { stringValue: "suspended" },
                statusReason: { stringValue: (resolution || "Suspended via report resolution").trim() },
                suspendedAt: { stringValue: nowIso },
                statusUpdatedAt: { stringValue: nowIso },
              },
            },
            updateMask: {
              fieldPaths: ["status", "statusReason", "suspendedAt", "statusUpdatedAt"],
            },
            currentDocument: rawUserDoc.updateTime ? { updateTime: rawUserDoc.updateTime } : undefined,
          });
        }
      }

      const auditAction = actionTaken === "dismiss" ? "REPORT_DISMISSED" : "REPORT_RESOLVED";

      await commitAdminMutationWithAudit(systemToken, targetWrite, {
        adminId: admin.uid,
        adminEmail: admin.email,
        action: auditAction,
        targetType: "report",
        targetId: reportId,
        targetUserId: reportData.reportedUserId,
        reason: (resolution || actionTaken).trim(),
        metadata: { actionTaken, listingId: reportData.listingId },
      }, extraWrites);

      return res.json({ message: `Report successfully ${targetReportStatus === 'reviewing' ? 'marked under review' : targetReportStatus}.` });
    } catch (err: any) {
      console.error("Admin resolve report error:", err);
      return res.status(500).json({ error: "Internal server error resolving report." });
    }
  });

  // Admin Endpoint: Audit Logs
  app.get("/api/admin/audit-logs", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const logs = await fetchFirestoreCollection(systemToken, "admin_audit_logs", 500);
      logs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      return res.json({ logs });
    } catch (err: any) {
      console.error("Admin audit logs error:", err);
      return res.status(500).json({ error: "Internal server error fetching audit logs." });
    }
  });

  // Admin Endpoint: Activity Logs
  app.get("/api/admin/activity-logs", async (req, res) => {
    try {
      const admin = await verifyAdminCaller(req);
      if (!admin) {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      const systemToken = getEffectiveToken(req, await getServerToken());
      if (!systemToken) {
        return res.status(503).json({ error: "System service unavailable." });
      }

      const logs = await fetchFirestoreCollection(systemToken, "activity_logs", 500);
      const { user, action, date } = req.query;

      let filtered = logs;
      if (user && typeof user === "string" && user.trim()) {
        const q = user.toLowerCase().trim();
        filtered = filtered.filter((l) =>
          (l.userId && l.userId.toLowerCase().includes(q)) ||
          (l.userEmail && l.userEmail.toLowerCase().includes(q))
        );
      }

      if (action && typeof action === "string" && action !== "all") {
        filtered = filtered.filter((l) => l.action === action);
      }

      if (date && typeof date === "string" && date !== "all") {
        const now = Date.now();
        if (date === "today") {
          filtered = filtered.filter((l) => now - new Date(l.timestamp || 0).getTime() <= 24 * 60 * 60 * 1000);
        } else if (date === "7days") {
          filtered = filtered.filter((l) => now - new Date(l.timestamp || 0).getTime() <= 7 * 24 * 60 * 60 * 1000);
        } else if (date === "30days") {
          filtered = filtered.filter((l) => now - new Date(l.timestamp || 0).getTime() <= 30 * 24 * 60 * 60 * 1000);
        }
      }

      filtered.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      return res.json({ logs: filtered });
    } catch (err: any) {
      console.error("Admin activity logs error:", err);
      return res.status(500).json({ error: "Internal server error fetching activity logs." });
    }
  });

  // Run cleanup jobs 5 seconds after server start, then every 15 minutes
  setTimeout(() => {
    runExpiredListingsCleanup().catch((err) => console.warn("Initial cleanup notice:", err));
    runExpiredRequestsCleanup().catch((err) => console.warn("Initial requests cleanup notice:", err));
  }, 5000).unref();

  setInterval(() => {
    runExpiredListingsCleanup().catch((err) => console.warn("Interval cleanup notice:", err));
    runExpiredRequestsCleanup().catch((err) => console.warn("Interval requests cleanup notice:", err));
  }, 15 * 60 * 1000).unref();

  // Graceful PayloadTooLargeError and body parser error handling for API routes
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.type === "entity.too.large" || err.status === 413 || err.name === "PayloadTooLargeError") {
      return res.status(413).json({
        error: "Payload too large. The submitted request exceeds the allowed size limit."
      });
    }
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "Malformed JSON payload in request." });
    }
    if (req.path.startsWith("/api")) {
      console.error(`API Error [${req.method} ${req.path}]:`, err?.message || err);
      const statusCode = typeof err.status === "number" && err.status >= 400 && err.status < 600 ? err.status : 500;
      return res.status(statusCode).json({
        error: statusCode < 500 ? (err.message || "Request failed.") : "An unexpected server error occurred."
      });
    }
    next(err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Serve service worker scripts with strict no-cache and root Service-Worker-Allowed header
    app.use((req, res, next) => {
      if (req.path === '/firebase-messaging-sw.js' || req.path === '/sw.js') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Service-Worker-Allowed', '/');
      }
      next();
    });
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`Received ${signal}. Gracefully shutting down HTTP server...`);
    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("Graceful shutdown timeout exceeded. Exiting forcibly.");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception — exiting process safely:", error);
  process.exit(1);
});

startServer();
