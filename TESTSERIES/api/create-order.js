import Razorpay from "razorpay";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const { amount, planId, subjectId } = req.body || {};

    console.log("Received:", {
      amount,
      planId,
      subjectId,
    });

    // Validate Razorpay environment variables
    if (
      !process.env.RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET
    ) {
      console.error("Missing Razorpay credentials");

      return res.status(500).json({
        success: false,
        message: "Server not configured: Missing Razorpay credentials",
      });
    }

    // Allowed plans
    const PLANS = {
      trial7: 49,
      monthly30: 149,
      quarterly90: 349,
      halfyearly180: 599,
      yearly365: 999,
    };

    // Validate plan
    if (!planId || !PLANS[planId]) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan",
      });
    }

    // Never trust the amount sent by the frontend
    const expectedAmount = PLANS[planId];

    if (Number(amount) !== expectedAmount) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount for selected plan",
      });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // INR → paise
    const orderAmount = expectedAmount * 100;

    const order = await razorpay.orders.create({
      amount: orderAmount,
      currency: "INR",
      receipt: `jrf_${Date.now()}`,
      payment_capture: 1,
      notes: {
        planId: planId || "",
        subjectId: subjectId || "",
      },
    });

    console.log("Order created:", order.id);

    return res.status(200).json({
      success: true,
      order: order,
      keyId: process.env.RAZORPAY_KEY_ID,
    });

  } catch (error) {
    console.error("Create order error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order",
    });
  }
}