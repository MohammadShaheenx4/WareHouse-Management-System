// File: Modules/warehouseEmployee/worker.controller.js
import sequelize from "../../../DB/Connection.js";
import warehouseEmployeeModel from "../../../DB/Models/WareHouseEmployee.model.js";
import orderActivityLogModel from "../../../DB/Models/orderActivityLog.model.js";
import customerOrderModel from "../../../DB/Models/ordercustomer.model.js";
import customerOrderItemModel from "../../../DB/Models/customerOrderItem.model.js";
import customerModel from "../../../DB/Models/customer.model.js";
import supplierOrderModel from "../../../DB/Models/supplierOrder.model.js";
import supplierOrderItemModel from "../../../DB/Models/supplierOrderItem.model.js";
import supplierModel from "../../../DB/Models/supplier.model.js";
import productModel from "../../../DB/Models/product.model.js";
import userModel from "../../../DB/Models/user.model.js";
import { Op } from "sequelize";
import {
    prepareCustomerOrderSchema,
    receiveSupplierOrderSchema,
    validateOrderId
} from "./worker.validation.js";

// Create log entry for order activity
const createActivityLog = async (userId, orderType, orderId, action, previousStatus, newStatus, note, transaction) => {
    // Skip logging for list view actions where orderId is null
    if (orderId === null) {
        return; // Don't create log entries for actions without a specific order
    }

    await orderActivityLogModel.create({
        userId,
        orderType,
        orderId,
        action,
        previousStatus,
        newStatus,
        note
    }, { transaction });
};

// Get pending customer orders
export const getPendingCustomerOrders = async (req, res) => {
    try {
        // Check if user is a warehouse employee
        const warehouseEmployee = await warehouseEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!warehouseEmployee) {
            return res.status(403).json({ message: 'Access denied. User is not a warehouse employee' });
        }

        // Get orders with status 'Accepted'
        const pendingOrders = await customerOrderModel.findAll({
            where: { status: 'Accepted' },
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
                }
            ],
            order: [['createdAt', 'ASC']] // Oldest first
        });

        // Remove logging for list view to avoid null orderId issue
        // await createActivityLog(...) - removed

        return res.status(200).json({
            count: pendingOrders.length,
            pendingOrders
        });
    } catch (error) {
        console.error('Error getting pending customer orders:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get pending supplier orders
export const getPendingSupplierOrders = async (req, res) => {
    try {
        // Check if user is a warehouse employee
        const warehouseEmployee = await warehouseEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!warehouseEmployee) {
            return res.status(403).json({ message: 'Access denied. User is not a warehouse employee' });
        }

        // Get orders with status 'Accepted' or 'PartiallyAccepted'
        const pendingOrders = await supplierOrderModel.findAll({
            where: {
                status: ['Accepted']
            },
            include: [
                {
                    model: supplierModel,
                    as: 'supplier',
                    include: [{
                        model: userModel,
                        as: 'user',
                        attributes: ['userId', 'name', 'email', 'phoneNumber']
                    }]
                },
                {
                    model: supplierOrderItemModel,
                    as: 'items',
                    include: [{
                        model: productModel,
                        as: 'product',
                        attributes: ['productId', 'name', 'image', 'quantity']
                    }]
                }
            ],
            order: [['createdAt', 'ASC']] // Oldest first
        });

        // Remove logging for list view to avoid null orderId issue
        // await createActivityLog(...) - removed

        return res.status(200).json({
            count: pendingOrders.length,
            pendingOrders
        });
    } catch (error) {
        console.error('Error getting pending supplier orders:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get customer order by ID with logging
export const getCustomerOrderById = async (req, res) => {
    try {
        // Validate ID parameter
        const idValidation = validateOrderId.validate({ id: req.params.id });
        if (idValidation.error) {
            return res.status(400).json({ message: idValidation.error.details[0].message });
        }

        // Check if user is a warehouse employee
        const warehouseEmployee = await warehouseEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!warehouseEmployee) {
            return res.status(403).json({ message: 'Access denied. User is not a warehouse employee' });
        }

        const orderId = req.params.id;

        // Get the specific order
        const order = await customerOrderModel.findByPk(orderId, {
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
                }
            ]
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Now we can log this view since we have a valid orderId
        await createActivityLog(
            req.user.userId,
            'customer',
            orderId,
            'Viewed customer order details',
            order.status,
            order.status,
            null,
            null
        );

        return res.status(200).json({ order });
    } catch (error) {
        console.error('Error getting customer order details:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get supplier order by ID with logging
export const getSupplierOrderById = async (req, res) => {
    try {
        // Validate ID parameter
        const idValidation = validateOrderId.validate({ id: req.params.id });
        if (idValidation.error) {
            return res.status(400).json({ message: idValidation.error.details[0].message });
        }

        // Check if user is a warehouse employee
        const warehouseEmployee = await warehouseEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!warehouseEmployee) {
            return res.status(403).json({ message: 'Access denied. User is not a warehouse employee' });
        }

        const orderId = req.params.id;

        // Get the specific order
        const order = await supplierOrderModel.findByPk(orderId, {
            include: [
                {
                    model: supplierModel,
                    as: 'supplier',
                    include: [{
                        model: userModel,
                        as: 'user',
                        attributes: ['userId', 'name', 'email', 'phoneNumber']
                    }]
                },
                {
                    model: supplierOrderItemModel,
                    as: 'items',
                    include: [{
                        model: productModel,
                        as: 'product',
                        attributes: ['productId', 'name', 'image', 'quantity']
                    }]
                }
            ]
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Now we can log this view since we have a valid orderId
        await createActivityLog(
            req.user.userId,
            'supplier',
            orderId,
            'Viewed supplier order details',
            order.status,
            order.status,
            null,
            null
        );

        return res.status(200).json({ order });
    } catch (error) {
        console.error('Error getting supplier order details:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Start preparing a customer order
export const updateCustomerOrderStatus = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        // Validate ID parameter
        const idValidation = validateOrderId.validate({ id: req.params.id });
        if (idValidation.error) {
            await transaction.rollback();
            return res.status(400).json({ message: idValidation.error.details[0].message });
        }

        // Validate request body
        const { error } = prepareCustomerOrderSchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({ message: error.details[0].message });
        }

        const orderId = req.params.id;
        const { status, note } = req.body;

        // Check if user is a warehouse employee
        const warehouseEmployee = await warehouseEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!warehouseEmployee) {
            await transaction.rollback();
            return res.status(403).json({ message: 'Access denied. User is not a warehouse employee' });
        }

        // Get the order
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

        const previousStatus = order.status;

        // Check if order status can be updated
        if (status === 'Preparing' && order.status !== 'Accepted') {
            await transaction.rollback();
            return res.status(400).json({
                message: `Cannot update order with status ${order.status} to Preparing. Order must be Accepted first.`
            });
        }

        if (status === 'Prepared' && order.status !== 'Preparing') {
            await transaction.rollback();
            return res.status(400).json({
                message: `Cannot update order with status ${order.status} to Prepared. Order must be in Preparing state first.`
            });
        }

        // If status is 'Prepared', check if all items are available
        if (status === 'Prepared') {
            const insufficientItems = [];

            for (const item of order.items) {
                const product = item.product;

                if (product.quantity < item.quantity) {
                    insufficientItems.push({
                        productId: product.productId,
                        name: product.name,
                        requested: item.quantity,
                        available: product.quantity
                    });
                }
            }

            if (insufficientItems.length > 0) {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'Cannot mark order as Prepared due to insufficient product quantities',
                    insufficientItems
                });
            }

            // Note: As per your request, we're not subtracting quantities yet
            // This will be implemented later
        }

        // Update order status
        const updateData = {
            status,
            note: note || order.note
        };

        // If starting preparation, record who started it
        if (status === 'Preparing') {
            updateData.preparedBy = warehouseEmployee.id;
            updateData.preparedAt = new Date();
        }

        await order.update(updateData, { transaction });

        // Log the activity
        await createActivityLog(
            req.user.userId,
            'customer',
            orderId,
            `Updated order status to ${status}`,
            previousStatus,
            status,
            note,
            transaction
        );

        // Commit the transaction
        await transaction.commit();

        // Get updated order with all details
        const updatedOrder = await customerOrderModel.findByPk(orderId, {
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
                }
            ]
        });

        return res.status(200).json({
            message: `Order status updated to ${status} successfully`,
            order: updatedOrder
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating customer order status:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Receive a supplier order
export const receiveSupplierOrder = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        // Validate ID parameter
        const idValidation = validateOrderId.validate({ id: req.params.id });
        if (idValidation.error) {
            await transaction.rollback();
            return res.status(400).json({ message: idValidation.error.details[0].message });
        }

        // Validate request body
        const { error } = receiveSupplierOrderSchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({ message: error.details[0].message });
        }

        const orderId = req.params.id;
        const { status, note, items } = req.body;

        // Check if user is a warehouse employee
        const warehouseEmployee = await warehouseEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!warehouseEmployee) {
            await transaction.rollback();
            return res.status(403).json({ message: 'Access denied. User is not a warehouse employee' });
        }

        // Get the order
        const order = await supplierOrderModel.findByPk(orderId, {
            include: [
                {
                    model: supplierOrderItemModel,
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

        const previousStatus = order.status;

        // Check if order can be delivered
        if (status === 'Delivered' &&
            order.status !== 'Accepted' &&
            order.status !== 'PartiallyAccepted') {
            await transaction.rollback();
            return res.status(400).json({
                message: `Cannot mark order as Delivered with status ${order.status}. Order must be Accepted or PartiallyAccepted first.`
            });
        }

        // Create a map for easier access to order items
        const orderItemMap = {};
        for (const item of order.items) {
            orderItemMap[item.productId] = item;
        }

        // Process received quantities if provided
        if (items && items.length > 0) {
            for (const item of items) {
                const orderItem = orderItemMap[item.id];

                if (!orderItem) {
                    continue; // Skip if item not found in order
                }

                // If receivedQuantity is specified and different from ordered quantity
                if (item.receivedQuantity !== undefined &&
                    item.receivedQuantity !== null &&
                    item.receivedQuantity !== orderItem.quantity) {

                    // Update the received quantity
                    await orderItem.update({
                        receivedQuantity: item.receivedQuantity,
                        // Adjust subtotal if quantity is different
                        subtotal: orderItem.costPrice * item.receivedQuantity
                    }, { transaction });
                }
            }
        }

        // Update product quantities
        for (const item of order.items) {
            // Only update inventory for accepted items
            if (item.status === 'Accepted') {
                const product = item.product;

                if (product) {
                    // Get the quantity to add (use receivedQuantity if available, otherwise use ordered quantity)
                    const quantityToAdd = (item.receivedQuantity !== undefined &&
                        item.receivedQuantity !== null) ?
                        item.receivedQuantity : item.quantity;

                    // Update product quantity
                    const newQuantity = parseFloat(product.quantity) + parseFloat(quantityToAdd);

                    await product.update({
                        quantity: newQuantity
                    }, { transaction });

                    // Update production and expiration dates if they were set on the order item
                    if (item.prodDate || item.expDate) {
                        const updateData = {};
                        if (item.prodDate) updateData.prodDate = item.prodDate;
                        if (item.expDate) updateData.expDate = item.expDate;

                        await product.update(updateData, { transaction });
                    }
                }
            }
        }

        // Update order status
        await order.update({
            status: 'Delivered',
            note: note || order.note,
            receivedBy: warehouseEmployee.id,
            receivedAt: new Date()
        }, { transaction });

        // Log the activity
        await createActivityLog(
            req.user.userId,
            'supplier',
            orderId,
            `Received order and marked as ${status}`,
            previousStatus,
            status,
            note,
            transaction
        );

        // Commit the transaction
        await transaction.commit();

        // Get updated order with all details
        const updatedOrder = await supplierOrderModel.findByPk(orderId, {
            include: [
                {
                    model: supplierModel,
                    as: 'supplier',
                    include: [{
                        model: userModel,
                        as: 'user',
                        attributes: ['userId', 'name', 'email', 'phoneNumber']
                    }]
                },
                {
                    model: supplierOrderItemModel,
                    as: 'items',
                    include: [{
                        model: productModel,
                        as: 'product',
                        attributes: ['productId', 'name', 'image', 'quantity']
                    }]
                }
            ]
        });

        return res.status(200).json({
            message: `Order marked as ${status} successfully`,
            order: updatedOrder
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error receiving supplier order:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get orders history for the warehouse employee
export const getOrdersHistory = async (req, res) => {
    try {
        // Check if user is a warehouse employee
        const warehouseEmployee = await warehouseEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!warehouseEmployee) {
            return res.status(403).json({ message: 'Access denied. User is not a warehouse employee' });
        }

        // Query parameters
        const { orderType, startDate, endDate, page = 1, limit = 10 } = req.query;

        // Create base query conditions
        const whereConditions = {
            userId: req.user.userId
        };

        // Add order type filter if provided
        if (orderType === 'customer' || orderType === 'supplier') {
            whereConditions.orderType = orderType;
        }

        // Add date range filter if provided
        if (startDate && endDate) {
            whereConditions.createdAt = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        } else if (startDate) {
            whereConditions.createdAt = {
                [Op.gte]: new Date(startDate)
            };
        } else if (endDate) {
            whereConditions.createdAt = {
                [Op.lte]: new Date(endDate)
            };
        }

        // Calculate pagination
        const offset = (page - 1) * limit;

        // Get activity logs
        const { count, rows: activityLogs } = await orderActivityLogModel.findAndCountAll({
            where: whereConditions,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: userModel,
                    as: 'user',
                    attributes: ['userId', 'name']
                }
            ]
        });

        // Enhance logs with order details
        const enhancedLogs = [];

        for (const log of activityLogs) {
            let orderDetails = null;

            if (log.orderType === 'customer') {
                orderDetails = await customerOrderModel.findByPk(log.orderId, {
                    attributes: ['id', 'totalCost', 'status'],
                    include: [
                        {
                            model: customerModel,
                            as: 'customer',
                            attributes: ['id'],
                            include: [{
                                model: userModel,
                                as: 'user',
                                attributes: ['name']
                            }]
                        }
                    ]
                });
            } else if (log.orderType === 'supplier') {
                orderDetails = await supplierOrderModel.findByPk(log.orderId, {
                    attributes: ['id', 'totalCost', 'status'],
                    include: [
                        {
                            model: supplierModel,
                            as: 'supplier',
                            attributes: ['id'],
                            include: [{
                                model: userModel,
                                as: 'user',
                                attributes: ['name']
                            }]
                        }
                    ]
                });
            }

            enhancedLogs.push({
                ...log.get({ plain: true }),
                orderDetails
            });
        }

        return res.status(200).json({
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit),
            activityLogs: enhancedLogs
        });
    } catch (error) {
        console.error('Error getting orders history:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get order activity logs (for admins to see who worked on an order)
export const getOrderActivityLogs = async (req, res) => {
    try {
        // Validate ID parameter
        const idValidation = validateOrderId.validate({ id: req.params.id });
        if (idValidation.error) {
            return res.status(400).json({ message: idValidation.error.details[0].message });
        }

        // Check if user is an admin
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied. Only admins can view detailed order logs' });
        }

        const orderId = req.params.id;
        const orderType = req.query.type; // 'customer' or 'supplier'

        if (!orderType || (orderType !== 'customer' && orderType !== 'supplier')) {
            return res.status(400).json({ message: 'Order type must be specified as "customer" or "supplier"' });
        }

        // Check if order exists
        let orderExists = false;

        if (orderType === 'customer') {
            const order = await customerOrderModel.findByPk(orderId);
            orderExists = !!order;
        } else {
            const order = await supplierOrderModel.findByPk(orderId);
            orderExists = !!order;
        }

        if (!orderExists) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Get all logs for this order
        const logs = await orderActivityLogModel.findAll({
            where: {
                orderType,
                orderId
            },
            order: [['createdAt', 'ASC']],
            include: [
                {
                    model: userModel,
                    as: 'user',
                    attributes: ['userId', 'name', 'email', 'role']
                }
            ]
        });

        return res.status(200).json({
            orderType,
            orderId,
            activityLogs: logs
        });
    } catch (error) {
        console.error('Error getting order activity logs:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get warehouse employee profile
export const getProfile = async (req, res) => {
    try {
        const warehouseEmployee = await warehouseEmployeeModel.findOne({
            where: { userId: req.user.userId },
            include: [
                {
                    model: userModel,
                    as: 'user',
                    attributes: ['userId', 'name', 'email', 'phoneNumber', 'role']
                }
            ]
        });

        if (!warehouseEmployee) {
            return res.status(404).json({ message: 'Warehouse employee profile not found' });
        }

        // Get counts of orders handled
        const customerOrdersCount = await orderActivityLogModel.count({
            where: {
                userId: req.user.userId,
                orderType: 'customer',
                action: {
                    [Op.like]: '%Updated order status to Prepared%'
                }
            }
        });

        const supplierOrdersCount = await orderActivityLogModel.count({
            where: {
                userId: req.user.userId,
                orderType: 'supplier',
                action: {
                    [Op.like]: '%Received order%'
                }
            }
        });

        return res.status(200).json({
            warehouseEmployee: {
                ...warehouseEmployee.get({ plain: true }),
                stats: {
                    customerOrdersPrepared: customerOrdersCount,
                    supplierOrdersReceived: supplierOrdersCount
                }
            }
        });
    } catch (error) {
        console.error('Error getting warehouse employee profile:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};