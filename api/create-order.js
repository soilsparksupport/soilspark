// POST /api/create-order
app.post("/api/create-order", async (req, res) => {
  const { amount } = req.body;             // in rupees
  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),      // paise
    currency: "INR",
    receipt: "soilspark_" + Date.now()
  });
  res.json({ success: true, order });
});