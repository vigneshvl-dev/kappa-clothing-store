require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static(__dirname)); // serves checkout.html, index.html, etc.

const createOrder = require("./api/create-order");
app.post("/api/create-order", createOrder);

const verifyPayment = require("./api/verify-payment");
app.post("/api/verify-payment", verifyPayment);

const deleteOrder = require("./api/delete-order");
app.post("/api/delete-order", deleteOrder);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running → http://localhost:${PORT}`);
    console.log(`   Checkout page  → http://localhost:${PORT}/checkout.html`);
});
