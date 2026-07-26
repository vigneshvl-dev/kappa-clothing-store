require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const Razorpay = require("razorpay");

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const key_id = process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.trim().replace(/^['"]|['"]$/g, "") : null;
    const key_secret = process.env.RAZORPAY_KEY_SECRET ? process.env.RAZORPAY_KEY_SECRET.trim().replace(/^['"]|['"]$/g, "") : null;

    if (!key_id || !key_secret) {
        return res.status(401).json({ error: "Razorpay credentials are not configured on the server" });
    }

    try {
        const amount = (req.body && req.body.amount) ? parseInt(req.body.amount) : null;
        if (!amount || isNaN(amount) || amount < 100) {
            return res.status(400).json({ error: "Amount must be at least 100 paise (₹1)" });
        }

        const razorpay = new Razorpay({
            key_id,
            key_secret
        });

        const options = {
            amount: amount, // in paise
            currency: req.body.currency || "INR",
            receipt: req.body.receipt || "receipt_" + Date.now(),
        };

        const order = await razorpay.orders.create(options);

        res.status(200).json({
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            key_id: key_id
        });
    } catch (error) {
        console.error("Razorpay API Error:", error);
        const isAuthError = 
            error.statusCode === 401 || 
            (error.error && typeof error.error.description === "string" && 
             (error.error.description.includes("key") || error.error.description.includes("secret") || error.error.description.includes("auth")));
        
        const statusCode = isAuthError ? 401 : (error.statusCode || 500);
        const errorMessage = (error.error && error.error.description) || error.description || error.message || "Failed to create order";
        res.status(statusCode).json({ error: errorMessage });
    }
};