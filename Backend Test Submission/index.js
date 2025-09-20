const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { nanoid } = require("nanoid");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const axios = require('axios');
require('dotenv').config();
const { registerUser } = require('../Logging Middleware/login.js/registerUser');


const JWT_SECRET = process.env.JWT_SECRET

const app = express();
const port = 3000;

const db = new sqlite3.Database("./urls.db");

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${Date.now() - start}ms`,
    };
    console.log(JSON.stringify(logEntry));
  });
  next();
});

function authorize(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) {
    return res.status(401).json({ error: "Authorization token is required" });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.userId = decoded.userId;
    next();
  });
}

app.post("/register", async (req, res) => {
  const { email, name, mobileNo, githubUsername, rollNo, accessCode } = req.body;
  const registrationData = { email, name, mobileNo, githubUsername, rollNo, accessCode };
  const result = await registerUser(registrationData);
  if (result.error) {
    res.status(result.status).json({ error: result.error });
  } else {
    res.status(result.status).json(result.data);
  }
});
