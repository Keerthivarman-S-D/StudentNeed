import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import fs from "fs";

// Load Firebase Config for REST API
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
const { projectId, firestoreDatabaseId } = firebaseConfig;

// In-Memory Stores to avoid Node.js Firebase Web SDK WebSocket errors (Code=unavailable)
const otpStore = new Map<string, { hash: string; expiresAt: number; attempts: number }>();
const verifiedEmails = new Map<string, { expiresAt: number }>();

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

  // Helper to lazily initialize Nodemailer SMTP transporter
  const getMailTransporter = () => {
    const host = (process.env.EMAIL_HOST || "smtp.gmail.com").trim();
    const port = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587;
    const user = (process.env.EMAIL_USER || "studentneed.info@gmail.com").trim();
    const pass = process.env.EMAIL_PASSWORD?.trim();

    if (!pass) return null;

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
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

      // Check cooldown (60s minimum interval)
      const existingOtp = otpStore.get(normalizedEmail);
      if (existingOtp && Date.now() < existingOtp.expiresAt - 4 * 60 * 1000) {
        return res.status(429).json({ error: "Please wait 60 seconds before requesting a new OTP." });
      }

      const otp = crypto.randomInt(100000, 1000000).toString();
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(otp, salt);

      otpStore.set(normalizedEmail, {
        hash,
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0
      });

      const transporter = getMailTransporter();
      const senderEmail = (process.env.EMAIL_USER || "studentneed.info@gmail.com").trim();

      if (!transporter) {
        console.warn(`[DEV MODE] EMAIL_PASSWORD not configured. OTP for ${normalizedEmail} is: ${otp}`);
        return res.json({ message: "OTP sent successfully." });
      }

      try {
        await transporter.sendMail({
          from: `StudentNeed <${senderEmail}>`,
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

        return res.json({ message: "OTP sent successfully." });
      } catch (err: any) {
        console.error("[SMTP Dispatch Error]:", err?.message || err);
        otpStore.delete(normalizedEmail);
        return res.status(500).json({ error: "Failed to deliver verification email. Please check SMTP configuration or try again later." });
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
      const data = otpStore.get(normalizedEmail);

      if (!data) {
        return res.status(400).json({ error: "No pending verification found or OTP expired." });
      }

      if (Date.now() > data.expiresAt) {
        otpStore.delete(normalizedEmail);
        return res.status(400).json({ error: "This verification code has expired. Please request a new code." });
      }

      if (data.attempts >= 5) {
        otpStore.delete(normalizedEmail);
        return res.status(429).json({ error: "Too many failed attempts. Please request a new OTP." });
      }

      const isValid = await bcrypt.compare(otp.toString().trim(), data.hash);

      if (!isValid) {
        data.attempts += 1;
        return res.status(400).json({ error: "Invalid verification code. Please try again." });
      }

      verifiedEmails.set(normalizedEmail, { expiresAt: Date.now() + 30 * 60 * 1000 });
      otpStore.delete(normalizedEmail);

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

      const verifiedRecord = verifiedEmails.get(normalizedEmail);
      if (!verifiedRecord || Date.now() > verifiedRecord.expiresAt) {
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

      verifiedEmails.delete(normalizedEmail);
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
