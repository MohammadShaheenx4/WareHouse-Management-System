import express from 'express';
import {
    getLowStockItems,
    generateLowStockOrders,
    generateOrderForSingleItem,
    getLowStockItemDetails
} from '../lowstock/lowStock.controller.js';
import Auth from "../../middleware/authMiddleware.js";
import supplierOrderModel from '../../../DB/Models/supplierOrder.model.js';
import supplierModel from '../../../DB/Models/supplier.model.js';
import supplierOrderItemModel from '../../../DB/Models/supplierOrderItem.model.js';
import userModel from '../../../DB/Models/user.model.js';
import productModel from '../../../DB/Models/product.model.js';
const router = express.Router();

router.get('/low-stock-items', Auth.adminOnly, getLowStockItems);

// Get detailed information for a specific low-stock item (Admin only)
router.get('/low-stock-items/:productId', Auth.adminOnly, getLowStockItemDetails);

// Generate orders for selected items or all items (Admin only)
router.post('/generate-orders', Auth.adminOnly, generateLowStockOrders);

// Generate order for a single specific item based on last order (Admin only)
router.post('/generate-order/:productId', Auth.adminOnly, generateOrderForSingleItem);

// ============================================================================
// DASHBOARD FOR ADMIN INTERFACE
// ============================================================================

// Simple dashboard for low stock management (Admin only)
router.get('/dashboard', Auth.adminOnly, async (req, res) => {
    try {
        // Get low stock items
        const mockReq = { query: {} };
        let lowStockData = null;
        const mockRes = {
            status: () => mockRes,
            json: (data) => { lowStockData = data; return mockRes; }
        };

        await getLowStockItems(mockReq, mockRes);

        // Get recent pending orders count (orders sent to suppliers)
        const pendingOrdersCount = await supplierOrderModel.count({
            where: { status: 'Pending' }
        });

        // Get recent pending orders
        const recentPendingOrders = await supplierOrderModel.findAll({
            where: { status: 'Pending' },
            include: [
                {
                    model: supplierModel,
                    as: 'supplier',
                    include: [{
                        model: userModel,
                        as: 'user',
                        attributes: ['name']
                    }]
                },
                {
                    model: supplierOrderItemModel,
                    as: 'items',
                    include: [{
                        model: productModel,
                        as: 'product',
                        attributes: ['name']
                    }]
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: 5
        });

        // Add selection capabilities to low stock items
        const selectableLowStockItems = lowStockData?.lowStockItems?.map(item => ({
            ...item,
            selectable: true,
            selected: false,
            canGenerateOrder: item.product.suppliers && item.product.suppliers.length > 0
        })) || [];

        return res.status(200).json({
            message: 'Low stock dashboard',
            summary: {
                totalLowStockItems: lowStockData?.count || 0,
                criticalItems: lowStockData?.lowStockItems?.filter(item => item.alertLevel === 'CRITICAL').length || 0,
                highPriorityItems: lowStockData?.lowStockItems?.filter(item => item.alertLevel === 'HIGH').length || 0,
                mediumPriorityItems: lowStockData?.lowStockItems?.filter(item => item.alertLevel === 'MEDIUM').length || 0,
                selectableItems: selectableLowStockItems.filter(item => item.canGenerateOrder).length,
                pendingOrdersCount: pendingOrdersCount
            },
            lowStockItems: selectableLowStockItems,
            recentPendingOrders: recentPendingOrders.map(order => ({
                id: order.id,
                supplierName: order.supplier.user.name,
                totalCost: order.totalCost,
                itemCount: order.items.length,
                createdAt: order.createdAt,
                isAutoGenerated: order.isAutoGenerated || false,
                productNames: order.items.map(item => item.product.name).slice(0, 3)
            })),
            actions: {
                canSelectAll: selectableLowStockItems.filter(item => item.canGenerateOrder).length > 0,
                selectAllCount: selectableLowStockItems.filter(item => item.canGenerateOrder).length
            }
        });
    } catch (error) {
        console.error('Error getting dashboard data:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;