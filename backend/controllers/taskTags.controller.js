import * as taskTagsService from '../services/taskTags.service.js';

// ─── CREATE TAG ───────────────────────────────────────────────────────────────
export const createTag = async (req, res) => {
  try {
    const { name, color } = req.body;
    const tag = await taskTagsService.createTag(name, color, req.user.userId);
    res.status(201).json({ success: true, message: 'Tag created', data: tag });
  } catch (err) {
    const status = err.message.includes('already exists') ? 409 : 400;
    res.status(status).json({ success: false, message: err.message });
  }
};

// ─── ASSIGN TAG ───────────────────────────────────────────────────────────────
export const assignTag = async (req, res) => {
  try {
    const { name, color } = req.body;

    const result = await taskTagsService.assignTag(
      req.params.id,
      name,
      color,
      req.user.userId
    );

    res.status(201).json({
      success: true,
      message: 'Tag assigned',
      data: result
    });
  } catch (err) {
    const status = err.message.includes('already assigned') ? 409 : 400;

    res.status(status).json({
      success: false,
      message: err.message
    });
  }
};

// ─── REMOVE TAG ───────────────────────────────────────────────────────────────
export const removeTag = async (req, res) => {
  try {
    await taskTagsService.removeTag(req.params.id, req.params.tagId, req.user.userId);
    res.json({ success: true, message: 'Tag removed' });
  } catch (err) {
    const status = err.message.includes('Access denied') ? 403 : 400;
    res.status(status).json({ success: false, message: err.message });
  }
};

// ─── GET TASK TAGS ────────────────────────────────────────────────────────────
export const getTaskTags = async (req, res) => {
  try {
    const tags = await taskTagsService.getTaskTags(req.params.id, req.user.userId);
    res.json({ success: true, data: tags });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
};

// ─── GET ALL TAGS ─────────────────────────────────────────────────────────────
export const getAllTags = async (req, res) => {
  try {
    const tags = await taskTagsService.getAllTags();
    res.json({ success: true, data: tags });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};