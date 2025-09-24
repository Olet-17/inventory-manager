// app.js
const express = require("express");
const cors = require("cors");

// const app = express();

// middleware
app.use(cors());
app.use(express.json());

// routes
app.use("/api/products", require("./routes/products"));
app.use("/api/sales", require("./routes/sales"));
// add other routes...

module.exports = app;
