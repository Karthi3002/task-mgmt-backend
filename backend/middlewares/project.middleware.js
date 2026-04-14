// Validate project creation
export const validateCreateProject = (req, res, next) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Project name is required',
    });
  }

  next();
};

// Validate update
export const validateUpdateProject = (req, res, next) => {
  const { name, description } = req.body;

  if (!name && !description) {
    return res.status(400).json({
      success: false,
      message: 'At least one field (name/description) is required',
    });
  }

  next();
};