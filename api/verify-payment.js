import crypto from "crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length) {
    return getApps()[0];
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey
    })
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,

      planId,
      planDays,
      planName,
      planAmount,
      discount,
      finalAmount,

      subjectId,
      sectionName,

      couponCode,
      userName,
      userPhone,

      idToken
    } = req.body || {};

    /* =========================================
       1. CHECK PAYMENT DATA
    ========================================= */

    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing Razorpay payment details"
      });
    }

    if (!subjectId) {
      return res.status(400).json({
        success: false,
        message: "Missing subjectId"
      });
    }

    if (!planId || !planDays) {
      return res.status(400).json({
        success: false,
        message: "Missing plan information"
      });
    }

    /* =========================================
       2. VERIFY FIREBASE USER
    ========================================= */

    if (!idToken) {
      return res.status(401).json({
        success: false,
        message: "Firebase authentication token missing"
      });
    }

    const adminApp = getAdminApp();
    const adminAuth = getAuth(adminApp);
    const db = getFirestore(adminApp);

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    /* =========================================
       3. VERIFY RAZORPAY SIGNATURE
    ========================================= */

    if (!process.env.RAZORPAY_KEY_SECRET) {
      console.error("Missing RAZORPAY_KEY_SECRET");

      return res.status(500).json({
        success: false,
        message: "Razorpay server configuration missing"
      });
    }

    const body =
      razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(body)
      .digest("hex");

    const expectedBuffer = Buffer.from(
      expectedSignature,
      "utf8"
    );

    const receivedBuffer = Buffer.from(
      razorpay_signature,
      "utf8"
    );

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(
        expectedBuffer,
        receivedBuffer
      )
    ) {
      console.error("Invalid Razorpay signature");

      return res.status(400).json({
        success: false,
        message: "Invalid Razorpay signature"
      });
    }

    /* =========================================
       4. PREVENT DUPLICATE PAYMENT PROCESSING
    ========================================= */

    const paymentRef = db
      .collection("payments")
      .doc(razorpay_payment_id);

    const existingPayment = await paymentRef.get();

    if (existingPayment.exists) {
      return res.status(200).json({
        success: true,
        message: "Payment already processed",
        paymentId: razorpay_payment_id
      });
    }

    /* =========================================
       5. CALCULATE EXPIRY
    ========================================= */

    const days = Number(planDays);

    if (!Number.isFinite(days) || days <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan duration"
      });
    }

    const purchaseDate = new Date();

    const expiryDate = new Date(
      purchaseDate.getTime() +
      days * 24 * 60 * 60 * 1000
    );

    /* =========================================
       6. CREATE SUBSCRIPTION
    ========================================= */

    const subscriptionRef = db
      .collection("subscriptions")
      .doc();

    const subscription = {
      userId,

      subjectId,
      sectionName,

      planId,
      planName,
      planDays: days,

      amount: Number(planAmount || finalAmount || 0),
      discount: Number(discount || 0),
      finalAmount: Number(finalAmount || 0),

      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,

      couponCode: couponCode || null,

      userName: userName || decodedToken.name || "",
      userEmail: decodedToken.email || "",
      userPhone: userPhone || "",

      status: "active",

      purchaseDate: purchaseDate.toISOString(),
      expiryDate: expiryDate.toISOString(),

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    await subscriptionRef.set(subscription);

    /* =========================================
       7. SAVE PAYMENT RECORD
    ========================================= */

    await paymentRef.set({
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,

      userId,

      subjectId,
      sectionName,

      planId,
      planName,

      amount: Number(planAmount || finalAmount || 0),
      discount: Number(discount || 0),
      finalAmount: Number(finalAmount || 0),

      status: "paid",

      createdAt: FieldValue.serverTimestamp()
    });

    /* =========================================
       8. UPDATE USER DOCUMENT
    ========================================= */

    await db
      .collection("users")
      .doc(userId)
      .set(
        {
          isPremium: true,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

    /* =========================================
       9. SUCCESS
    ========================================= */

    return res.status(200).json({
      success: true,
      message: "Payment verified and subscription activated",

      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,

      subscriptionId: subscriptionRef.id,

      subjectId,
      planId,

      expiryDate: expiryDate.toISOString()
    });

  } catch (error) {
    console.error("Payment verification error:", error);

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Payment verification failed"
    });
  }
}
