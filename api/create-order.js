import Razorpay from 'razorpay';

export default async function handler(req, res) {
  // Update CORS to allow your new domain
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

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
    const { amount } = req.body;

    console.log("📦 Received amount:", amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid amount" 
      });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error("❌ Missing Razorpay credentials");
      return res.status(500).json({ 
        success: false, 
        message: "Server not configured: Missing Razorpay credentials" 
      });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const orderAmount = Math.round(amount * 100); // Convert INR to paise
    
    console.log("💳 Creating Razorpay order with amount:", orderAmount, "paise");

    const order = await razorpay.orders.create({
      amount: orderAmount,
      currency: "INR",
      receipt: "rcpt_" + Date.now(),
      payment_capture: 1,
    });

    console.log("✅ Order created successfully:", order.id);

    return res.status(200).json({
      success: true,
      order: order,
    });

  } catch (error) {
    console.error("❌ Create order error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to create order: " + error.message,
      error: error.message,
    });
  }
}