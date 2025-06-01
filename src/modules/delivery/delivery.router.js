import { Router } from 'express';
import * as deliveryController from './delivery.controller.js';
import Auth from "../../middleware/authMiddleware.js";

const router = Router();

// =================== ADMIN ROUTES ===================
// Admin routes - ensure your Auth.isAuthenticated middleware handles admin role checking

// Get all prepared orders that haven't been assigned to any delivery employee
router.get('/admin/orders/unassigned', Auth.isAuthenticated, deliveryController.getUnassignedOrders);

// Get all delivery employees with their current workload and status  
router.get('/admin/delivery-employees/workload', Auth.isAuthenticated, deliveryController.getDeliveryEmployeesWorkload);

// Assign multiple orders to a specific delivery employee
router.post('/admin/assign-orders', Auth.isAuthenticated, Auth.isAdmin, deliveryController.assignOrdersToDelivery);

// Get overall delivery statistics and performance metrics
router.get('/admin/delivery-stats', Auth.isAuthenticated, deliveryController.getDeliveryStats);

router.get('/admin/delivery-employees', Auth.isAuthenticated, deliveryController.getAllDeliveryEmployees);

// =================== DELIVERY EMPLOYEE ROUTES ===================
// All routes require authentication and delivery employee role

// Get all orders assigned to the current delivery employee (NEW - replaces getPreparedOrders)
router.get('/orders/assigned', Auth.isAuthenticated, deliveryController.getAssignedOrders);

// Get prepared orders ready for delivery (LEGACY - kept for backward compatibility)
router.get('/orders/prepared', Auth.isAuthenticated, deliveryController.getPreparedOrders);

// Start delivery for a specific assigned order
router.post('/start-delivery', Auth.isAuthenticated, deliveryController.startDelivery);

// Update current location
router.put('/location', Auth.isAuthenticated, deliveryController.updateLocation);

// Update estimated delivery time
router.put('/estimated-time', Auth.isAuthenticated, deliveryController.updateEstimatedTime);

// Complete delivery
router.post('/complete-delivery', Auth.isAuthenticated, deliveryController.completeDelivery);

// Get all current active deliveries (NEW - replaces getCurrentDelivery for multiple orders)
router.get('/current-deliveries', Auth.isAuthenticated, deliveryController.getCurrentDeliveries);

// Get current active delivery (LEGACY - kept for backward compatibility)
router.get('/current-delivery', Auth.isAuthenticated, deliveryController.getCurrentDelivery);

// Get delivery history
router.get('/history', Auth.isAuthenticated, deliveryController.getDeliveryHistory);

// Get delivery employee profile
router.get('/profile', Auth.isAuthenticated, deliveryController.getProfile);

export default router;