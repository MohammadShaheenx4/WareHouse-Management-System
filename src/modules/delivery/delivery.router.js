import { Router } from 'express';
import * as deliveryController from './delivery.controller.js';
import Auth from "../../middleware/authMiddleware.js";

import fileUpload, { fileValidation } from "../../utils/multer.js";

const router = Router();

// =================== ADMIN ROUTES ===================
// Get all prepared orders that haven't been assigned to any delivery employee
router.get('/admin/orders/unassigned', Auth.isAuthenticated, deliveryController.getUnassignedOrders);

// Get all delivery employees with their current workload and status  
router.get('/admin/delivery-employees/workload', Auth.isAuthenticated, deliveryController.getDeliveryEmployeesWorkload);

// Get all delivery employees (simple list)
router.get('/admin/delivery-employees', Auth.isAuthenticated, deliveryController.getAllDeliveryEmployees);

// Assign multiple orders to a specific delivery employee
router.post('/admin/assign-orders', Auth.isAuthenticated, deliveryController.assignOrdersToDelivery);

// Get overall delivery statistics and performance metrics
router.get('/admin/delivery-stats', Auth.isAuthenticated, deliveryController.getDeliveryStats);

// =================== DELIVERY EMPLOYEE ROUTES ===================
// Get all orders assigned to the current delivery employee (NEW - for multi-order support)
router.get('/orders/assigned', Auth.isAuthenticated, deliveryController.getAssignedOrders);

// Get prepared orders ready for delivery (LEGACY - kept for backward compatibility)
router.get('/orders/prepared', Auth.isAuthenticated, deliveryController.getPreparedOrders);

// Start delivery for a specific assigned order
router.post('/start-delivery', Auth.isAuthenticated, deliveryController.startDelivery);

// Update current location
router.put('/location', Auth.isAuthenticated, deliveryController.updateLocation);

// Update estimated delivery time
router.put('/estimated-time', Auth.isAuthenticated, deliveryController.updateEstimatedTime);

router.put('/:userId', fileUpload(fileValidation.image).single('profilePicture'), deliveryController.updateUser);


// Complete delivery
router.post('/complete-delivery',
    Auth.isAuthenticated,
    fileUpload(fileValidation.image).any(), // This accepts any fields including files
    deliveryController.completeDelivery
);

// Return an order (NEW - when customer unavailable/sick/refuses delivery)
router.post('/return-order', Auth.isAuthenticated, deliveryController.returnOrder);

// Get available actions for in-progress orders (NEW)
router.get('/delivery-actions', Auth.isAuthenticated, deliveryController.getDeliveryActions);

// Get all current active deliveries (NEW - for multi-order support)
router.get('/current-deliveries', Auth.isAuthenticated, deliveryController.getCurrentDeliveries);

// Get current active delivery (LEGACY - kept for backward compatibility)
router.get('/current-delivery', Auth.isAuthenticated, deliveryController.getCurrentDelivery);

// Get delivery history
router.get('/history', Auth.isAuthenticated, deliveryController.getDeliveryHistory);

// Get delivery employee profile
router.get('/profile', Auth.isAuthenticated, deliveryController.getProfile);

router.get('/today-detailed', Auth.isAuthenticated, deliveryController.getTodayDetailedStats);
router.get('/today-stats', Auth.isAuthenticated, deliveryController.getTodayDeliveryStats);

export default router;