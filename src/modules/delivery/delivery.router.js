import { Router } from 'express';
import * as deliveryController from './delivery.controller.js';

import Auth from "../../middleware/authMiddleware.js";


const router = Router();

// All routes require authentication and delivery employee role


// Get prepared orders ready for delivery
router.get('/orders/prepared', Auth.isAuthenticated, deliveryController.getPreparedOrders);

// Start delivery for an order
router.post('/start-delivery', Auth.isAuthenticated, deliveryController.startDelivery);

// Update current location
router.put('/location', Auth.isAuthenticated, deliveryController.updateLocation);

// Update estimated delivery time
router.put('/estimated-time', Auth.isAuthenticated, deliveryController.updateEstimatedTime);

// Complete delivery
router.post('/complete-delivery', Auth.isAuthenticated, deliveryController.completeDelivery);

// Get current active delivery
router.get('/current-delivery', Auth.isAuthenticated, deliveryController.getCurrentDelivery);

// Get delivery history
router.get('/history', Auth.isAuthenticated, deliveryController.getDeliveryHistory);

// Get delivery employee profile
router.get('/profile', Auth.isAuthenticated, deliveryController.getProfile);

export default router;