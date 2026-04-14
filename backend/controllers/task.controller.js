import * as taskModule from '../modules/task.module.js';
import { clearDashboardCache } from '../utils/cacheHelper.js';
import * as userService from '../services/user.service.js';
import { io } from '../server.js';

// 🔹 LIST TASKS (with filters from query params)
export const listTasks = async (req, res) => {
    try {
        const result = await taskModule.listTasksModule(req.query, req.user.userId);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 🔹 MY TASKS
export const myTasks = async (req, res) => {
    try {
        const result = await taskModule.myTasksModule(req.user.userId, req.query);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 🔹 DELEGATED BY ME
export const delegatedTasks = async (req, res) => {
    try {
        const result = await taskModule.delegatedTasksModule(req.user.userId, req.query);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 🔹 FOLLOW-UP QUEUE
export const followUpQueue = async (req, res) => {
    try {
        const tasks = await taskModule.followUpModule(req.user.userId);
        res.json({ success: true, data: tasks });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 🔹 REVIEW QUEUE
export const reviewQueue = async (req, res) => {
    try {
        const tasks = await taskModule.reviewModule(req.user.userId);
        res.json({ success: true, data: tasks });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 🔹 OVERDUE TASKS
export const overdueTasks = async (req, res) => {
    try {
        const result = await taskModule.overdueModule(req.user.userId);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 🔹 GET SINGLE TASK
export const getTask = async (req, res) => {
    try {
        const task = await taskModule.getTaskModule(req.params.id, req.user.userId);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        res.json({ success: true, data: task });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 🔹 CREATE TASK
export const create = async (req, res) => {
    try {
        const creatorUserId = req.user.userId;

        let {
            assigned_to_user_id,
            assigned_to_name,
            assigned_from_user_id,
            assigned_from_name,
        } = req.body;

        // 🔥 HANDLE "ASSIGNED TO"
        if (!assigned_to_user_id && assigned_to_name) {
            const user = await userService.createUser(assigned_to_name);
            assigned_to_user_id = user.id;
        }

        // 🔥 HANDLE "ASSIGNED FROM"
        if (!assigned_from_user_id && assigned_from_name) {
            const user = await userService.createUser(assigned_from_name);
            assigned_from_user_id = user.id;
        }

        // 🔥 DEFAULT: if still not provided → use logged-in user
        if (!assigned_from_user_id) {
            assigned_from_user_id = creatorUserId;
        }

        // ❗ FINAL VALIDATION
        if (!assigned_to_user_id || !assigned_from_user_id) {
            return res.status(400).json({
                success: false,
                message: 'Assigned users are required',
            });
        }

        // 🔁 FINAL PAYLOAD
        const taskPayload = {
            ...req.body,
            assigned_to_user_id,
            assigned_from_user_id,
        };

        console.log('🔥 Final Payload:', taskPayload);

        const task = await taskModule.createTaskModule(taskPayload, creatorUserId);

        // 🔄 CLEAR CACHE
        await clearDashboardCache(creatorUserId);
        await clearDashboardCache(assigned_to_user_id);
        await clearDashboardCache(assigned_from_user_id);

        // 🔔 SOCKET EVENTS
        io.to(`user:${creatorUserId}`).emit('dashboard:update');
        io.to(`user:${assigned_to_user_id}`).emit('dashboard:update');
        io.to(`user:${assigned_from_user_id}`).emit('dashboard:update');

        res.status(201).json({
            success: true,
            message: 'Task created',
            data: task,
        });

    } catch (err) {
        console.error('❌ Task Create Error:', err);
        res.status(400).json({
            success: false,
            message: err.message,
        });
    }
};

// 🔹 UPDATE TASK
export const update = async (req, res) => {
    try {
        const userId = req.user.userId;
        const task = await taskModule.updateTaskModule(req.params.id, req.user.userId, req.body);
        await clearDashboardCache(userId);
        io.to(`user:${req.user.userId}`).emit('dashboard:update');
        res.json({ success: true, message: 'Task updated', data: task });
    } catch (err) {
        const status = err.message.includes('access denied') ? 403 : 400;
        res.status(status).json({ success: false, message: err.message });
    }
};

// 🔹 UPDATE STATUS
export const updateStatus = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { status, reason } = req.body;
        if (!status) {
            return res.status(400).json({ success: false, message: 'Status is required' });
        }
        const task = await taskModule.updateStatusModule(req.params.id, req.user.userId, status, reason);
        await clearDashboardCache(userId);
        res.json({ success: true, message: 'Status updated', data: task });
    } catch (err) {
        const status = err.message.includes('Cannot move') ? 422 : 400;
        res.status(status).json({ success: false, message: err.message });
    }
};

// 🔹 GET TASK STATUS
export const getStatus = async (req, res) => {
    try {
        const task = await taskModule.getTaskModule(req.params.id, req.user.userId);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        res.json({
            success: true,
            data: { status: task.status }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 🔹 DELETE TASK
export const remove = async (req, res) => {
    try {
        const userId = req.user.userId;
        await taskModule.deleteTaskModule(req.params.id, req.user.userId);
        await clearDashboardCache(userId);
        io.to(`user:${req.user.userId}`).emit('dashboard:update');
        res.json({ success: true, message: 'Task deleted' });
    } catch (err) {
        res.status(403).json({ success: false, message: err.message });
    }
};

