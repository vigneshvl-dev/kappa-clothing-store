const Razorpay = require("razorpay");

const razorpay = new Razorpay({
    key_id: "rzp_test_TFGK0UTin09QQd",
    key_secret: "2e3X86oDqAnwEHpOTn5BO6uG",
});

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
        const amountINR = (req.body && req.body.amount) ? parseInt(req.body.amount) : 500;
        const options = {
            amount: amountINR * 100, // convert INR to paise
            currency: "INR",
            receipt: "receipt_" + Date.now(),
        };

        const order = await razorpay.orders.create(options);

        res.status(200).json(order);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create order" });
    }
};