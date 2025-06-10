import { Router } from 'express';
import * as controller from './dashboard.controller.js';
import Auth from '../../middleware/authMiddleware.js';

const router = Router();

// Dashboard statistics routes (Admin only)
router.get('/stats', Auth.adminOnly, controller.getDashboardStats);
router.get('/cards', Auth.adminOnly, controller.getDashboardCards);
router.get('/top-customers', Auth.adminOnly, controller.getTopCustomers);
router.get('/orders-overview', Auth.adminOnly, controller.getOrdersOverview);
router.get('/orders-overview/weekly-pattern', Auth.adminOnly, controller.getWeeklyPattern);
router.get('/top-products', Auth.adminOnly, controller.getTopProducts);

export default router;