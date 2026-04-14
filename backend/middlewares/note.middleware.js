// validate note content
export const validateNote = (req, res, next) => {
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Note content is required',
    });
  }

  next();
};