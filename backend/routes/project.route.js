import express from 'express';
import {
  listProjects,
  getProject,
  create,
  update,
  archive,
  remove,
} from '../controllers/project.controller.js';
import {
  validateCreateProject,
  validateUpdateProject,
} from '../middlewares/project.middleware.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import projectMembersRoutes from './projectMembers.routes.js';

const router = express.Router();

// All project routes require auth
router.use(authMiddleware);

router.get('/',        listProjects);   // GET  /projects
router.get('/:id',     getProject);     // GET  /projects/:id
router.post('/', validateCreateProject, create);
router.patch('/:id', validateUpdateProject, update);
router.patch('/:id/archive', archive);  // PATCH /projects/:id/archive
router.delete('/:id',  remove);         // DELETE /projects/:id

// Members routes
router.use('/:projectId', projectMembersRoutes);

export default router;