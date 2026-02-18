function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  if (req.accepts("json")) return res.status(401).json({ error: "Please login to scan plants." });
  res.redirect("/login");
}

module.exports = { ensureAuthenticated };