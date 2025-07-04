import express from "express";
import {
    getCategoryProducts,
    createOrder,
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    getMyOrders,
    payOrderDebt,
    getAllCategories,
    // NEW: Batch-aware preparation methods
    startOrderPreparation,
    completeOrderPreparation,
    getOrderBatchInfo
} from "./customerOrder.controller.js";
import Auth from "../../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/category/:categoryId/products", getCategoryProducts);
router.get("/all-category", getAllCategories);

// Protected routes - require authentication
router.post("/", Auth.isAuthenticated, createOrder);
router.get("/myOrders", Auth.isAuthenticated, getMyOrders);
router.post("/:id/payDebt", Auth.isAuthenticated, payOrderDebt);

// Admin-only routes
router.get("/", Auth.isAuthenticated, getAllOrders);
router.put("/:id/status", Auth.isAuthenticated, updateOrderStatus);

// NEW: Batch-aware preparation routes (Warehouse employees + Admin) - Uses authenticated user
router.post("/:id/start-preparation", Auth.isAuthenticated, startOrderPreparation);
router.post("/:id/complete-preparation", Auth.isAuthenticated, completeOrderPreparation);
router.get("/:id/batch-info", Auth.isAuthenticated, getOrderBatchInfo);

// Mixed access routes - can be accessed by admin or the customer who owns the order
router.get("/:id", Auth.isAuthenticated, getOrderById);

export default router;