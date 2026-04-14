import express from 'express';
import multer from 'multer';
import { upload, getAttachments, deleteAttachment } from '../controllers/taskAttachments.controller.js';

const router = express.Router({ mergeParams: true });

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const uploadMiddleware = multer({ storage });

// Assuming taskId in params
router.post('/:taskId/attachments', uploadMiddleware.single('file'), upload);
router.get('/:taskId/attachments', getAttachments);
router.delete('/:taskId/attachments/:attachmentId', deleteAttachment);

export default router;
