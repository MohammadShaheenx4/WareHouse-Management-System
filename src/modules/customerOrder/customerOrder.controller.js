
import customerOrderModel from "../../../DB/Models/ordercustomer.model.js";
import orderPreparerModel from "../../../DB/Models/orderpreparer.model.js";
import customerOrderItemModel from "../../../DB/Models/customerOrderItem.model.js";
import customerModel from "../../../DB/Models/customer.model.js";
import productModel from "../../../DB/Models/product.model.js";
import productBatchModel from "../../../DB/Models/productPatch.model.js";
import warehouseEmployeeModel from "../../../DB/Models/WareHouseEmployee.model.js";
import userModel from "../../../DB/Models/user.model.js";
import categoryModel from "../../../DB/Models/category.model.js";
import { Op } from "sequelize";
import sequelize from "../../../DB/Connection.js";
import { getFIFOAllocation, updateBatchQuantities } from "../../utils/batchManagement.js";
import {
    createOrderSchema,
    updateOrderStatusSchema,
    validateOrderId,
    getCategoryProductsSchema,
    startPreparationSchema,
    completePreparationSchema
} from "./customerOrder.validation.js";

/**
 * @desc    Get products by category
 * @route   GET /api/orders/category/:categoryId/products
 * @access  Public
 */
export const getCategoryProducts = async (req, res) => {
    try {
        const { categoryId } = req.params;

        // Validate category ID
        const { error } = getCategoryProductsSchema.validate({ categoryId });
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        // Check if category exists
        const category = await categoryModel.findByPk(categoryId);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        // Get all products in this category
        const products = await productModel.findAll({
            where: {
                categoryId,
                status: 'Active',
                quantity: { [Op.gt]: 0 } // Only show in-stock products
            },
            attributes: [
                'productId', 'name', 'sellPrice', 'costPrice',
                'quantity', 'image', 'description'
            ]
        });

        return res.status(200).json({
            message: 'Category products retrieved successfully',
            category: {
                id: category.categoryID,
                name: category.categoryName
            },
            products
        });
    } catch (error) {
        console.error('Error fetching category products:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Create a new customer order
 * @route   POST /api/orders
 * @access  Customer/Admin
 */
export const createOrder = async (req, res) => {
    try {
        // Validate request body (simplified validation)
        const { error } = createOrderSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const { note, items } = req.body;

        // Check if user object exists
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: 'Authentication error: User not found in request' });
        }

        // Get customer ID from authenticated user
        const customer = await customerModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!customer) {
            return res.status(403).json({ message: 'Only customers can create orders' });
        }

        // Validate items and calculate total cost
        let totalCost = 0;
        const orderItems = [];

        // Check product availability
        for (const item of items) {
            const product = await productModel.findByPk(item.productId);

            if (!product) {
                return res.status(404).json({
                    message: `Product with ID ${item.productId} not found`
                });
            }

            // Check if requested quantity is available
            if (product.quantity < item.quantity) {
                return res.status(400).json({
                    message: `Product ${product.name} only has ${product.quantity} available (requested: ${item.quantity})`,
                    available: product.quantity,
                    requested: item.quantity,
                    productName: product.name
                });
            }

            const subtotal = product.sellPrice * item.quantity;
            totalCost += subtotal;

            orderItems.push({
                productId: item.productId,
                quantity: item.quantity,
                Price: product.sellPrice,  // Fixed: changed from Price to sellPrice
                subtotal: subtotal
            });
        }

        // Begin database transaction
        const transaction = await sequelize.transaction();

        try {
            // Create the order (status = Pending, payment fields will be filled later)
            const newOrder = await customerOrderModel.create({
                customerId: customer.id,
                status: 'Pending',
                totalCost,
                note: note || null,
                paymentMethod: null,  // Set explicitly to null to avoid validation issues
                amountPaid: 0,        // Default to 0
                discount: 0           // Default to 0
            }, { transaction });

            // Create order items
            for (const item of orderItems) {
                item.orderId = newOrder.id;
                await customerOrderItemModel.create(item, { transaction });
            }

            // Note: Don't reduce product quantities yet! 
            // This happens later when warehouse employee changes status to "Prepared"

            // Commit the transaction
            await transaction.commit();

            // Get the created order with associations
            const createdOrder = await customerOrderModel.findByPk(newOrder.id, {
                include: [
                    {
                        model: customerModel,
                        as: 'customer',
                        attributes: ['id', 'address', 'latitude', 'longitude'],
                        include: [{
                            model: userModel,
                            as: 'user',
                            attributes: ['userId', 'name', 'email', 'phoneNumber']
                        }]
                    },
                    {
                        model: customerOrderItemModel,
                        as: 'items',
                        include: [{
                            model: productModel,
                            as: 'product',
                            attributes: ['productId', 'name', 'image']
                        }]
                    }
                ]
            });

            return res.status(201).json({
                message: 'Order created successfully',
                order: createdOrder
            });

        } catch (error) {
            // Rollback transaction in case of error
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Error creating order:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get all orders
 * @route   GET /api/orders
 * @access  Admin
 */
export const getAllOrders = async (req, res) => {
    try {
        // Get query parameters for filtering
        const { status, customerId, fromDate, toDate } = req.query;

        // Build filter object
        const filter = {};

        if (status) {
            filter.status = status;
        }

        if (customerId) {
            filter.customerId = customerId;
        }

        // Date range filter
        if (fromDate || toDate) {
            filter.createdAt = {};
            if (fromDate) filter.createdAt[Op.gte] = new Date(fromDate);
            if (toDate) {
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999); // End of the day
                filter.createdAt[Op.lte] = endDate;
            }
        }

        // Get orders with customer and item information
        const orders = await customerOrderModel.findAll({
            where: filter,
            include: [
                {
                    model: customerModel,
                    as: 'customer',
                    attributes: ['id', 'address', 'latitude', 'longitude'],
                    include: [{
                        model: userModel,
                        as: 'user',
                        attributes: ['userId', 'name', 'email', 'phoneNumber']
                    }]
                },
                {
                    model: customerOrderItemModel,
                    as: 'items',
                    include: [{
                        model: productModel,
                        as: 'product',
                        attributes: ['productId', 'name', 'image']
                    }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        return res.status(200).json({
            message: 'Orders retrieved successfully',
            count: orders.length,
            orders
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get order by ID
 * @route   GET /api/orders/:id
 * @access  Admin/Customer (own orders)
 */
export const getOrderById = async (req, res) => {
    try {
        // Validate ID parameter
        const { error } = validateOrderId.validate({ id: req.params.id });
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const orderId = req.params.id;

        // Get order with all details
        const order = await customerOrderModel.findByPk(orderId, {
            include: [
                {
                    model: customerModel,
                    as: 'customer',
                    attributes: ['id', 'address', 'latitude', 'longitude'],
                    include: [{
                        model: userModel,
                        as: 'user',
                        attributes: ['userId', 'name', 'email', 'phoneNumber']
                    }]
                },
                {
                    model: customerOrderItemModel,
                    as: 'items',
                    include: [{
                        model: productModel,
                        as: 'product',
                        attributes: ['productId', 'name', 'image', 'description', 'sellPrice']
                    }]
                }
            ]
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // If user is a customer, check if the order belongs to them
        if (req.user && req.user.role === 'customer') {
            const customer = await customerModel.findOne({
                where: { userId: req.user.userId }
            });

            if (!customer || order.customerId !== customer.id) {
                return res.status(403).json({ message: 'Access denied. This order does not belong to you' });
            }
        }

        return res.status(200).json({
            message: 'Order retrieved successfully',
            order
        });
    } catch (error) {
        console.error('Error fetching order:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Update order status
 * @route   PUT /api/orders/:id/status
 * @access  Admin
 */
export const updateOrderStatus = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        // Validate ID parameter
        const idValidation = validateOrderId.validate({ id: req.params.id });
        if (idValidation.error) {
            await transaction.rollback();
            return res.status(400).json({ message: idValidation.error.details[0].message });
        }

        // Validate request body
        const { error } = updateOrderStatusSchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({ message: error.details[0].message });
        }

        const orderId = req.params.id;
        const { status, note } = req.body;

        // Get the order
        const order = await customerOrderModel.findByPk(orderId, {
            include: [
                {
                    model: customerOrderItemModel,
                    as: 'items'
                }
            ]
        });

        if (!order) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if order can be updated
        if (order.status === 'Shipped' || order.status === 'Rejected') {
            await transaction.rollback();
            return res.status(400).json({
                message: `Cannot update order with status ${order.status}`
            });
        }

        if (status === 'Shipped' && order.status !== 'Prepared') {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Order must be Prepared before it can be marked as Delivered'
            });
        }

        // Update order status
        const updateData = { status };
        if (note) updateData.note = note;

        await order.update(updateData, { transaction });

        // If status is Rejected, return products to inventory
        if (status === 'Rejected') {
            for (const item of order.items) {
                const product = await productModel.findByPk(item.productId);

                if (product) {
                    // Update product quantity by adding back the ordered quantity
                    await product.update({
                        quantity: product.quantity + item.quantity
                    }, { transaction });
                }
            }

            // Also remove debt from customer if it was a debt or partial payment
            if (order.paymentMethod === 'debt' || order.paymentMethod === 'partial') {
                const customer = await customerModel.findByPk(order.customerId);

                if (customer) {
                    const debtAmount = order.totalCost - order.amountPaid;
                    await customer.update({
                        accountBalance: Math.max(0, customer.accountBalance - debtAmount)
                    }, { transaction });
                }
            }
        }

        // Commit the transaction
        await transaction.commit();

        // Get updated order with all details
        const updatedOrder = await customerOrderModel.findByPk(orderId, {
            include: [
                {
                    model: customerModel,
                    as: 'customer',
                    attributes: ['id', 'address', 'latitude', 'longitude'],
                    include: [{
                        model: userModel,
                        as: 'user',
                        attributes: ['userId', 'name', 'email', 'phoneNumber']
                    }]
                },
                {
                    model: customerOrderItemModel,
                    as: 'items',
                    include: [{
                        model: productModel,
                        as: 'product',
                        attributes: ['productId', 'name', 'image']
                    }]
                }
            ]
        });

        return res.status(200).json({
            message: `Order status updated to ${status} successfully`,
            order: updatedOrder
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating order status:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get customer's orders
 * @route   GET /api/orders/myOrders
 * @access  Customer
 */
export const getMyOrders = async (req, res) => {
    try {
        // First check if user exists in request
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Find customer ID for the authenticated user
        const customer = await customerModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!customer) {
            return res.status(403).json({ message: 'Access denied. You are not a customer' });
        }

        const customerId = customer.id;

        // Get query parameters for filtering
        const { status, fromDate, toDate } = req.query;

        // Build filter object
        const filter = { customerId };

        if (status) {
            filter.status = status;
        }

        // Date range filter
        if (fromDate || toDate) {
            filter.createdAt = {};
            if (fromDate) filter.createdAt[Op.gte] = new Date(fromDate);
            if (toDate) {
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999); // End of the day
                filter.createdAt[Op.lte] = endDate;
            }
        }

        // Get orders with item information
        const orders = await customerOrderModel.findAll({
            where: filter,
            include: [
                {
                    model: customerOrderItemModel,
                    as: 'items',
                    include: [{
                        model: productModel,
                        as: 'product',
                        attributes: ['productId', 'name', 'image']
                    }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        return res.status(200).json({
            message: 'Orders retrieved successfully',
            count: orders.length,
            orders
        });
    } catch (error) {
        console.error('Error fetching customer orders:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Pay off customer debt
 * @route   POST /api/orders/:id/payDebt
 * @access  Customer/Admin
 */
export const payOrderDebt = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        // Validate ID parameter
        const { error } = validateOrderId.validate({ id: req.params.id });
        if (error) {
            await transaction.rollback();
            return res.status(400).json({ message: error.details[0].message });
        }

        const orderId = req.params.id;
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            await transaction.rollback();
            return res.status(400).json({ message: 'Valid payment amount is required' });
        }

        // Get the order
        const order = await customerOrderModel.findByPk(orderId);

        if (!order) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        // If user is a customer, check if the order belongs to them
        if (req.user && req.user.role === 'customer') {
            const customer = await customerModel.findOne({
                where: { userId: req.user.userId }
            });

            if (!customer || order.customerId !== customer.id) {
                await transaction.rollback();
                return res.status(403).json({ message: 'Access denied. This order does not belong to you' });
            }
        }

        // Check if order has debt to pay
        if (order.paymentMethod === 'cash') {
            await transaction.rollback();
            return res.status(400).json({ message: 'This order has no debt to pay' });
        }

        const remainingDebt = order.totalCost - order.amountPaid;

        if (remainingDebt <= 0) {
            await transaction.rollback();
            return res.status(400).json({ message: 'This order has no remaining debt' });
        }

        // Determine payment amount (not exceeding the debt)
        const paymentAmount = Math.min(amount, remainingDebt);
        const newAmountPaid = order.amountPaid + paymentAmount;

        // Update payment method if fully paid
        let newPaymentMethod = order.paymentMethod;
        if (newAmountPaid >= order.totalCost) {
            newPaymentMethod = 'cash';
        } else if (order.paymentMethod === 'debt') {
            newPaymentMethod = 'partial';
        }

        // Update the order
        await order.update({
            amountPaid: newAmountPaid,
            paymentMethod: newPaymentMethod
        }, { transaction });

        // Update customer account balance
        const customer = await customerModel.findByPk(order.customerId);

        if (customer) {
            await customer.update({
                accountBalance: Math.max(0, customer.accountBalance - paymentAmount)
            }, { transaction });
        }

        // Commit the transaction
        await transaction.commit();

        // Get updated order
        const updatedOrder = await customerOrderModel.findByPk(orderId, {
            include: [
                {
                    model: customerModel,
                    as: 'customer',
                    attributes: ['id', 'address', 'accountBalance'],
                    include: [{
                        model: userModel,
                        as: 'user',
                        attributes: ['userId', 'name']
                    }]
                }
            ]
        });

        return res.status(200).json({
            message: 'Debt payment processed successfully',
            paymentAmount,
            order: updatedOrder
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error processing debt payment:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const getAllCategories = async (req, res) => {
    try {
        const categories = await categoryModel.findAll({
            where: { status: 'Active' }
        });
        return res.status(200).json({
            message: 'Active categories retrieved successfully',
            categories
        });
    } catch (error) {
        console.error('Error fetching active categories:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
/**
 * @desc    Start order preparation(multiple workers can work on same order)
    * @route   POST / api / orders /: id / start - preparation
        * @access  Warehouse Employee
            */
export const startOrderPreparation = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { error: idError } = validateOrderId.validate({ id: req.params.id });
        if (idError) {
            await transaction.rollback();
            return res.status(400).json({ message: idError.details[0].message });
        }

        const { error: bodyError } = startPreparationSchema.validate(req.body);
        if (bodyError) {
            await transaction.rollback();
            return res.status(400).json({ message: bodyError.details[0].message });
        }

        const orderId = req.params.id;
        const { notes } = req.body;

        // Get warehouse employee from authenticated user
        const warehouseEmployee = await warehouseEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!warehouseEmployee) {
            await transaction.rollback();
            return res.status(403).json({ message: 'Access denied. User is not a warehouse employee' });
        }

        const warehouseEmployeeId = warehouseEmployee.id;

        // Get the order with items
        const order = await customerOrderModel.findByPk(orderId, {
            include: [
                {
                    model: customerOrderItemModel,
                    as: 'items',
                    include: [{
                        model: productModel,
                        as: 'product',
                        attributes: ['productId', 'name', 'quantity']
                    }]
                },
                {
                    model: orderPreparerModel,
                    as: 'preparers',
                    include: [{
                        model: warehouseEmployeeModel,
                        as: 'warehouseEmployee',
                        include: [{
                            model: userModel,
                            as: 'user',
                            attributes: ['name']
                        }]
                    }]
                }
            ]
        });

        if (!order) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if order can be prepared
        if (!['Accepted', 'Preparing'].includes(order.status)) {
            await transaction.rollback();
            return res.status(400).json({
                message: `Order cannot be prepared. Current status: ${order.status}`
            });
        }

        // Check if this worker is already preparing this order
        const existingPreparer = await orderPreparerModel.findOne({
            where: {
                orderId,
                warehouseEmployeeId,
                status: 'working'
            }
        });

        if (existingPreparer) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'You are already preparing this order'
            });
        }

        // Add this worker to the preparers
        await orderPreparerModel.create({
            orderId,
            warehouseEmployeeId,
            notes: notes || null,
            status: 'working'
        }, { transaction });

        // Update order status to "Preparing" if it's not already
        if (order.status === 'Accepted') {
            await order.update({
                status: 'Preparing',
                preparationStartedAt: new Date()
            }, { transaction });
        }

        // Get batch information and alerts for each product
        const batchAlerts = [];
        const itemsWithBatchInfo = [];

        for (const item of order.items) {
            const fifoAllocation = await getFIFOAllocation(item.productId, item.quantity);

            itemsWithBatchInfo.push({
                productId: item.productId,
                productName: item.product.name,
                requiredQuantity: item.quantity,
                availableQuantity: item.product.quantity,
                fifoAllocation,
                canFulfill: fifoAllocation.canFulfill,
                alerts: fifoAllocation.alerts || []
            });

            // Collect all alerts
            if (fifoAllocation.alerts && fifoAllocation.alerts.length > 0) {
                batchAlerts.push(...fifoAllocation.alerts.map(alert => ({
                    productId: item.productId,
                    productName: item.product.name,
                    ...alert
                })));
            }
        }

        await transaction.commit();

        // Get updated order info
        const updatedOrder = await customerOrderModel.findByPk(orderId, {
            include: [
                {
                    model: orderPreparerModel,
                    as: 'preparers',
                    where: { status: 'working' },
                    required: false,
                    include: [{
                        model: warehouseEmployeeModel,
                        as: 'warehouseEmployee',
                        include: [{
                            model: userModel,
                            as: 'user',
                            attributes: ['userId', 'name']
                        }]
                    }]
                }
            ]
        });

        return res.status(200).json({
            message: 'Started order preparation successfully',
            order: updatedOrder,
            preparationInfo: {
                totalItems: order.items.length,
                itemsWithBatchInfo,
                batchAlerts,
                hasMultipleBatches: batchAlerts.some(alert => alert.type === 'MULTIPLE_BATCHES'),
                hasNearExpiry: batchAlerts.some(alert => alert.type === 'NEAR_EXPIRY'),
                hasInsufficientStock: batchAlerts.some(alert => alert.type === 'INSUFFICIENT_STOCK'),
                canAutoComplete: itemsWithBatchInfo.every(item => item.canFulfill),
                currentPreparers: updatedOrder.preparers.map(p => ({
                    employeeId: p.warehouseEmployeeId,
                    employeeName: p.warehouseEmployee.user.name,
                    startedAt: p.startedAt
                }))
            }
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error starting order preparation:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Complete order preparation with batch allocation
 * @route   POST /api/orders/:id/complete-preparation
 * @access  Warehouse Employee
 */
export const completeOrderPreparation = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { error: idError } = validateOrderId.validate({ id: req.params.id });
        if (idError) {
            await transaction.rollback();
            return res.status(400).json({ message: idError.details[0].message });
        }

        const { error: bodyError } = completePreparationSchema.validate(req.body);
        if (bodyError) {
            await transaction.rollback();
            return res.status(400).json({ message: bodyError.details[0].message });
        }

        const orderId = req.params.id;
        const {
            manualBatchAllocations, // Optional - if provided, use manual method
            notes
        } = req.body;

        // Get warehouse employee from authenticated user (same as startOrderPreparation)
        const warehouseEmployee = await warehouseEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!warehouseEmployee) {
            await transaction.rollback();
            return res.status(403).json({ message: 'Access denied. User is not a warehouse employee' });
        }

        const warehouseEmployeeId = warehouseEmployee.id;

        // Auto-detect preparation method based on request content
        const preparationMethod = (manualBatchAllocations && manualBatchAllocations.length > 0)
            ? 'manual_batches'
            : 'auto_fifo';

        // Get the order with items
        const order = await customerOrderModel.findByPk(orderId, {
            include: [
                {
                    model: customerOrderItemModel,
                    as: 'items',
                    include: [{
                        model: productModel,
                        as: 'product'
                    }]
                }
            ]
        });

        if (!order) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.status !== 'Preparing') {
            await transaction.rollback();
            return res.status(400).json({
                message: `Order must be in Preparing status. Current status: ${order.status}`
            });
        }

        // Verify this worker is actually preparing this order
        const preparer = await orderPreparerModel.findOne({
            where: {
                orderId,
                warehouseEmployeeId,
                status: 'working'
            }
        });

        if (!preparer) {
            await transaction.rollback();
            return res.status(403).json({
                message: 'You are not currently preparing this order'
            });
        }

        let allBatchAllocations = [];
        let preparationSummary = [];

        // Process each item based on preparation method
        for (const item of order.items) {
            let allocation = [];

            if (preparationMethod === 'auto_fifo') {
                // Use automatic FIFO allocation
                const fifoResult = await getFIFOAllocation(item.productId, item.quantity);

                if (!fifoResult.canFulfill) {
                    await transaction.rollback();
                    return res.status(400).json({
                        message: `Cannot fulfill item ${item.product.name}. ${fifoResult.alerts[0]?.message || 'Insufficient stock'}`
                    });
                }

                allocation = fifoResult.allocation;

            } else if (preparationMethod === 'manual_batches') {
                // Use manual batch selection
                const manualAllocation = manualBatchAllocations?.find(ma => ma.productId === item.productId);

                if (!manualAllocation) {
                    await transaction.rollback();
                    return res.status(400).json({
                        message: `Manual batch allocation required for product ${item.product.name}`
                    });
                }

                // Validate manual allocation quantities
                const totalManualQuantity = manualAllocation.batchAllocations.reduce((sum, ba) => sum + ba.quantity, 0);

                if (totalManualQuantity !== item.quantity) {
                    await transaction.rollback();
                    return res.status(400).json({
                        message: `Manual allocation for ${item.product.name} doesn't match required quantity. Required: ${item.quantity}, Allocated: ${totalManualQuantity}`
                    });
                }

                // Verify batch availability
                for (const batchAlloc of manualAllocation.batchAllocations) {
                    const batch = await productBatchModel.findByPk(batchAlloc.batchId);

                    if (!batch || batch.productId !== item.productId) {
                        await transaction.rollback();
                        return res.status(400).json({
                            message: `Invalid batch ID ${batchAlloc.batchId} for product ${item.product.name}`
                        });
                    }

                    if (batch.quantity < batchAlloc.quantity) {
                        await transaction.rollback();
                        return res.status(400).json({
                            message: `Insufficient quantity in batch ${batch.batchNumber || batch.id}. Available: ${batch.quantity}, Required: ${batchAlloc.quantity}`
                        });
                    }
                }

                allocation = manualAllocation.batchAllocations.map(ba => ({
                    batchId: ba.batchId,
                    quantity: ba.quantity
                }));
            }

            // Store allocation for batch updates
            allBatchAllocations.push({
                productId: item.productId,
                allocation
            });

            preparationSummary.push({
                productId: item.productId,
                productName: item.product.name,
                requiredQuantity: item.quantity,
                allocation: allocation,
                method: preparationMethod
            });
        }

        // Update batch quantities and product quantities
        for (const itemAllocation of allBatchAllocations) {
            await updateBatchQuantities(itemAllocation.allocation, transaction);

            // Update total product quantity
            const product = await productModel.findByPk(itemAllocation.productId);
            const totalDeducted = itemAllocation.allocation.reduce((sum, alloc) => sum + alloc.quantity, 0);

            await product.update({
                quantity: Math.max(0, product.quantity - totalDeducted)
            }, { transaction });
        }

        // Mark this preparer as completed
        await preparer.update({
            status: 'completed',
            completedAt: new Date(),
            notes: notes || preparer.notes
        }, { transaction });

        // Update order status to Prepared and store batch allocation info
        await order.update({
            status: 'Prepared',
            preparationCompletedAt: new Date(),
            preparationMethod,
            batchAllocation: JSON.stringify(preparationSummary)
        }, { transaction });

        await transaction.commit();

        // Get final order state
        const completedOrder = await customerOrderModel.findByPk(orderId, {
            include: [
                {
                    model: customerModel,
                    as: 'customer',
                    attributes: ['id', 'address'],
                    include: [{
                        model: userModel,
                        as: 'user',
                        attributes: ['userId', 'name', 'phoneNumber']
                    }]
                },
                {
                    model: customerOrderItemModel,
                    as: 'items',
                    include: [{
                        model: productModel,
                        as: 'product',
                        attributes: ['productId', 'name', 'image', 'quantity']
                    }]
                },
                {
                    model: orderPreparerModel,
                    as: 'preparers',
                    include: [{
                        model: warehouseEmployeeModel,
                        as: 'warehouseEmployee',
                        include: [{
                            model: userModel,
                            as: 'user',
                            attributes: ['userId', 'name']
                        }]
                    }]
                }
            ]
        });

        return res.status(200).json({
            message: 'Order preparation completed successfully',
            order: completedOrder,
            preparationSummary: {
                method: preparationMethod,
                completedBy: warehouseEmployee.user?.name || 'Unknown',
                completedAt: preparer.completedAt,
                items: preparationSummary,
                totalItems: preparationSummary.length,
                allPreparers: completedOrder.preparers?.map(p => ({
                    employeeName: p.warehouseEmployee.user.name,
                    status: p.status,
                    startedAt: p.startedAt,
                    completedAt: p.completedAt
                })) || []
            }
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error completing order preparation:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get batch information for order preparation
 * @route   GET /api/orders/:id/batch-info
 * @access  Warehouse Employee
 */
export const getOrderBatchInfo = async (req, res) => {
    try {
        const { error } = validateOrderId.validate({ id: req.params.id });
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const orderId = req.params.id;

        const order = await customerOrderModel.findByPk(orderId, {
            include: [
                {
                    model: customerOrderItemModel,
                    as: 'items',
                    include: [{
                        model: productModel,
                        as: 'product',
                        include: [{
                            model: productBatchModel,
                            as: 'batches',
                            where: {
                                status: 'Active',
                                quantity: { [Op.gt]: 0 }
                            },
                            required: false,
                            order: [['prodDate', 'ASC'], ['receivedDate', 'ASC']]
                        }]
                    }]
                }
            ]
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const batchInfo = [];

        for (const item of order.items) {
            const fifoAllocation = await getFIFOAllocation(item.productId, item.quantity);

            batchInfo.push({
                productId: item.productId,
                productName: item.product.name,
                requiredQuantity: item.quantity,
                availableQuantity: item.product.quantity,
                batches: item.product.batches || [],
                fifoRecommendation: fifoAllocation.allocation || [],
                alerts: fifoAllocation.alerts || [],
                canFulfill: fifoAllocation.canFulfill
            });
        }

        return res.status(200).json({
            message: 'Batch information retrieved successfully',
            orderId,
            orderStatus: order.status,
            batchInfo,
            hasCriticalAlerts: batchInfo.some(item =>
                item.alerts.some(alert => ['INSUFFICIENT_STOCK', 'NO_STOCK'].includes(alert.type))
            ),
            hasMultipleBatches: batchInfo.some(item => item.batches.length > 1)
        });

    } catch (error) {
        console.error('Error getting order batch info:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Export all methods (include all existing methods plus new ones)
export * from './customerOrder.controller.js'; // This imports all existing methods
