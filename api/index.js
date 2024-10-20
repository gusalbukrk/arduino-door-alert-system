const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const WebSocket = require("ws");
const cors = require("cors");
const { Expo } = require("expo-server-sdk");

const app = express();
app.use(express.json());
app.use(express.urlencoded());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname));
app.use(cors());

const PORT = 3000;
const ALERT_LOG_FILE = path.join(__dirname, "logs", "alerts.log");
const ALIVE_LOG_FILE = path.join(__dirname, "logs", "alives.log");
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

  ws.on("message", (message) => {
    console.log(`Received message: '${message}'`);

    if (message.toString() === "alive") {
      alive();
    } else if (message.toString() === "alert") {
      alert();
    }
  });

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

let expo = new Expo();
//
const getExpoPushTokens = () =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, "expoPushTokens.json"), "utf8")
  );
//
async function pushNotification(title, body, data) {
  const pushTokens = getExpoPushTokens();

  const messages = [];

  pushTokens.forEach((pushToken) => {
    messages.push({
      to: pushToken,
      sound: "default",
      title,
      body,
      data,
    });
  });

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error(error);
    }
  }

  // console.log("Notification(s) sent:", tickets);
}

app.get("/test", (req, res) => {
  res.json({ message: "OK" });
});

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
          .filter((log) => log !== "")
      : [],
    alerts: alerts
      ? fs
          .readFileSync(ALERT_LOG_FILE, "utf8")
          .trim()
          .split("\n")
          .slice(-alertsLimit)
          .filter((log) => log !== "")
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
  return alive()
    ? res.send("Alive signal logged successfully")
    : res.status(500).send("Error logging the alive signal");
});

// logs the current time to logs/alert.log
app.get("/alert", authenticate, async (req, res) => {
  return alert()
    ? res.send("Alert logged successfully")
    : res.status(500).send("Error logging the alert");
});

// register a new device for push notifications
app.get("/register", (req, res) => {
  const newPushToken = req.query.token;

  if (!newPushToken) {
    return res.status(400).send("Missing `token` query parameter");
  }

  if (!Expo.isExpoPushToken(newPushToken)) {
    return res.status(400).send(`Push token is not a valid Expo push token`);
  }

  const pushTokens = getExpoPushTokens();

  if (pushTokens.includes(newPushToken)) {
    return res.send("Device already registered");
  }

  pushTokens.push(newPushToken);

  fs.writeFileSync(
    path.join(__dirname, "expoPushTokens.json"),
    JSON.stringify(pushTokens, null, 2)
  );

  return res.send("Device registered successfully");
});

function getCurrentTime() {
  return new Date()
    .toLocaleString("pt-br", { timeZone: "America/Sao_Paulo" })
    .replace(",", "");
}

function alive() {
  const currentTime = getCurrentTime();

  fs.appendFile(ALIVE_LOG_FILE, `${currentTime}\n`, (err) => {
    if (err) {
      console.error("Error writing to log file:", err);
      return false;
    }
  });

  broadcast({ type: "alive", body: currentTime });
  return true;
}

async function alert() {
  const currentTime = getCurrentTime();

  fs.appendFile(ALERT_LOG_FILE, `${currentTime}\n`, (err) => {
    if (err) {
      console.error("Error writing to log file:", err);
      return false;
    }
  });

  broadcast({ type: "alert", body: currentTime });
  await pushNotification(
    "Alert",
    "Door has been opened at " + currentTime.split(" ")[1],
    { currentTime }
  );

  return true;
}

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

function authenticate(req, res, next) {
  const { user, pass } = req.query;

  if (user === USERNAME && pass === PASSWORD) {
    return next();
  }

  res.status(403).send("Forbidden: Invalid credentials.");
}

function parseBooleanQueryParams(req, res, next) {
  if (req.query.alives) req.query.alives = req.query.alives === "true";
  if (req.query.alerts) req.query.alerts = req.query.alerts === "true";
  next();
}
