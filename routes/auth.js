const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const path = require('path');


// basic rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 6, // limit each IP to 6 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Signup (server-side validation kept)
router.post('/signup', authLimiter, async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  if (!name || !email || !password || !confirmPassword)
    return res.status(400).json({ error: 'All fields are required.' });
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) return res.status(400).json({ error: 'Please provide a valid email address.' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' });
  const pwChecks = [/.{8,}/, /[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];
  const pwMessages = ['at least 8 characters','a lowercase letter','an uppercase letter','a number','a special character'];
  const failed = pwChecks.map((re,i) => ({ ok: re.test(password), i })).filter(r => !r.ok).map(r => pwMessages[r.i]);
  if (failed.length > 0) return res.status(400).json({ error: `Password must include ${failed.join(', ')}.` });

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'Email already in use.' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: email.toLowerCase(), password: hash });
    return res.json({ success: true, user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', authLimiter, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: info?.message || 'Invalid credentials' });
    req.logIn(user, (err) => {
      if (err) return res.status(500).json({ error: 'Login failed' });
      return res.json({ success: true, user: { name: user.name, email: user.email } });
    });
  })(req, res, next);
});

// Logout
router.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) return next(err);
    req.session.destroy(() => res.redirect('/'));
  });
});

// Google OAuth
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  res.redirect('/');
});


// Serve forgot/reset pages
router.get('/forgot', (req, res) => {
  if (req.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, '..', 'public', 'forgot.html'));
});

router.get('/reset', (req, res) => {
  if (req.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, '..', 'public', 'reset.html'));
});

function getMailer() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const nodemailer = require("nodemailer");

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true", // true for 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      family: 4,                 // force IPv4 (helps on Railway)
      connectionTimeout: 20000,  // increase timeout
      greetingTimeout: 20000,
      socketTimeout: 20000,
    });
  }

  return null;
}



// POST /forgot - send OTP to email (if user exists)
router.post('/forgot', authLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // respond 200 to avoid user enumeration
      return res.json({ success: true, message: 'If that email exists we sent an OTP.' });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    const hashed = await bcrypt.hash(otp, 10);
    user.resetOtp = hashed;
    user.resetOtpExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    const transporter = getMailer();
    const subject = 'PlantScan password reset OTP';
    const text = `Your PlantScan password reset code is: ${otp} (valid 15 minutes)`;

    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.email,
        subject,
        text,
      });
    } else {
      // dev fallback: log OTP to server console
      console.log(`Password reset OTP for ${user.email}: ${otp}`);
    }

    return res.json({ success: true, message: 'If that email exists we sent an OTP.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /reset - verify OTP and set new password
router.post('/reset', authLimiter, async (req, res) => {
  const { email, otp, password, confirmPassword } = req.body || {};
  if (!email || !otp || !password || !confirmPassword)
    return res.status(400).json({ error: 'All fields are required.' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' });
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.resetOtp || !user.resetOtpExpires) return res.status(400).json({ error: 'Invalid or expired OTP.' });
    if (user.resetOtpExpires < Date.now()) return res.status(400).json({ error: 'OTP expired.' });
    const valid = await bcrypt.compare(otp, user.resetOtp);
    if (!valid) return res.status(400).json({ error: 'Invalid OTP.' });
    const hash = await bcrypt.hash(password, 10);
    user.password = hash;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();
    return res.json({ success: true, message: 'Password reset successful.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Current user
router.get('/api/user', (req, res) => {
  if (req.user) return res.json({ user: { name: req.user.name, email: req.user.email } });
  res.json({ user: null });
});

// Serve client-side login/signup pages (static HTML)
router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

router.get('/signup', (req, res) => {
  if (req.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, '..', 'public', 'signup.html'));
});

module.exports = router;
