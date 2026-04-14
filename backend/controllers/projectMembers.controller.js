import * as projectMembersService from '../services/projectMembers.service.js';

// ─── ADD MEMBER ───────────────────────────────────────────────────────────────
export const addMember = async (req, res) => {
  try {
    const { user_id, role } = req.body;
    const member = await projectMembersService.addMember(req.params.projectId, req.user.userId, user_id, role);
    res.status(201).json({ success: true, message: 'Member added', data: member });
  } catch (err) {
    const status = err.message.includes('already a member') ? 409 : 400;
    res.status(status).json({ success: false, message: err.message });
  }
};

// ─── REMOVE MEMBER ────────────────────────────────────────────────────────────
export const removeMember = async (req, res) => {
  try {
    await projectMembersService.removeMember(req.params.projectId, req.user.userId, req.params.userId);
    res.json({ success: true, message: 'Member removed' });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
};

// ─── GET MEMBERS ──────────────────────────────────────────────────────────────
export const getMembers = async (req, res) => {
  try {
    const members = await projectMembersService.getMembers(req.params.projectId, req.user.userId);
    res.json({ success: true, data: members });
  } catch (err) {
    res.status(403).json({ success: false, message: err.message });
  }
};