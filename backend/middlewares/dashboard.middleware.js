// Basic validation (future-proof)
export const validateDashboardRequest = (req, res, next) => {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  next();
};