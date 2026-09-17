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

// Load Firebase Config for REST API
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
const { projectId, firestoreDatabaseId, apiKey } = firebaseConfig;

// Server-side persistent token caching for internal system account
let serverToken: string | null = null;
let serverTokenExpiry = 0;

async function getServerToken(): Promise<string> {
  if (serverToken && Date.now() < serverTokenExpiry - 60000) {
    return serverToken;
  }

  const systemEmail = process.env.INTERNAL_SYSTEM_EMAIL?.trim();
  const systemPassword = process.env.INTERNAL_SYSTEM_PASSWORD?.trim();

  if (!systemEmail || !systemPassword) {
    throw new Error("Internal system credentials are not configured.");
  }

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
    throw new Error(`Server authentication failed: ${JSON.stringify(data)}`);
  }
  serverToken = data.idToken;
  serverTokenExpiry = Date.now() + (parseInt(data.expiresIn, 10) || 3600) * 1000;
  return serverToken!;
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

  // Strict CORS Validation: Allows production, localhost, and verified AI Studio development environments
  const isAllowedOrigin = (origin: string): boolean => {
    try {
      const url = new URL(origin);
      const hostname = url.hostname;

      // 1. Official production domains
      if (
        hostname === "studentneed.me" ||
        hostname === "www.studentneed.me" ||
        hostname.endsWith(".studentneed.me")
      ) {
        return true;
      }

      // 2. Local development
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0"
      ) {
        return true;
      }

      // 3. Google AI Studio preview & runner environment
      if (
        hostname === "ai.studio" ||
        hostname.endsWith(".ai.studio") ||
        hostname.endsWith(".google.com") ||
        hostname.endsWith(".googleusercontent.com")
      ) {
        return true;
      }

      // 4. Current application development / preview URLs
      if (
        origin === "https://ais-dev-gti23zzly6wg7xqqzhxl5a-361860804341.asia-east1.run.app" ||
        origin === "https://ais-pre-gti23zzly6wg7xqqzhxl5a-361860804341.asia-east1.run.app" ||
        (process.env.APP_URL && origin === process.env.APP_URL)
      ) {
        return true;
      }

      // 5. Configured frontend URL
      if (process.env.FRONTEND_URL) {
        try {
          if (new URL(process.env.FRONTEND_URL).origin === origin) return true;
        } catch {}
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

  // Global Body Limit: strictly 100KB to mitigate memory exhaustion/DoS attacks
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ limit: "100kb", extended: true }));

  // Helper to lazily initialize Resend client
  const getResendClient = () => {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) return null;
    return new Resend(apiKey);
  };

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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

  // 4. Authenticated Image Upload Proxy (Validates Firebase Auth ID token and payload format)
  app.post("/api/upload/image", express.json({ limit: "6mb" }), async (req, res) => {
    try {
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

      const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME || "ddc64bq61";
      const uploadPreset = process.env.VITE_CLOUDINARY_UPLOAD_PRESET || "studentneed_images";

      const formData = new URLSearchParams();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);
      formData.append("folder", uploadFolder);

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

  // 5. Authorized Reservation Completion & Listing Status Synchronization
  app.post("/api/reservations/complete", async (req, res) => {
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
