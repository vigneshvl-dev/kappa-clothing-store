require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const app = express();

app.use(express.json());

// Enable CORS for all requests (useful when frontend runs on port 5518/5500 Live Server)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Authorization, Content-Type, apikey");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.static(__dirname)); // serves checkout.html, index.html, etc.

const createOrder = require("./api/create-order");
app.post("/api/create-order", createOrder);

const verifyPayment = require("./api/verify-payment");
app.post("/api/verify-payment", verifyPayment);

const reduceStock = require("./api/reduce-stock");
app.post("/api/reduce-stock", reduceStock);

const deleteOrder = require("./api/delete-order");
app.post("/api/delete-order", deleteOrder);

const cancelOrder = require("./api/cancel-order");
app.post("/api/cancel-order", cancelOrder);

const signup = require("./api/signup");
app.post("/api/signup", signup);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running → http://localhost:${PORT}`);
    console.log(`   Checkout page  → http://localhost:${PORT}/checkout.html`);
});
