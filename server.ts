import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { db } from "./src/lib/firebase";
import { doc, setDoc, getDoc, deleteDoc, updateDoc } from "firebase/firestore";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Email Transporter (using env vars)
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: process.env.EMAIL_PORT === "465",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // 1. Send OTP
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }

      // Backend independent validation
      const allowedDomain = "@student.annauniv.edu";
      if (!email.toLowerCase().endsWith(allowedDomain)) {
        return res.status(403).json({ error: `Only ${allowedDomain} emails are allowed.` });
      }

      // Check cooldown / existing OTP
      const otpRef = doc(db, "otps", email.toLowerCase());
      const otpDoc = await getDoc(otpRef);
      
      if (otpDoc.exists()) {
        const data = otpDoc.data();
        // 1 minute cooldown for resend
        if (Date.now() < data.createdAt + 60 * 1000) {
          return res.status(429).json({ error: "Please wait 60 seconds before requesting a new OTP." });
        }
      }

      // Generate cryptographically secure 6-digit OTP
      const otp = crypto.randomInt(100000, 999999).toString();
      
      // Hash OTP before storing
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(otp, salt);

      // Store in DB (5 min expiration)
      await setDoc(otpRef, {
        hash,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0
      });

      // Send Email
      // Note: If EMAIL_USER is not set in env, we log the OTP to console for debugging in dev
      if (!process.env.EMAIL_USER) {
        console.warn(`[DEV MODE] OTP for ${email} is: ${otp}`);
      } else {
        await transporter.sendMail({
          from: `"StudentNeed" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "Your StudentNeed Verification Code",
          text: `Your verification code is: ${otp}\n\nThis code will expire in 5 minutes.`,
          html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code will expire in 5 minutes.</p>`,
        });
      }

      res.json({ message: "OTP sent successfully." });
    } catch (error: any) {
      console.error("Send OTP Error:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  });

  // 2. Verify OTP
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ error: "Email and OTP are required." });
      }

      const otpRef = doc(db, "otps", email.toLowerCase());
      const otpDoc = await getDoc(otpRef);

      if (!otpDoc.exists()) {
        return res.status(400).json({ error: "No pending verification found or OTP expired." });
      }

      const data = otpDoc.data();

      // Check Expiration
      if (Date.now() > data.expiresAt) {
        await deleteDoc(otpRef);
        return res.status(400).json({ error: "OTP has expired. Please request a new one." });
      }

      // Check Attempts
      if (data.attempts >= 5) {
        await deleteDoc(otpRef);
        return res.status(429).json({ error: "Too many failed attempts. Please request a new OTP." });
      }

      // Verify Hash
      const isValid = await bcrypt.compare(otp.toString(), data.hash);

      if (!isValid) {
        await updateDoc(otpRef, { attempts: data.attempts + 1 });
        return res.status(400).json({ error: "Invalid OTP." });
      }

      // OTP is valid. Mark as verified in a temporary collection.
      // This ensures the frontend can't just bypass Step 2.
      await setDoc(doc(db, "verified_emails", email.toLowerCase()), {
        verifiedAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000 // Allow 30 mins to finish signup
      });

      // OTP is single-use, delete it.
      await deleteDoc(otpRef);

      res.json({ message: "Email verified successfully." });
    } catch (error: any) {
      console.error("Verify OTP Error:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  });

  // 3. Finalize Account (Called after Firebase Auth creates the user)
  app.post("/api/auth/finalize-account", async (req, res) => {
    try {
      const { uid, email, name, department, avatarUrl } = req.body;

      if (!uid || !email) {
        return res.status(400).json({ error: "UID and email are required." });
      }

      // Backend independently validates the domain again
      const allowedDomain = "@student.annauniv.edu";
      if (!email.toLowerCase().endsWith(allowedDomain)) {
        return res.status(403).json({ error: `Only ${allowedDomain} emails are allowed.` });
      }

      // Check if email was securely verified via OTP
      const verifiedRef = doc(db, "verified_emails", email.toLowerCase());
      const verifiedDoc = await getDoc(verifiedRef);

      if (!verifiedDoc.exists() || Date.now() > verifiedDoc.data().expiresAt) {
        return res.status(403).json({ error: "Email not verified or verification expired. You cannot create an account." });
      }

      // Generate default avatar if not provided
      const finalAvatarUrl = avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${name || 'User'}&backgroundColor=000000`;

      // Create the official user document with isVerified = true
      await setDoc(doc(db, "users", uid), {
        id: uid,
        name: name || '',
        email: email.toLowerCase(),
        department: department || '',
        campus: 'Anna University',
        rating: 0,
        avatarUrl: finalAvatarUrl,
        exchangesCompleted: 0,
        role: 'student',
        isVerified: true, // Securely set by backend!
        createdAt: new Date().toISOString()
      });

      // Consume the verification token
      await deleteDoc(verifiedRef);

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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
