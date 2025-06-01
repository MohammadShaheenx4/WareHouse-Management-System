import sequelize from "../../../DB/Connection.js";
import deliveryEmployeeModel from "../../../DB/Models/deliveryEmployee.model.js";
import deliveryHistoryModel from "../../../DB/Models/deliveryHistory.model.js";
import customerOrderModel from "../../../DB/Models/ordercustomer.model.js";
import customerOrderItemModel from "../../../DB/Models/customerOrderItem.model.js";
import customerModel from "../../../DB/Models/customer.model.js";
import productModel from "../../../DB/Models/product.model.js";
import userModel from "../../../DB/Models/user.model.js";
import { Op } from "sequelize";
import {
    startDeliverySchema,
    updateLocationSchema,
    updateEstimatedTimeSchema,
    completeDeliverySchema,
    validateOrderId,
    paginationSchema
} from "./delivery.validation.js";

// Get all prepared orders ready for delivery
export const getPreparedOrders = async (req, res) => {
    try {
        // Check if user is a delivery employee
        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        // Get orders with status 'Prepared'
        const preparedOrders = await customerOrderModel.findAll({
            where: { status: 'Prepared' },
            include: [
                {
                    model: customerModel,
                    as: 'customer',
                    attributes: ['id', 'address', 'latitude', 'longitude', 'accountBalance'],
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
                        attributes: ['productId', 'name', 'image']
                    }]
                }
            ],
            order: [['createdAt', 'ASC']] // Oldest first
        });

        return res.status(200).json({
            count: preparedOrders.length,
            preparedOrders
        });
    } catch (error) {
        console.error('Error getting prepared orders:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Start delivery for an order
export const startDelivery = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        // Validate request body
        const { error } = startDeliverySchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({ message: error.details[0].message });
        }

        const { orderId, estimatedTime } = req.body;

        // Check if user is a delivery employee
        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            await transaction.rollback();
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        // Check if delivery employee is available
        if (!deliveryEmployee.isAvailable) {
            await transaction.rollback();
            return res.status(400).json({ message: 'You are currently on another delivery' });
        }

        // Get the order
        const order = await customerOrderModel.findByPk(orderId, {
            include: [{
                model: customerModel,
                as: 'customer',
                attributes: ['id', 'latitude', 'longitude']
            }]
        });

        if (!order) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if order is ready for delivery
        if (order.status !== 'Prepared') {
            await transaction.rollback();
            return res.status(400).json({
                message: `Cannot start delivery for order with status ${order.status}. Order must be Prepared.`
            });
        }

        // Update order status to 'on_theway'
        await order.update({
            status: 'on_theway',
            deliveryEmployeeId: deliveryEmployee.id,
            estimatedDeliveryTime: estimatedTime,
            deliveryStartTime: new Date()
        }, { transaction });

        // Update delivery employee availability
        await deliveryEmployee.update({
            isAvailable: false
        }, { transaction });

        // Create delivery history record
        await deliveryHistoryModel.create({
            deliveryEmployeeId: deliveryEmployee.id,
            orderId: orderId,
            customerId: order.customerId,
            startTime: new Date(),
            estimatedTime: estimatedTime,
            customerLatitude: order.customer.latitude,
            customerLongitude: order.customer.longitude,
            totalAmount: order.totalCost,
            amountPaid: 0,
            debtAmount: 0,
            actualTime: 0
        }, { transaction });

        await transaction.commit();

        return res.status(200).json({
            message: 'Delivery started successfully',
            order: {
                id: order.id,
                estimatedTime: estimatedTime,
                customerLocation: {
                    latitude: order.customer.latitude,
                    longitude: order.customer.longitude
                }
            }
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error starting delivery:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Update delivery employee location
export const updateLocation = async (req, res) => {
    try {
        // Validate request body
        const { error } = updateLocationSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const { latitude, longitude } = req.body;

        // Check if user is a delivery employee
        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        // Update location
        await deliveryEmployee.update({
            currentLatitude: latitude,
            currentLongitude: longitude,
            lastLocationUpdate: new Date()
        });

        return res.status(200).json({
            message: 'Location updated successfully',
            location: {
                latitude,
                longitude,
                lastUpdate: new Date()
            }
        });
    } catch (error) {
        console.error('Error updating location:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Update estimated delivery time
export const updateEstimatedTime = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        // Validate request body
        const { error } = updateEstimatedTimeSchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({ message: error.details[0].message });
        }

        const { orderId, additionalTime, reason } = req.body;

        // Check if user is a delivery employee
        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            await transaction.rollback();
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        // Get the order
        const order = await customerOrderModel.findByPk(orderId);

        if (!order) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if order is being delivered by this employee
        if (order.deliveryEmployeeId !== deliveryEmployee.id) {
            await transaction.rollback();
            return res.status(403).json({ message: 'You are not assigned to this delivery' });
        }

        // Check if order is on the way
        if (order.status !== 'on_theway') {
            await transaction.rollback();
            return res.status(400).json({ message: 'Can only update time for orders that are on the way' });
        }

        // Update estimated time
        const newEstimatedTime = order.estimatedDeliveryTime + additionalTime;
        await order.update({
            estimatedDeliveryTime: newEstimatedTime,
            deliveryDelayReason: reason
        }, { transaction });

        // Update delivery history
        await deliveryHistoryModel.update({
            estimatedTime: newEstimatedTime
        }, {
            where: {
                orderId: orderId,
                deliveryEmployeeId: deliveryEmployee.id,
                endTime: null
            },
            transaction
        });

        await transaction.commit();

        return res.status(200).json({
            message: 'Estimated time updated successfully',
            newEstimatedTime: newEstimatedTime,
            reason: reason
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating estimated time:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Complete delivery
export const completeDelivery = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        // Validate request body
        const { error } = completeDeliverySchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({ message: error.details[0].message });
        }

        const { orderId, paymentMethod, totalAmount, amountPaid, deliveryNotes } = req.body;

        // Check if user is a delivery employee
        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            await transaction.rollback();
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        // Get the order with customer details
        const order = await customerOrderModel.findByPk(orderId, {
            include: [{
                model: customerModel,
                as: 'customer'
            }]
        });

        if (!order) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if order is being delivered by this employee
        if (order.deliveryEmployeeId !== deliveryEmployee.id) {
            await transaction.rollback();
            return res.status(403).json({ message: 'You are not assigned to this delivery' });
        }

        // Check if order is on the way
        if (order.status !== 'on_theway') {
            await transaction.rollback();
            return res.status(400).json({ message: 'Can only complete orders that are on the way' });
        }

        // Calculate debt amount
        const debtAmount = totalAmount - amountPaid;

        // Update customer account balance if payment is debt or partial
        if (paymentMethod === 'debt' || (paymentMethod === 'partial' && debtAmount > 0)) {
            const newBalance = parseFloat(order.customer.accountBalance) + debtAmount;
            await order.customer.update({
                accountBalance: newBalance
            }, { transaction });
        }

        // Update order
        await order.update({
            status: 'Shipped',
            paymentMethod: paymentMethod,
            amountPaid: amountPaid,
            deliveryEndTime: new Date(),
            deliveryNotes: deliveryNotes
        }, { transaction });

        // Update delivery history
        const deliveryHistory = await deliveryHistoryModel.findOne({
            where: {
                orderId: orderId,
                deliveryEmployeeId: deliveryEmployee.id,
                endTime: null
            }
        });

        if (deliveryHistory) {
            const endTime = new Date();
            const actualTime = Math.round((endTime - deliveryHistory.startTime) / 60000); // in minutes

            await deliveryHistory.update({
                endTime: endTime,
                actualTime: actualTime,
                paymentMethod: paymentMethod,
                amountPaid: amountPaid,
                debtAmount: debtAmount,
                deliveryNotes: deliveryNotes
            }, { transaction });
        }

        // Update delivery employee availability
        await deliveryEmployee.update({
            isAvailable: true
        }, { transaction });

        // Subtract product quantities from inventory
        const orderItems = await customerOrderItemModel.findAll({
            where: { orderId: orderId },
            include: [{
                model: productModel,
                as: 'product'
            }]
        });

        for (const item of orderItems) {
            const newQuantity = parseFloat(item.product.quantity) - parseFloat(item.quantity);
            await item.product.update({
                quantity: newQuantity
            }, { transaction });
        }

        await transaction.commit();

        return res.status(200).json({
            message: 'Delivery completed successfully',
            summary: {
                orderId: orderId,
                paymentMethod: paymentMethod,
                totalAmount: totalAmount,
                amountPaid: amountPaid,
                debtAmount: debtAmount,
                customerNewBalance: paymentMethod !== 'cash' ? order.customer.accountBalance + debtAmount : order.customer.accountBalance
            }
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error completing delivery:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get delivery history
export const getDeliveryHistory = async (req, res) => {
    try {
        // Check if user is a delivery employee
        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        // Validate query parameters
        const { error } = paginationSchema.validate(req.query);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const { startDate, endDate, page = 1, limit = 10 } = req.query;

        // Create where conditions
        const whereConditions = {
            deliveryEmployeeId: deliveryEmployee.id,
            endTime: { [Op.not]: null } // Only completed deliveries
        };

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

        // Get delivery history
        const { count, rows: deliveries } = await deliveryHistoryModel.findAndCountAll({
            where: whereConditions,
            include: [
                {
                    model: customerOrderModel,
                    as: 'order',
                    attributes: ['id', 'status', 'totalCost', 'discount']
                },
                {
                    model: customerModel,
                    as: 'customer',
                    attributes: ['id', 'address'],
                    include: [{
                        model: userModel,
                        as: 'user',
                        attributes: ['name', 'phoneNumber']
                    }]
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['endTime', 'DESC']]
        });

        // Calculate statistics
        const stats = await deliveryHistoryModel.findOne({
            where: { deliveryEmployeeId: deliveryEmployee.id },
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'totalDeliveries'],
                [sequelize.fn('SUM', sequelize.col('totalAmount')), 'totalRevenue'],
                [sequelize.fn('AVG', sequelize.col('actualTime')), 'avgDeliveryTime']
            ],
            raw: true
        });

        return res.status(200).json({
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit),
            stats: {
                totalDeliveries: stats.totalDeliveries || 0,
                totalRevenue: stats.totalRevenue || 0,
                avgDeliveryTime: Math.round(stats.avgDeliveryTime) || 0
            },
            deliveries
        });
    } catch (error) {
        console.error('Error getting delivery history:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get current delivery (if any)
export const getCurrentDelivery = async (req, res) => {
    try {
        // Check if user is a delivery employee
        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        // Get current delivery
        const currentOrder = await customerOrderModel.findOne({
            where: {
                deliveryEmployeeId: deliveryEmployee.id,
                status: 'on_theway'
            },
            include: [
                {
                    model: customerModel,
                    as: 'customer',
                    attributes: ['id', 'address', 'latitude', 'longitude', 'accountBalance'],
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
                        attributes: ['productId', 'name', 'image']
                    }]
                }
            ]
        });

        if (!currentOrder) {
            return res.status(200).json({
                message: 'No active delivery',
                currentDelivery: null
            });
        }

        // Get delivery history record
        const deliveryHistory = await deliveryHistoryModel.findOne({
            where: {
                orderId: currentOrder.id,
                deliveryEmployeeId: deliveryEmployee.id,
                endTime: null
            }
        });

        return res.status(200).json({
            currentDelivery: {
                ...currentOrder.get({ plain: true }),
                deliveryInfo: {
                    startTime: deliveryHistory?.startTime,
                    estimatedTime: deliveryHistory?.estimatedTime,
                    elapsedTime: deliveryHistory ? Math.round((new Date() - deliveryHistory.startTime) / 60000) : 0
                }
            }
        });
    } catch (error) {
        console.error('Error getting current delivery:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get delivery employee profile
export const getProfile = async (req, res) => {
    try {
        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId },
            include: [{
                model: userModel,
                as: 'user',
                attributes: ['userId', 'name', 'email', 'phoneNumber', 'profilePicture']
            }]
        });

        if (!deliveryEmployee) {
            return res.status(404).json({ message: 'Delivery employee profile not found' });
        }

        // Get statistics
        const stats = await deliveryHistoryModel.findOne({
            where: { deliveryEmployeeId: deliveryEmployee.id },
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'totalDeliveries'],
                [sequelize.fn('SUM', sequelize.col('totalAmount')), 'totalRevenue'],
                [sequelize.fn('AVG', sequelize.col('actualTime')), 'avgDeliveryTime'],
                [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('customerId'))), 'uniqueCustomers']
            ],
            raw: true
        });

        // Get today's deliveries count
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayDeliveries = await deliveryHistoryModel.count({
            where: {
                deliveryEmployeeId: deliveryEmployee.id,
                createdAt: {
                    [Op.gte]: todayStart
                }
            }
        });

        return res.status(200).json({
            profile: {
                ...deliveryEmployee.get({ plain: true }),
                stats: {
                    totalDeliveries: parseInt(stats.totalDeliveries) || 0,
                    totalRevenue: parseFloat(stats.totalRevenue) || 0,
                    avgDeliveryTime: Math.round(stats.avgDeliveryTime) || 0,
                    uniqueCustomers: parseInt(stats.uniqueCustomers) || 0,
                    todayDeliveries: todayDeliveries
                }
            }
        });
    } catch (error) {
        console.error('Error getting delivery employee profile:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};