import express from "express";
import {
    getCategoryProducts,
    createOrder,
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    getMyOrders,
    payOrderDebt
} from "./customerOrder.controller.js";
import Auth from "../../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/category/:categoryId/products", getCategoryProducts);

// Protected routes - require authentication
router.post("/", Auth.isAuthenticated, createOrder);
router.get("/myOrders", Auth.isAuthenticated, getMyOrders);
router.post("/:id/payDebt", Auth.isAuthenticated, payOrderDebt);

// Admin-only routes
router.get("/", Auth.isAuthenticated, getAllOrders);
router.put("/:id/status", Auth.isAuthenticated, updateOrderStatus);

// Mixed access routes - can be accessed by admin or the customer who owns the order
router.get("/:id", Auth.isAuthenticated, getOrderById);

export default router;