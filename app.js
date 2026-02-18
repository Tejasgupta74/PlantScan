require("dotenv").config();
const express = require("express");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/plantscan")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Sessions + Passport
app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || "plantscan_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/plantscan', ttl: 14 * 24 * 60 * 60 }),
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select("-password -__v");
    done(null, user);
  } catch (err) {
    done(err);
  }
});

passport.use(
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user || !user.password) return done(null, false, { message: "Incorrect email or password." });
      const match = await bcrypt.compare(password, user.password);
      if (!match) return done(null, false, { message: "Incorrect email or password." });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.CALLBACK_URL || 'http://localhost:5001'}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);
        const email = profile.emails && profile.emails[0] && profile.emails[0].value;
        if (email) {
          user = await User.findOne({ email: email.toLowerCase() });
          if (user) {
            user.googleId = profile.id;
            await user.save();
            return done(null, user);
          }
        }
        const newUser = await User.create({
          name: profile.displayName || "Google User",
          email: email ? email.toLowerCase() : `google_${profile.id}@example.com`,
          password: null,
          googleId: profile.id,
        });
        return done(null, newUser);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Use shared middleware for auth checks
const { ensureAuthenticated } = require('./middleware/auth');


// Serve static frontend (HTML, CSS, JS) from public folder
app.use(express.static(path.join(__dirname, "public")));

// Multer memory storage (Vercel read-only filesystem)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------------- ROUTES ----------------

// Root route: serve index.html if exists
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"), (err) => {
    if (err)
      res.send("Plant Analysis API is live. Use /analyze or /download routes.");
  });
});

// Mount auth routes (signup, login, logout, oauth, /api/user)
const authRouter = require('./routes/auth');
app.use('/', authRouter);



// Mount scan routes (protected analyze & download)
const scanRouter = require('./routes/scan');
app.use('/', scanRouter);


// Export app for Vercel
module.exports = app;

// If run directly, start a local server (keeps compatibility with Vercel export)
if (require.main === module) {
  const port = process.env.PORT || 5001;
  app.listen(port, () => console.log(`Server started on port ${port}`));
} 
