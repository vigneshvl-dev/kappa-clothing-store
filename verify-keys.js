require("dotenv").config();
const Razorpay = require("razorpay");
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!KEY_ID || !KEY_SECRET) {
    console.error("❌ ERROR: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET environment variables are missing!");
    process.exit(1);
}

console.log("Testing Razorpay connection with key ID:", KEY_ID);
const rzp = new Razorpay({
    key_id: KEY_ID,
    key_secret: KEY_SECRET
});

rzp.orders.create({
    amount: 100, // ₹1 in paise
    currency: "INR",
    receipt: "test_receipt"
})
    .then(order => {
        console.log("✅ SUCCESS! Your keys are valid.");
        console.log("Order ID created:", order.id);
    })
    .catch(err => {
        console.error("❌ FAILED! Authentication or request failed.");
        console.error("Details:", err.error || err);
    });
