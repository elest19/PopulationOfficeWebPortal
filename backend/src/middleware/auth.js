const jwt = require('jsonwebtoken');
const config = require('../config/env');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = {
      id: payload.sub,
      role: payload.role,
      barangay: payload.barangay || null
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: { message: 'Invalid token' } });
  }
}

function authorize(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }
    const normalizeRole = (value) =>
      String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_');

    const userRole = normalizeRole(req.user.role);
    const allowedRoles = roles.map((r) => normalizeRole(r));
    if (roles.length && !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          message: `Forbidden: role ${userRole || '(none)'} is not allowed. Requires one of: ${
            allowedRoles.length ? allowedRoles.join(', ') : '(none)'
          }`
        }
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
