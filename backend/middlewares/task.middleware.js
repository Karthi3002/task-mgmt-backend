// Validate task creation
export const validateCreateTask = (req, res, next) => {
  const { title, assigned_to_user_id, assigned_to_name } = req.body;

  if (!title) {
    return res.status(400).json({
      success: false,
      message: 'Title is required',
    });
  }

  // ✅ Allow either ID or Name
  if (!assigned_to_user_id && !assigned_to_name) {
    return res.status(400).json({
      success: false,
      message: 'Assigned user is required',
    });
  }

  next();
};

// Validate status update
export const validateStatusUpdate = (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'Status is required',
    });
  }

  next();
};