const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const WebSocket = require("ws");

const app = express();
app.use(express.json());
app.use(express.urlencoded());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname));

const PORT = 3000;
const ALERT_LOG_FILE = path.join(__dirname, "logs", "alert.log");
const ALIVE_LOG_FILE = path.join(__dirname, "logs", "alive.log");
const USERNAME = "user";
const PASSWORD = "pass";

const server = app.listen(PORT, () => {
  const ipAddress = getLocalIP();
  console.log(`Server running at http://${ipAddress}:${PORT}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });
wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});
//
function broadcast(obj) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(obj));
    }
  });
}

const authenticate = (req, res, next) => {
  const { user, pass } = req.query;

  if (user === USERNAME && pass === PASSWORD) {
    return next();
  }

  res.status(403).send("Forbidden: Invalid credentials.");
};

function parseBooleanQueryParams(req, res, next) {
  if (req.query.alives) req.query.alives = req.query.alives === "true";
  if (req.query.alerts) req.query.alerts = req.query.alerts === "true";
  next();
}

app.get("/", authenticate, parseBooleanQueryParams, (req, res) => {
  const {
    alives = true,
    alivesLimit = 1,
    alerts = true,
    alertsLimit = 10,
    view,
  } = req.query;

  const logs = {
    alives: alives
      ? fs
          .readFileSync(ALIVE_LOG_FILE, "utf8")
          .trim()
          .split("\n")
          .slice(-alivesLimit)
      : [],
    alerts: alerts
      ? fs
          .readFileSync(ALERT_LOG_FILE, "utf8")
          .trim()
          .split("\n")
          .slice(-alertsLimit)
      : [],
  };

  if (view === "html") {
    res.render("index", {
      logs,
    });
  } else {
    res.json(logs);
  }
});

// logs the current time to logs/alive.log
app.get("/alive", authenticate, (req, res) => {
  const currentTime = new Date()
    .toLocaleString("pt-br", { timeZone: "America/Sao_Paulo" })
    .replace(",", "");
  fs.appendFile(ALIVE_LOG_FILE, `${currentTime}\n`, (err) => {
    if (err) {
      console.error("Error writing to log file:", err);
      return res.status(500).send("Error logging the alive signal");
    }
    res.send("Alive signal logged successfully");
  });

  broadcast({ type: "alives", body: currentTime });
});

// logs the current time to logs/alert.log
app.get("/alert", authenticate, (req, res) => {
  const currentTime = new Date()
    .toLocaleString("pt-br", { timeZone: "America/Sao_Paulo" })
    .replace(",", "");
  fs.appendFile(ALERT_LOG_FILE, `${currentTime}\n`, (err) => {
    if (err) {
      console.error("Error writing to log file:", err);
      return res.status(500).send("Error logging the alert");
    }
    res.send("Alert logged successfully");
  });

  broadcast({ type: "alerts", body: currentTime });
});

app.get("/test", (req, res) => {
  res.json({ message: "OK" });
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }

  return "localhost"; // fallback if no IP address is found
}
