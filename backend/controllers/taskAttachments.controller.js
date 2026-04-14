import * as taskAttachmentsService from '../services/taskAttachments.service.js';

// ─── UPLOAD ATTACHMENT ────────────────────────────────────────────────────────
export const upload = async (req, res) => {
  try {
    const attachment = await taskAttachmentsService.uploadAttachment(req.params.taskId, req.file, req.user.userId);
    res.status(201).json({ success: true, message: 'Attachment uploaded', data: attachment });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ─── GET ATTACHMENTS ─────────────────────────────────────────────────────────
export const getAttachments = async (req, res) => {
  try {
    const attachments = await taskAttachmentsService.getTaskAttachments(req.params.taskId, req.user.userId);
    res.json({ success: true, data: attachments });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
};

// ─── DELETE ATTACHMENT ───────────────────────────────────────────────────────
export const deleteAttachment = async (req, res) => {
  try {
    await taskAttachmentsService.deleteAttachment(req.params.attachmentId, req.user.userId);
    res.json({ success: true, message: 'Attachment deleted' });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
};
