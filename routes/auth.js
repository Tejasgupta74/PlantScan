const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const path = require('path');
const axios = require("axios");

// Rate limiter
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Function to send OTP using Google Script
async function sendOTP(email, otp) {
  await axios.post(process.env.GOOGLE_SCRIPT_URL, {
    email: email,
    otp: otp
  });
}

// Signup
router.post('/signup', authLimiter, async (req, res) => {

  const { name, email, password, confirmPassword } = req.body;

  if (!name || !email || !password || !confirmPassword)
    return res.status(400).json({ error: 'All fields are required.' });

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email))
    return res.status(400).json({ error: 'Invalid email address.' });

  if (password !== confirmPassword)
    return res.status(400).json({ error: 'Passwords do not match.' });

  try {

    const existing = await User.findOne({ email: email.toLowerCase() });

    if (existing)
      return res.status(400).json({ error: 'Email already exists.' });

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hash
    });

    res.json({
      success: true,
      user: { name: user.name, email: user.email }
    });

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: 'Server error' });

  }

});

// Login
router.post('/login', authLimiter, (req, res, next) => {

  passport.authenticate('local', (err, user, info) => {

    if (err)
      return res.status(500).json({ error: err.message });

    if (!user)
      return res.status(401).json({ error: info?.message || 'Invalid credentials' });

    req.logIn(user, (err) => {

      if (err)
        return res.status(500).json({ error: 'Login failed' });

      return res.json({
        success: true,
        user: { name: user.name, email: user.email }
      });

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

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => res.redirect('/')
);

// Serve pages
router.get('/forgot', (req, res) => {
  if (req.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, '..', 'public', 'forgot.html'));
});

router.get('/reset', (req, res) => {
  if (req.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, '..', 'public', 'reset.html'));
});

// Send OTP
router.post('/forgot', authLimiter, async (req, res) => {

  const { email } = req.body || {};

  if (!email)
    return res.status(400).json({ error: 'Email is required' });

  try {

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.json({ success: true, message: 'If that email exists we sent an OTP.' });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP
    const hashed = await bcrypt.hash(otp, 10);

    user.resetOtp = hashed;
    user.resetOtpExpires = Date.now() + 15 * 60 * 1000;

    await user.save();

    // Send email
    await sendOTP(user.email, otp);

    res.json({ success: true, message: 'If that email exists we sent an OTP.' });

  } catch (err) {

    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error' });

  }

});

// Verify OTP and reset password
router.post('/reset', authLimiter, async (req, res) => {

  const { email, otp, password, confirmPassword } = req.body || {};

  if (!email || !otp || !password || !confirmPassword)
    return res.status(400).json({ error: 'All fields are required.' });

  if (password !== confirmPassword)
    return res.status(400).json({ error: 'Passwords do not match.' });

  try {

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !user.resetOtp || !user.resetOtpExpires)
      return res.status(400).json({ error: 'Invalid or expired OTP.' });

    if (user.resetOtpExpires < Date.now())
      return res.status(400).json({ error: 'OTP expired.' });

    const valid = await bcrypt.compare(otp, user.resetOtp);

    if (!valid)
      return res.status(400).json({ error: 'Invalid OTP.' });

    const hash = await bcrypt.hash(password, 10);

    user.password = hash;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;

    await user.save();

    res.json({ success: true, message: 'Password reset successful.' });

  } catch (err) {

    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error' });

  }

});

// Current user
router.get('/api/user', (req, res) => {

  if (req.user)
    return res.json({
      user: { name: req.user.name, email: req.user.email }
    });

  res.json({ user: null });

});

// Serve login/signup pages
router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

router.get('/signup', (req, res) => {
  if (req.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, '..', 'public', 'signup.html'));
});

module.exports = router;