import * as noteService from '../services/note.service.js';

export const addNoteModule = (taskId, userId, content) => {
  return noteService.addNote(taskId, userId, content);
};

export const getNotesModule = (taskId, userId) => {
  return noteService.getNotes(taskId, userId);
};

export const deleteNoteModule = (noteId, userId) => {
  return noteService.deleteNote(noteId, userId);
};