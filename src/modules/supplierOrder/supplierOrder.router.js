import { Router } from 'express';
import * as controller from './supplierOrder.controller.js';
import Auth from '../../middleware/authMiddleware.js';

const router = Router();

// Routes for Admin
// Get products supplied by a specific supplier (for order creation)
router.get('/supplier/:supplierId/products', controller.getSupplierProducts);

// Get suppliers that provide a specific product
router.get('/product/:productId/suppliers', Auth.adminOnly, controller.getProductSuppliers);

// Create new order from supplier
router.post('/', Auth.adminOnly, controller.createSupplierOrder);

// Get all supplier orders (admin view)
router.get('/', Auth.adminOnly, controller.getAllSupplierOrders);

// Get specific order by ID (accessible by both admin and supplier)
router.get('/:id', Auth.isAuthenticated, controller.getSupplierOrderById);

// Routes for Suppliers
// Update order status (accept, decline, deliver)
router.put('/:id/status', Auth.isAuthenticated, controller.updateSupplierOrderStatus);

// Get supplier's own orders
router.get('/my/orders', Auth.isAuthenticated, controller.getMySupplierOrders);


router.patch(
    '/:supplierId/products/:productId/price',
    Auth.isAuthenticated,
    Auth.isSupplier,
    controller.updateSupplierPrice
);
export default router;