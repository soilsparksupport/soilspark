// POST /api/verify-payment
app.post("/api/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET)
                         .update(body).digest("hex");
  if (expected === razorpay_signature) return res.json({ success: true });
  res.status(400).json({ success: false });
});