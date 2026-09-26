import crypto from "crypto";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

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
      userId,
      firebaseProjectId,
      firebaseIdToken
    } = req.body || {};

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

    if (!firebaseIdToken || !userId || !firebaseProjectId) {
      return res.status(400).json({
        success: false,
        message: "Missing Firebase authentication details"
      });
    }

    // Verify Razorpay signature
    const body =
      razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid signature"
      });
    }

    // Validate plan duration
    const days = Number(planDays);

    if (!Number.isFinite(days) || days <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan duration"
      });
    }

    // Subscription dates
    const startDate = new Date();

    const expiryDate = new Date(
      startDate.getTime() +
      days * 24 * 60 * 60 * 1000
    );

    // Firestore REST API URL
    const firestoreUrl =
      `https://firestore.googleapis.com/v1/projects/` +
      `${encodeURIComponent(firebaseProjectId)}` +
      `/databases/(default)/documents/subscriptions`;

    // Firestore document
    const document = {
      fields: {
        userId: {
          stringValue: String(userId)
        },

        subjectId: {
          stringValue: String(subjectId || "")
        },

        sectionName: {
          stringValue: String(sectionName || "")
        },

        planId: {
          stringValue: String(planId || "")
        },

        planName: {
          stringValue: String(planName || "")
        },

        planDays: {
          integerValue: String(Math.round(days))
        },

        planAmount: {
          doubleValue: Number(planAmount || 0)
        },

        discount: {
          doubleValue: Number(discount || 0)
        },

        finalAmount: {
          doubleValue: Number(finalAmount || 0)
        },

        couponCode: couponCode
          ? {
              stringValue: String(couponCode)
            }
          : {
              nullValue: "NULL_VALUE"
            },

        userName: {
          stringValue: String(userName || "")
        },

        userPhone: {
          stringValue: String(userPhone || "")
        },

        razorpayPaymentId: {
          stringValue: String(razorpay_payment_id)
        },

        razorpayOrderId: {
          stringValue: String(razorpay_order_id)
        },

        status: {
          stringValue: "active"
        },

        startDate: {
          timestampValue: startDate.toISOString()
        },

        expiryDate: {
          timestampValue: expiryDate.toISOString()
        }
      }
    };

    // Write subscription to Firestore
    // using the logged-in Firebase user's ID token
    const firestoreRes = await fetch(
      firestoreUrl,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${firebaseIdToken}`
        },

        body: JSON.stringify(document)
      }
    );

    const firestoreData =
      await firestoreRes.json().catch(() => ({}));

    if (!firestoreRes.ok) {
      console.error(
        "Firestore write failed:",
        firestoreData
      );

      return res.status(500).json({
        success: false,
        message:
          firestoreData?.error?.message ||
          "Payment verified, but subscription could not be saved."
      });
    }

    // Everything successful
    return res.status(200).json({
      success: true,
      message:
        "Payment verified and subscription saved",

      subscription:
        firestoreData.name || null
    });

  } catch (error) {
    console.error(
      "Verification error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Payment verification failed"
    });
  }
}
