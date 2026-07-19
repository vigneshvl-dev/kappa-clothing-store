const Razorpay = require("razorpay");
const KEY_ID = "rzp_test_TFOxCSs3iPI2pU";
const KEY_SECRET = "bb6nZdz3nr7lytEq9eaubKgG";

console.log("Testing Razorpay connection...");
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
