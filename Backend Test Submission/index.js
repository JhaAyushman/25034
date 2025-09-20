const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { nanoid } = require("nanoid");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const axios = require('axios');
require('dotenv').config();
const { registerUser } = require('../../25034/Logging Middleware/login');


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

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS urls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      shortcode TEXT UNIQUE NOT NULL,
      validity TEXT NOT NULL
    )
  `);
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shortcode TEXT NOT NULL,
      clicked_at TEXT NOT NULL,
      referrer TEXT,
      user_agent TEXT,
      ip_address TEXT,
      FOREIGN KEY(shortcode) REFERENCES urls(shortcode)
    )
  `);
});


app.post("/shorturls", (req, res) => {
  const { url, validity, shortcode } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  const expiryTime = validity
    ? moment().add(validity, "minutes").toISOString()
    : moment().add(30, "minutes").toISOString();

  function generateUniqueShortCode(customCode, callback) {
    const shortcode = customCode || nanoid(6);
    db.get(
      "SELECT shortcode FROM urls WHERE shortcode = ?",
      [shortcode],
      (err, row) => {
        if (err) return callback(err);
        if (row)
          return callback(
            "Short code is already taken. Please choose another one."
          );
        callback(null, shortcode);
      }
    );
  }

  db.get(
    "SELECT shortcode, validity FROM urls WHERE url = ?",
    [url],
    (err, row) => {
      if (err) return res.status(500).json({ error: "Internal Server Error" });

      if (row) {
        if (moment().isAfter(row.validity)) {
          return res
            .status(410)
            .json({ error: "The shortened URL has expired. Please short url again." });
        }
        return res.json({
          shortened_url: `http://localhost:${port}/${row.shortcode}`,
          validity: row.validity,
        });
      }

      generateUniqueShortCode(shortcode, (err, shortcode) => {
        if (err) return res.status(400).json({ error: err });

        db.run(
          "INSERT INTO urls (url, shortcode, validity) VALUES (?, ?, ?)",
          [url, shortcode, expiryTime],
          function (err) {
            if (err) return res.status(500).json({ error: "Failed to save URL" });
            res.status(201).json({
              shortened_url: `http://localhost:${port}/${shortcode}`,
              validity: expiryTime,
            });
          }
        );
      });
    }
  );
});

app.get("/:shortcode", (req, res) => {
  const { shortcode } = req.params;
  db.get(
    "SELECT url, validity FROM urls WHERE shortcode = ?",
    [shortcode],
    (err, row) => {
      if (err) return res.status(500).json({ error: "Internal Server Error" });
      if (!row) return res.status(404).json({ error: "Short code not found" });

      if (moment().isAfter(row.validity)) {
        return res.status(410).json({ error: "This link has expired" });
      }

      // Log the click
      db.run(
        `INSERT INTO clicks (shortcode, clicked_at, referrer, user_agent, ip_address)
         VALUES (?, ?, ?, ?, ?)`,
        [
          shortcode,
          new Date().toISOString(),
          req.get("referer") || null,
          req.get("user-agent") || null,
          req.ip
        ]
      );

      return res.redirect(row.url);
    }
  );
});

app.get("/shorturls/:shortcode/stats", authorize, (req, res) => {
  const { shortcode } = req.params;

  db.get(
    "SELECT url, validity FROM urls WHERE shortcode = ?",
    [shortcode],
    (err, urlRow) => {
      if (err) return res.status(500).json({ error: "Internal Server Error" });
      if (!urlRow) return res.status(404).json({ error: "Short code not found" });

      db.all(
        "SELECT clicked_at, referrer, user_agent, ip_address FROM clicks WHERE shortcode = ?",
        [shortcode],
        (err, clickRows) => {
          if (err) return res.status(500).json({ error: "Internal Server Error" });

          res.json({
            url: urlRow.url,
            validity: urlRow.validity,
            total_clicks: clickRows.length,
            clicks: clickRows
          });
        }
      );
    }
  );
});


app.post("/generate-token", (req, res) => {
  const userId = "preauthorized-user-id";
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
});

app.listen(port, () => {
  console.log(`URL shortener running at http://localhost:${port}`);
});
