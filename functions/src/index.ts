import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { onRequest } from "firebase-functions/v2/https";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Resend } from "resend";

// Initialize Firebase Admin SDK once
if (getApps().length === 0) {
  initializeApp();
}

const FIRESTORE_DATABASE_ID = (process.env.FIRESTORE_DATABASE_ID || "ai-studio-studentneed-4d3006be-d546-44c7-b37a-4536f7d5aff9").trim();
const db = getFirestore(FIRESTORE_DATABASE_ID);
const auth = getAuth();

const app = express();

// Express configuration
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ limit: "100kb", extended: true }));

// Helper to lazily initialize Resend client with secret
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
};

// Password policy validator
function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!password || password.length < 8) {
    errors.push("Password must be at least 8 characters long.");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter.");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter.");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number.");
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push("Password must contain at least one special character.");
  }
  return { valid: errors.length === 0, errors };
}

// Distributed rate limiter using Firestore
async function checkDistributedRateLimit(key: string, limit: number, windowMs: number) {
  try {
    const docRef = db.collection("rate_limits").doc(crypto.createHash("sha256").update(key).digest("hex"));
    const now = Date.now();
    const doc = await docRef.get();

    if (!doc.exists) {
      await docRef.set({ count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const data = doc.data() as { count: number; resetAt: number };
    if (now > data.resetAt) {
      await docRef.set({ count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (data.count >= limit) {
      const retryAfterSeconds = Math.ceil((data.resetAt - now) / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    await docRef.update({ count: FieldValue.increment(1) });
    return { allowed: true, retryAfterSeconds: 0 };
  } catch (err) {
    console.warn("Rate limit check error:", err);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

function sendRateLimitResponse(res: express.Response, retryAfterSeconds: number, message: string) {
  res.setHeader("Retry-After", String(retryAfterSeconds));
  return res.status(429).json({ error: message, retryAfterSeconds });
}

// College email check
function isAllowedCollegeEmail(email: string): boolean {
  const normalized = email.toLowerCase().trim();
  const rawDomain = (process.env.COLLEGE_EMAIL_DOMAIN || "student.annauniv.edu").trim().replace(/^@/, "");
  return normalized.endsWith(`@${rawDomain}`);
}

// In-flight OTP verification lock
const inFlightOtpVerifications = new Set<string>();

// --- 1. Health Probe ---
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    runtime: "firebase-functions",
    environment: process.env.NODE_ENV || "production",
    timestamp: Date.now(),
  });
});

// --- 2. Send OTP ---
app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const clientIp = req.ip || "unknown";
    const ipLimit = await checkDistributedRateLimit(`send-otp:ip:${clientIp}`, 15, 10 * 60 * 1000);
    if (!ipLimit.allowed) {
      return sendRateLimitResponse(res, ipLimit.retryAfterSeconds, "Too many verification requests from this network. Please wait.");
    }

    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email address is required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!isAllowedCollegeEmail(normalizedEmail)) {
      return res.status(403).json({ error: "Only official @student.annauniv.edu emails are eligible to register." });
    }

    const emailLimit = await checkDistributedRateLimit(`send-otp:email:${normalizedEmail}`, 5, 10 * 60 * 1000);
    if (!emailLimit.allowed) {
      return sendRateLimitResponse(res, emailLimit.retryAfterSeconds, "Too many OTP requests for this account. Please wait a few minutes.");
    }

    // Generate secure 6-digit OTP
    const otp = Math.floor(100000 + crypto.randomInt(900000)).toString();
    const hash = await bcrypt.hash(otp, 10);
    const emailDocId = crypto.createHash("sha256").update(normalizedEmail).digest("hex");

    // Store in Firestore temp_otps
    await db.collection("temp_otps").doc(emailDocId).set({
      hash,
      attempts: 0,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
      used: false,
      verified: false,
      createdAt: Date.now(),
    });

    const resend = getResendClient();
    if (resend) {
      try {
        await resend.emails.send({
          from: "StudentNeed <auth@studentneed.me>",
          to: normalizedEmail,
          subject: `${otp} is your StudentNeed verification code`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #1a1a1a; margin-bottom: 16px;">Verify your student email</h2>
              <p style="color: #4a4a4a; line-height: 1.5;">Welcome to <strong>StudentNeed</strong>, the exclusive peer-to-peer campus marketplace for Anna University.</p>
              <div style="margin: 24px 0; padding: 16px; background-color: #f7f6f2; border-radius: 8px; text-align: center;">
                <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0d9488;">${otp}</span>
              </div>
              <p style="color: #666; font-size: 14px;">This code will expire in 15 minutes. Never share this code with anyone.</p>
            </div>
          `,
        });
      } catch (emailErr: any) {
        console.error("Resend API error:", emailErr?.message || emailErr);
        return res.status(500).json({ error: "Failed to dispatch verification email. Please try again later." });
      }
    } else {
      console.info(`[DEV MODE] Generated OTP for ${normalizedEmail}: ${otp}`);
    }

    return res.json({ message: "Verification code sent to your student email." });
  } catch (error: any) {
    console.error("Send OTP Error:", error);
    return res.status(500).json({ error: "Failed to send verification code. Please try again." });
  }
});

// --- 3. Verify OTP ---
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const clientIp = req.ip || "unknown";
    const ipLimit = await checkDistributedRateLimit(`verify-otp:ip:${clientIp}`, 40, 10 * 60 * 1000);
    if (!ipLimit.allowed) {
      return sendRateLimitResponse(res, ipLimit.retryAfterSeconds, "Too many verification attempts from this network.");
    }

    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailDocId = crypto.createHash("sha256").update(normalizedEmail).digest("hex");

    if (inFlightOtpVerifications.has(emailDocId)) {
      return res.status(429).json({ error: "Verification in progress. Please wait a moment." });
    }
    inFlightOtpVerifications.add(emailDocId);

    try {
      const docRef = db.collection("temp_otps").doc(emailDocId);
      const snap = await docRef.get();

      if (!snap.exists) {
        return res.status(400).json({ error: "No pending verification found or OTP expired." });
      }

      const data = snap.data() as any;
      if (data.used) {
        return res.status(400).json({ error: "This verification code has already been used. Please request a new code." });
      }

      if (Date.now() > data.expiresAt) {
        await docRef.delete();
        return res.status(400).json({ error: "This verification code has expired. Please request a new code." });
      }

      if (data.attempts >= 5) {
        await docRef.delete();
        return res.status(429).json({ error: "Too many failed attempts. Please request a new OTP." });
      }

      // Increment attempt counter
      await docRef.update({ attempts: FieldValue.increment(1) });

      const isValid = await bcrypt.compare(otp.toString().trim(), data.hash);
      if (!isValid) {
        if (data.attempts + 1 >= 5) {
          await docRef.delete();
          return res.status(429).json({ error: "Too many failed attempts. Please request a new OTP." });
        }
        return res.status(400).json({ error: "Invalid verification code. Please check and try again." });
      }

      // Generate cryptographically random registration token
      const registrationToken = crypto.randomBytes(24).toString("hex");

      await docRef.update({
        used: true,
        verified: true,
        verifiedExpiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes to complete profile
        registrationToken,
      });

      return res.json({
        message: "Email verified successfully.",
        registrationToken,
      });
    } finally {
      inFlightOtpVerifications.delete(emailDocId);
    }
  } catch (error: any) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({ error: "An unexpected error occurred during verification." });
  }
});

// --- 4. Create Account ---
const handleAccountCreation = async (req: express.Request, res: express.Response) => {
  try {
    const clientIp = req.ip || "unknown";
    const ipLimit = await checkDistributedRateLimit(`create-account:ip:${clientIp}`, 15, 10 * 60 * 1000);
    if (!ipLimit.allowed) {
      return sendRateLimitResponse(res, ipLimit.retryAfterSeconds, "Too many account creation requests.");
    }

    const { email, password, registrationToken } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Password does not meet the security requirements.",
        details: validation.errors,
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!isAllowedCollegeEmail(normalizedEmail)) {
      return res.status(403).json({ error: "Please use your official college email address." });
    }

    const emailDocId = crypto.createHash("sha256").update(normalizedEmail).digest("hex");
    const otpDoc = await db.collection("temp_otps").doc(emailDocId).get();

    if (!otpDoc.exists) {
      return res.status(403).json({ error: "Email not verified or verification expired. Please complete email verification first." });
    }

    const otpData = otpDoc.data() as any;
    if (!otpData.verified || Date.now() > otpData.verifiedExpiresAt) {
      return res.status(403).json({ error: "Email verification has expired. Please verify your email again." });
    }

    // Anti-bypass check: Verify server-issued registrationToken
    if (registrationToken && otpData.registrationToken && otpData.registrationToken !== registrationToken) {
      return res.status(403).json({ error: "Invalid registration session. Verification cannot be bypassed." });
    }

    // Create Firebase Auth user via Admin SDK
    try {
      const userRecord = await auth.createUser({
        email: normalizedEmail,
        password,
        emailVerified: true,
      });

      await db.collection("registered_emails").doc(emailDocId).set({
        uid: userRecord.uid,
        email: normalizedEmail,
        registeredAt: FieldValue.serverTimestamp(),
      });

      // Ensure every successfully registered student has a corresponding Firestore document in 'users'
      const userDocRef = db.collection("users").doc(userRecord.uid);
      const userSnap = await userDocRef.get();
      if (!userSnap.exists) {
        await userDocRef.set({
          id: userRecord.uid,
          uid: userRecord.uid,
          email: normalizedEmail,
          name: normalizedEmail.split('@')[0],
          department: "General",
          role: "student",
          status: "active",
          accountStatus: "active",
          isVerified: true,
          campus: "Madras Institute of Technology – Anna University",
          onboardingCompleted: false,
          rating: 0,
          ratingCount: 0,
          reviewCount: 0,
          trustScore: 100,
          exchangesCompleted: 0,
          completedTransactions: 0,
          successfulExchanges: 0,
          reputation: "New Student",
          badges: ["Anna Univ Student"],
          createdAt: FieldValue.serverTimestamp(),
          lastActiveAt: FieldValue.serverTimestamp(),
        });
      } else {
        await userDocRef.set({
          uid: userRecord.uid,
          email: normalizedEmail,
          status: userSnap.data()?.status || "active",
          accountStatus: userSnap.data()?.accountStatus || userSnap.data()?.status || "active",
        }, { merge: true });
      }

      return res.status(201).json({
        message: "Account created successfully.",
        uid: userRecord.uid,
      });
    } catch (authErr: any) {
      if (authErr?.code === "auth/email-already-exists") {
        await db.collection("registered_emails").doc(emailDocId).set({
          email: normalizedEmail,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return res.status(409).json({ error: "Email is already in use. Try signing in instead, or use a different email." });
      }
      throw authErr;
    }
  } catch (error: any) {
    console.error("Create Account Error:", error?.message || error);
    return res.status(500).json({ error: "Failed to create account. Please try again." });
  }
};

app.post("/api/auth/create-account", handleAccountCreation);
app.post("/api/auth/register", handleAccountCreation);

// --- 5. Finalize Account (Server-Side Profile Creation) ---
app.post("/api/auth/finalize-account", async (req, res) => {
  try {
    const clientIp = req.ip || "unknown";
    const ipLimit = await checkDistributedRateLimit(`finalize-account:ip:${clientIp}`, 20, 10 * 60 * 1000);
    if (!ipLimit.allowed) {
      return sendRateLimitResponse(res, ipLimit.retryAfterSeconds, "Too many profile finalization requests.");
    }

    const { uid, email, name, department, yearOfStudy, bio, avatarUrl, idToken, registrationToken } = req.body;
    if (!uid || !email || !idToken) {
      return res.status(400).json({ error: "UID, email, and idToken are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!isAllowedCollegeEmail(normalizedEmail)) {
      return res.status(403).json({ error: "Please use your official college email address." });
    }

    // 1. Verify caller owns this UID and email via Firebase Admin Auth verifyIdToken
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (tokenErr: any) {
      return res.status(401).json({ error: "Invalid or expired session token." });
    }

    if (decodedToken.uid !== uid || decodedToken.email?.toLowerCase().trim() !== normalizedEmail) {
      return res.status(403).json({ error: "Session identity mismatch." });
    }

    // 2. Verify registration authorization (valid OTP verification or existing registered student)
    const emailDocId = crypto.createHash("sha256").update(normalizedEmail).digest("hex");
    const otpDoc = await db.collection("temp_otps").doc(emailDocId).get();
    const regDoc = await db.collection("registered_emails").doc(emailDocId).get();

    const otpData = otpDoc.exists ? (otpDoc.data() as any) : null;
    const hasValidOtp = Boolean(
      otpData &&
      otpData.verified &&
      otpData.verifiedExpiresAt &&
      Date.now() <= otpData.verifiedExpiresAt &&
      (!registrationToken || !otpData.registrationToken || otpData.registrationToken === registrationToken)
    );
    const isRegistered = regDoc.exists;

    if (!hasValidOtp && !isRegistered) {
      return res.status(403).json({ error: "Email not verified or verification expired. You cannot create a profile." });
    }

    const cleanName = (name || "").trim().slice(0, 50);
    const cleanDept = (department || "").trim().slice(0, 50);
    const cleanYear = (yearOfStudy || "").trim().slice(0, 20);
    const cleanBio = (bio || "").trim().slice(0, 300);
    const finalAvatarUrl = avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${cleanName || "User"}&backgroundColor=000000`;

    // 3. Write public user profile in Firestore
    const userRef = db.collection("users").doc(uid);
    const existingSnap = await userRef.get();
    const existingData = existingSnap.exists ? existingSnap.data() : {};

    await userRef.set(
      {
        id: uid,
        uid: uid,
        email: normalizedEmail,
        name: cleanName,
        department: cleanDept,
        yearOfStudy: cleanYear,
        bio: cleanBio,
        avatarUrl: finalAvatarUrl,
        campus: "Madras Institute of Technology – Anna University",
        onboardingCompleted: true,
        isVerified: true,
        role: existingData?.role || "student",
        status: existingData?.status || "active",
        accountStatus: existingData?.accountStatus || existingData?.status || "active",
        rating: existingData?.rating ?? 0,
        ratingCount: existingData?.ratingCount ?? 0,
        reviewCount: existingData?.reviewCount ?? 0,
        trustScore: existingData?.trustScore ?? 100,
        exchangesCompleted: existingData?.exchangesCompleted ?? 0,
        completedTransactions: existingData?.completedTransactions ?? 0,
        successfulExchanges: existingData?.successfulExchanges ?? 0,
        reputation: existingData?.reputation || "New Student",
        badges: existingData?.badges || ["Anna Univ Student"],
        createdAt: existingData?.createdAt || FieldValue.serverTimestamp(),
        lastActiveAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 4. Write private profile subcollection
    await userRef.collection("private").doc("profile").set(
      {
        email: normalizedEmail,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 5. Mark email as registered and clean up used OTP
    await db.collection("registered_emails").doc(emailDocId).set(
      {
        uid,
        email: normalizedEmail,
        registeredAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (otpDoc.exists) {
      await db.collection("temp_otps").doc(emailDocId).delete().catch(() => {});
    }

    return res.json({
      success: true,
      message: "Student profile initialized and verified successfully.",
    });
  } catch (error: any) {
    console.error("Finalize Account Error:", error?.message || error);
    return res.status(500).json({ error: "Failed to finalize account. Please try again." });
  }
});

// --- 6. Forgot Password ---
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const clientIp = req.ip || "unknown";
    const ipLimit = await checkDistributedRateLimit(`forgot-password:ip:${clientIp}`, 10, 10 * 60 * 1000);
    if (!ipLimit.allowed) {
      return sendRateLimitResponse(res, ipLimit.retryAfterSeconds, "Too many password reset requests.");
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email address is required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!isAllowedCollegeEmail(normalizedEmail)) {
      return res.status(403).json({ error: "Please use your official college email address." });
    }

    const resend = getResendClient();
    try {
      const resetLink = await auth.generatePasswordResetLink(normalizedEmail);
      if (resend) {
        await resend.emails.send({
          from: "StudentNeed <auth@studentneed.me>",
          to: normalizedEmail,
          subject: "Reset your StudentNeed password",
          html: `
            <div style="font-family: sans-serif; max-width: 560px; padding: 24px;">
              <h2>Reset your password</h2>
              <p>We received a request to reset your StudentNeed account password.</p>
              <div style="margin: 24px 0;">
                <a href="${resetLink}" style="background-color: #0d9488; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Reset Password</a>
              </div>
              <p style="color: #666; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
            </div>
          `,
        });
      } else {
        console.info(`[DEV MODE] Password reset link for ${normalizedEmail}: ${resetLink}`);
      }
    } catch (err: any) {
      console.warn("Password reset note:", err?.message || err);
    }

    // Always return success to prevent email enumeration
    return res.json({ message: "If an account exists for this email, a reset link has been dispatched." });
  } catch (error: any) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({ error: "An unexpected error occurred." });
  }
});

// --- 7. Validate Password ---
app.post("/api/auth/validate-password", (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password is required." });
  }
  const result = validatePassword(password);
  return res.json(result);
});

// Export the HTTPS Cloud Function
export const api = onRequest(
  {
    region: "us-central1",
    cors: true,
    maxInstances: 10,
    secrets: ["RESEND_API_KEY", "GEMINI_API_KEY"],
  },
  app
);
