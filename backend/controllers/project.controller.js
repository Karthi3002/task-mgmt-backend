import * as projectModule from '../modules/project.module.js';
import { clearDashboardCache } from '../utils/cacheHelper.js';


// 🔹 GET ALL PROJECTS
export const listProjects = async (req, res) => {
    try {
        const includeArchived = req.query.include_archived === 'true';

        const projects = await projectModule.listProjectsModule({
            userId: req.user.userId,
            includeArchived,
        });

        res.json({ success: true, data: projects });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 🔹 GET SINGLE PROJECT
export const getProject = async (req, res) => {
    try {
        const project = await projectModule.getProjectModule(req.params.id, req.user.userId);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }
        res.json({ success: true, data: project });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 🔹 CREATE PROJECT
export const create = async (req, res) => {
    try {
        const userId = req.user.userId;
        const project = await projectModule.createProjectModule(req.body, req.user.userId);
        // ✅ CLEAR CACHE HERE
        await clearDashboardCache(userId);
        res.status(201).json({ success: true, message: 'Project created', data: project });
    } catch (err) {
        const status = err.message.includes('already exists') ? 409 : 400;
        res.status(status).json({ success: false, message: err.message });
    }
};

// 🔹 UPDATE PROJECT
export const update = async (req, res) => {
    try {
        const userId = req.user.userId;
        const project = await projectModule.updateProjectModule(req.params.id, req.user.userId, req.body);
        // ✅ CLEAR CACHE HERE
        await clearDashboardCache(userId);
        res.json({ success: true, message: 'Project updated', data: project });
    } catch (err) {
        const status = err.message.includes('access denied') ? 403 : 400;
        res.status(status).json({ success: false, message: err.message });
    }
};

// 🔹 ARCHIVE PROJECT
export const archive = async (req, res) => {
    try {
        const userId = req.user.userId;
        const project = await projectModule.archiveProjectModule(req.params.id, req.user.userId);
        // ✅ CLEAR CACHE HERE
        await clearDashboardCache(userId);
        res.json({ success: true, message: 'Project archived', data: project });
    } catch (err) {
        res.status(403).json({ success: false, message: err.message });
    }
};

// 🔹 DELETE PROJECT
export const remove = async (req, res) => {
    try {
        const userId = req.user.userId;
        await projectModule.deleteProjectModule(req.params.id, req.user.userId);
        await clearDashboardCache(userId); res.json({ success: true, message: 'Project deleted' });
    } catch (err) {
        res.status(403).json({ success: false, message: err.message });
    }
};

