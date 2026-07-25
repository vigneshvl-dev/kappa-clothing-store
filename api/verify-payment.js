require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const crypto = require("crypto");

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Missing fields: return 400
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: "Missing required verification fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required" });
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_secret) {
        return res.status(401).json({ error: "Razorpay credentials are not configured on the server" });
    }

    try {
        // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
        const generated_signature = crypto
            .createHmac("sha256", key_secret)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        // Compare generated signature with razorpay_signature
        if (generated_signature === razorpay_signature) {
            res.status(200).json({ success: true, message: "Payment verified successfully" });
        } else {
            // Signature mismatch: return 400
            res.status(400).json({ success: false, error: "Signature verification failed" });
        }
    } catch (error) {
        console.error("Signature verification error:", error);
        res.status(500).json({ error: "Internal server error during verification" });
    }
};
