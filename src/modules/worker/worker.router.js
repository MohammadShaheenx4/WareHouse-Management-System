// File: Modules/warehouseEmployee/worker.router.js
import express from "express";
import {
    getPendingCustomerOrders,
    getPendingSupplierOrders,
    updateCustomerOrderStatus,
    receiveSupplierOrder,
    getOrdersHistory,
    getOrderActivityLogs,
    getProfile,
    getCustomerOrderById,
    getSupplierOrderById
} from "./worker.controller.js";
import Auth from "../../middleware/authMiddleware.js";

const router = express.Router();

// Middleware to check if user is a warehouse employee
const isWarehouseEmployee = (req, res, next) => {
    if (req.user && req.user.role === 'warehouseEmployee') {
        next();
    } else {
        return res.status(403).json({ message: 'Access denied. Only warehouse employees can access this resource' });
    }
};

// Middleware to check if user is an admin
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'Admin') {
        next();
    } else {
        return res.status(403).json({ message: 'Access denied. Only admins can access this resource' });
    }
};

// Warehouse employee routes - require authentication and warehouse employee role
router.get("/profile", Auth.isAuthenticated, isWarehouseEmployee, getProfile);
router.get("/customer-orders", Auth.isAuthenticated, getPendingCustomerOrders);
router.get("/supplier-orders", Auth.isAuthenticated, getPendingSupplierOrders);
router.get("/customer-orders/:id", Auth.isAuthenticated, getCustomerOrderById);
router.get("/supplier-orders/:id", Auth.isAuthenticated, getSupplierOrderById);
router.put("/customer-orders/:id", Auth.isAuthenticated, updateCustomerOrderStatus);
router.put("/supplier-orders/:id", Auth.isAuthenticated, receiveSupplierOrder);
router.get("/orders-history", Auth.isAuthenticated, getOrdersHistory);

// Admin-only routes - for viewing detailed logs
router.get("/order-logs/:id", Auth.isAuthenticated, isAdmin, getOrderActivityLogs);

export default router;