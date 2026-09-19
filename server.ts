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

// Load Firebase Config for REST API
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
const { projectId, firestoreDatabaseId, apiKey } = firebaseConfig;

// Server-side persistent token caching for internal system account
let serverToken: string | null = null;
let serverTokenExpiry = 0;

async function getServerToken(): Promise<string | null> {
  if (serverToken && Date.now() < serverTokenExpiry - 60000) {
    return serverToken;
  }

  const systemEmail = process.env.INTERNAL_SYSTEM_EMAIL?.trim();
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

// In-memory IP rate limiter for auth endpoints
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const ipRateLimits = new Map<string, RateLimitBucket>();

function checkIpRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = ipRateLimits.get(key);
  if (!bucket || now > bucket.resetAt) {
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

async function getOtpRecord(emailDocId: string): Promise<OtpFirestoreDoc | null> {
  try {
    const token = await getServerToken();
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
    res.json({ status: "ok" });
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
     * Central Library
     * Food Court
     * Hostel
     * CSE Block
     * ECE Block
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
      return "StudentNeed works in 3 simple campus-focused steps:\n\n1. **Find**: Browse items on the Marketplace (/marketplace) with filters, or post an Item Request (/create-request) if you can't find what you need.\n2. **Connect**: Chat 1-on-1 with fellow students in real-time (/chat) to discuss details or submit an item reservation.\n3. **Meet**: Coordinate a safe in-person campus meetup at approved spots (like Central Library or Main Gate) and complete the exchange.";
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
      return "Contacting Sellers & Campus Meetups:\n- On any listing page (/listing/:id), click **Contact Student** to chat or **Reserve Item** to submit a hold request.\n- When the seller accepts the reservation, the item status changes to 'reserved'.\n- Either student can propose an approved campus meetup location:\n  * **Main Gate**\n  * **Central Library**\n  * **Food Court**\n  * **Hostel**\n  * **CSE Block**\n  * **ECE Block**\n  * The other student confirms the location. After completing the in-person exchange on campus, either student clicks **Complete Exchange**.";
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

          const response = await ai.models.generateContent({
            model: modelName,
            contents: formattedContents as any,
            config: {
              systemInstruction: STUDENTNEED_SYSTEM_INSTRUCTION,
              maxOutputTokens: 800,
              temperature: 0.2,
            },
          });

          const replyText = response.text?.trim();
          if (replyText) {
            return res.json({ reply: replyText, source: "ai" });
          }
        } catch (aiErr: any) {
          // Log safe diagnostic notice without exposing any keys or credentials
          console.warn("[Campus Assistant Notice] Upstream AI dispatch failed, using verified knowledge base fallback:", aiErr?.status || aiErr?.code || "Generation unavailable");
        }
      }

      // Safe deterministic knowledge base fallback (always available even if GEMINI_API_KEY is unset or fails)
      const fallbackReply = getDeterministicKnowledgeResponse(trimmedMessage);
      return res.json({ reply: fallbackReply, source: "knowledge_base" });
    } catch (err: any) {
      console.error("[Campus Assistant Endpoint Error]:", err?.message || "Internal error");
      return res.status(500).json({ error: "Unable to process assistant request at this time. Please try again." });
    }
  });

  // 1. Send OTP (Rate-limited via trusted req.ip)
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkIpRateLimit(`send-otp:${clientIp}`, 10, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many verification requests from this IP address. Please wait 10 minutes." });
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

  // 2. Verify OTP (Rate-limited via trusted req.ip)
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkIpRateLimit(`verify-otp:${clientIp}`, 20, 10 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many verification attempts from this IP address. Please wait 10 minutes." });
      }

      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ error: "Email and OTP are required." });
      }

      const normalizedEmail = email.toLowerCase().trim();
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

  // 3. Finalize Account using REST API: Writes public profile without PII and private profile to /users/{uid}/private/profile
  app.post("/api/auth/finalize-account", async (req, res) => {
    try {
      const { uid, email, name, department, avatarUrl, idToken } = req.body;

      if (!uid || !email || !idToken) {
        return res.status(400).json({ error: "UID, email, and idToken are required." });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const allowedDomain = (process.env.COLLEGE_EMAIL_DOMAIN || "@student.annauniv.edu").trim();
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

  // 6. Authorized Reservation Completion & Listing Status Synchronization
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

      return res.json({ message: "Reservation and listing successfully marked as completed." });
    } catch (err: any) {
      console.error("Complete reservation error:", err);
      return res.status(500).json({ error: "Internal server error completing reservation." });
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

  async function verifyAdminOrSystem(req: express.Request): Promise<boolean> {
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
      if (!user) return false;
      if (user.email === "admin@student.annauniv.edu" || user.email === process.env.INTERNAL_SYSTEM_EMAIL) {
        return true;
      }
      const systemToken = await getServerToken();
      const userDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${user.localId}`;
      const userDocRes = await fetch(userDocUrl, {
        headers: { Authorization: `Bearer ${systemToken}` },
      });
      if (userDocRes.ok) {
        const userDoc = await userDocRes.json();
        if (userDoc.fields?.role?.stringValue === "admin") {
          return true;
        }
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

      // 2. Query and delete all user listings and their Cloudinary assets
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

  // Run cleanup job 5 seconds after server start, then every 15 minutes
  setTimeout(() => {
    runExpiredListingsCleanup().catch((err) => console.warn("Initial cleanup notice:", err));
  }, 5000).unref();

  setInterval(() => {
    runExpiredListingsCleanup().catch((err) => console.warn("Interval cleanup notice:", err));
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
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
