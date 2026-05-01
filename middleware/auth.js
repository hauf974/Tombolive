'use strict';
// STUB — sera implémenté dans S1-4
module.exports = function isAuthenticated(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
};
