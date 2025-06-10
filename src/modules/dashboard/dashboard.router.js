import { Router } from 'express';
import * as controller from './dashboard.controller.js';
import Auth from '../../middleware/authMiddleware.js';

const router = Router();

// Dashboard statistics routes (Admin only)
router.get('/stats', Auth.adminOnly, controller.getDashboardStats);
router.get('/cards', Auth.adminOnly, controller.getDashboardCards);

export default router;