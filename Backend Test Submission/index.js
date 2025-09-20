const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { nanoid } = require("nanoid");
const jwt = require("jsonwebtoken");
const moment = require("moment");
require('dotenv').config();

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

