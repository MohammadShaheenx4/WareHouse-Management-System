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
router.get('/order-counts', Auth.adminOnly, controller.getOrderCount);
router.get('/profit', Auth.adminOnly, controller.getProfitData);
router.get('/orders-chart', Auth.adminOnly, controller.getOrdersChart);
router.get('/orders-chart/period', Auth.adminOnly, controller.getOrdersChartByPeriod);
router.get('/profit-chart', Auth.adminOnly, controller.getProfitChart);
router.get('/profit-chart/period', Auth.adminOnly, controller.getProfitChartByPeriod);
router.get('/product-sales/:productId', Auth.adminOnly, controller.getProductSales);
router.get('/product-sales/:productId/period', Auth.adminOnly, controller.getProductSalesByPeriod);
router.get('/product-selling-history/:productId', Auth.adminOnly, controller.getProductSellingHistory);

export default router;