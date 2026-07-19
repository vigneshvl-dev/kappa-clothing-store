const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static(__dirname)); // serves checkout.html, index.html, etc.

const createOrder = require("./api/create-order");
app.post("/api/create-order", createOrder);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running → http://localhost:${PORT}`);
    console.log(`   Checkout page  → http://localhost:${PORT}/checkout.html`);
});
