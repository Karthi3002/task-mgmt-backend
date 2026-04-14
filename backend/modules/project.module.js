import * as projectService from '../services/project.service.js';

export const listProjectsModule = ({ userId, includeArchived }) => {
    return projectService.getProjects({ userId, includeArchived });
};
export const getProjectModule = (projectId, userId) => {
    return projectService.getProjectById(projectId, userId);
};

export const createProjectModule = (data, userId) => {
    return projectService.createProject({ ...data, userId });
};

export const updateProjectModule = (projectId, userId, updates) => {
    return projectService.updateProject(projectId, userId, updates);
};

export const archiveProjectModule = (projectId, userId) => {
    return projectService.archiveProject(projectId, userId);
};

export const deleteProjectModule = (projectId, userId) => {
    return projectService.deleteProject(projectId, userId);
};