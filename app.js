if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const methodOverride = require("method-override");
const path = require("path");
const ejsMate = require("ejs-mate");
const expressError = require("./public/js/expressError.js");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const listingsRoutes = require("./routes/listings.js");
const reviewRoutes = require("./routes/review.js");
const userRoutes = require("./routes/user.js");

const app = express();
const port = process.env.PORT || 8000;
const sessionSecret = process.env.SESSION_SECRET || "secretcode";
const sessionOptions = {
  secret: sessionSecret,
  saveUninitialized: true,
  resave: false,
};

const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error("MONGO_URL environment variable is required");
  process.exit(1);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  express.urlencoded({
    extended: true,
  }),
);
app.use(express.json());
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(cookieParser("secretcode"));
app.use(session(sessionOptions));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
    },
    User.authenticate(),
  ),
);
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currentUser = req.user;
  next();
});
// Database connection
async function connectDatabase() {
  try {
    await mongoose.connect(MONGO_URL, {
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      maxPoolSize: 10, // Maintain up to 10 socket connections
    });

    console.log("Database Connected Successfully");
  } catch (err) {
    console.error("Database connection error:", err);
    throw err;
  }
}

// Middleware to ensure database connection in serverless
app.use(async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDatabase();
    }
    next();
  } catch (err) {
    console.error("Database middleware error:", err);
    return next(err);
  }
});

app.get("/", (req, res) => {
  res.redirect("/listings");
});

// Register listings routes
app.use("/listings", listingsRoutes);

// listings routes
app.use("/listings/:id/review", reviewRoutes);

// Users routes
app.use("/users", userRoutes);

// Middleware for logging requests
app.use((req, res, next) => {
  console.log(`Request: ${req.method} ${req.path}`, req.body);
  next();
});
app.use((err, req, res, next) => {
  if (err.name === "AuthenticationError") {
    req.flash("error", "Authentication failed.");
    return res.redirect("/users/login");
  }
  next(err);
});

// 404 Error handling
app.use((req, res, next) => {
  next(new expressError(404, "Page Not Found"));
});

// Global Error Handler
app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something Went Wrong" } = err;
  if (statusCode === 400 && err.details) {
    message = err.details.map((detail) => detail.message).join(", ");
  }
  console.log(err);
  res.status(statusCode).render("listings/error.ejs", {
    err: {
      message,
      statusCode,
    },
  });
});

// Connect to the database and start the server
async function main() {
  await connectDatabase();
}

main().catch((err) => console.log(err));

if (require.main === module) {
  app.listen(port, () => {
    console.log("Server Started On Port: " + port);
  });
}

module.exports = app;
