import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
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
  const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const res = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "internal.system@student.annauniv.edu",
      password: "InternalSystemSecretPassword2026!",
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

  app.use(
    cors({
      origin: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
      credentials: true,
    })
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Helper to lazily initialize Resend client
  const getResendClient = () => {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) return null;
    return new Resend(apiKey);
  };

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // 1. Send OTP
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
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
        console.warn(`[DEV MODE] RESEND_API_KEY not configured. OTP for ${normalizedEmail} is: ${otp}`);
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
          console.warn(`[DEV FALLBACK] Resend failed. OTP for ${normalizedEmail} is: ${otp}`);
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

  // 2. Verify OTP
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
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

      const isValid = await bcrypt.compare(otp.toString().trim(), data.hash);

      if (!isValid) {
        data.attempts += 1;
        await saveOtpRecord(emailDocId, data);
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

  // 3. Finalize Account using REST API to avoid Web SDK errors
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

      // Use Firestore REST API to securely create the document acting as the user
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users?documentId=${uid}`;
      
      const firestorePayload = {
        fields: {
          id: { stringValue: uid },
          name: { stringValue: name || '' },
          email: { stringValue: normalizedEmail },
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
          "Authorization": `Bearer ${idToken}`
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
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify(firestorePayload)
        });
        
        if (!patchRes.ok) {
           const errText = await patchRes.text();
           console.error("Firestore REST Error:", errText);
           return res.status(500).json({ error: "Failed to create user profile in database." });
        }
      }

      // Clean up the verified temporary OTP record to prevent replay
      await deleteOtpRecord(emailDocId);
      res.json({ message: "Account finalized successfully." });
    } catch (error: any) {
      console.error("Finalize Account Error:", error);
      res.status(500).json({ error: "Internal server error." });
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
