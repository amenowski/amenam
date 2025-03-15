// Imports
require("dotenv").config();
var Commands = require("./modules/CommandList");
var GameServer = require("./GameServer");
const BubbleServer = require("./BubbleServer");
const express = require("express");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const cors = require("cors");
const SessionManager = require("./modules/SessionManager");

const path = require("path");
const http = require("http");
const captchaRouter = require("./routers/c1ch");
const authRouter = require("./routers/a1h");
const friendsRouter = require("./routers/f1d");
const battleRouter = require("./routers/b1t");
const accountRouter = require("./routers/ac");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

var showConsole = true;

console.log(
  "[Game] Ogar3 - An open source Agar.io server implementation based on ogar!"
);

process.argv.forEach(function (val) {
  if (val == "--noconsole") {
    showConsole = false;
  } else if (val == "--help") {
    console.log("Proper Usage: node index.js");
    console.log("    --noconsole         Disables the console");
    console.log("    --help              Help menu.");
    console.log("");
  }
});

const app = express();

app.set("view engine", "ejs");
app.set("views", "./views");
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "tajny_klucz",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(async (req, res, next) => {
  try {
    const userHash = req.cookies.userHash;
    if (userHash) {
      const session = SessionManager.getSession(userHash);
      if (session) {
        req.user = session;
      }
    }
    next();
  } catch (error) {
    console.error("Błąd autoryzacji:", error);
    next();
  }
});

app.get("/", (req, res) => {
  if (req.user) {
    res.render("l", { user: req.user });
  } else {
    res.render("index");
  }
});

app.use(express.static(path.join(__dirname, "client")));

app.use(captchaRouter);

app.use("/", authRouter);
app.use(
  "/",
  (req, res, next) => {
    req.gameServer = gameServer;
    next();
  },
  friendsRouter
);
app.use("/", battleRouter);
app.use("/", accountRouter);
const server = http.createServer(app);

const bubbleServer = new BubbleServer();
bubbleServer.start();

var gameServer = new GameServer();
exports.gameServer = gameServer;

gameServer.httpServer = server;

gameServer.start();
// Add command handler
gameServer.commands = Commands.list;
// Initialize the server console
if (showConsole) {
  var readline = require("readline");
  var in_ = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  setTimeout(prompt, 100);
}

// Console functions

function prompt() {
  in_.question(">", function (str) {
    parseCommands(str);
    return prompt(); // Too lazy to learn async
  });
}

function parseCommands(str) {
  // Log the string
  gameServer.log.onCommand(str);

  // Don't process ENTER
  if (str === "") return;

  // Splits the string
  var split = str.split(" ");

  // Process the first string value
  var first = split[0].toLowerCase();

  // Get command function
  var execute = gameServer.commands[first];
  if (typeof execute != "undefined") {
    execute(gameServer, split);
  } else {
    console.log("[Console] Invalid Command!");
  }
}
