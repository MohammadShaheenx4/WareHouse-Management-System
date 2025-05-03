import customerOrderModel from "../../../DB/Models/ordercustomer.model.js";
import customerOrderItemModel from "../../../DB/Models/customerOrderItem.model.js";
import customerModel from "../../../DB/Models/customer.model.js";
import productModel from "../../../DB/Models/product.model.js";
import userModel from "../../../DB/Models/user.model.js";
import categoryModel from "../../../DB/Models/category.model.js";
import { Op } from "sequelize";
import sequelize from "../../../DB/Connection.js";
import {
    createOrderSchema,
    updateOrderStatusSchema,
    validateOrderId,
    getCategoryProductsSchema
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
                sellPrice: product.sellPrice,  // Fixed: changed from Price to sellPrice
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