import * as noteModule from '../modules/note.module.js';

// 🔹 ADD NOTE
export const add = async (req, res) => {
  try {
    const note = await noteModule.addNoteModule(req.params.taskId, req.user.userId, req.body.content);
    res.status(201).json({ success: true, message: 'Note added', data: note });
  } catch (err) {
    const status = err.message.includes('access denied') ? 403 : 400;
    res.status(status).json({ success: false, message: err.message });
  }
};

// 🔹 GET NOTES
export const list = async (req, res) => {
  try {
    const notes = await noteModule.getNotesModule(req.params.taskId, req.user.userId);
    res.json({ success: true, data: notes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 DELETE NOTE
export const remove = async (req, res) => {
  try {
    await noteModule.deleteNoteModule(req.params.noteId, req.user.userId);
    res.json({ success: true, message: 'Note deleted' });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
};