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
    assignOrdersSchema,
    startDeliverySchema,
    updateLocationSchema,
    updateEstimatedTimeSchema,
    completeDeliverySchema,
    returnOrderSchema,
    validateOrderId,
    paginationSchema
} from "./delivery.validation.js";

// =================== ADMIN FUNCTIONS ===================

// Get overall delivery statistics (Admin only)
export const getDeliveryStats = async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const thisWeekStart = new Date();
        thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
        thisWeekStart.setHours(0, 0, 0, 0);

        const thisMonthStart = new Date();
        thisMonthStart.setDate(1);
        thisMonthStart.setHours(0, 0, 0, 0);

        // Get overall statistics
        const totalStats = await deliveryHistoryModel.findOne({
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'totalDeliveries'],
                [sequelize.fn('SUM', sequelize.col('totalAmount')), 'totalRevenue'],
                [sequelize.fn('AVG', sequelize.col('actualTime')), 'avgDeliveryTime']
            ],
            where: { endTime: { [Op.not]: null } },
            raw: true
        });

        // Today's stats
        const todayStats = await deliveryHistoryModel.findOne({
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'todayDeliveries'],
                [sequelize.fn('SUM', sequelize.col('totalAmount')), 'todayRevenue']
            ],
            where: {
                endTime: { [Op.not]: null },
                createdAt: { [Op.gte]: todayStart }
            },
            raw: true
        });

        // Active orders count
        const activeOrdersCount = await customerOrderModel.count({
            where: { status: { [Op.in]: ['Assigned', 'on_theway'] } }
        });

        // Available delivery employees
        const availableEmployeesCount = await deliveryEmployeeModel.count({
            where: { isAvailable: true }
        });

        // Pending orders (unassigned)
        const pendingOrdersCount = await customerOrderModel.count({
            where: {
                status: 'Prepared',
                deliveryEmployeeId: null
            }
        });

        // Today's returns
        const todayReturns = await customerOrderModel.count({
            where: {
                status: 'Returned',
                deliveryEndTime: { [Op.gte]: todayStart }
            }
        });

        return res.status(200).json({
            totalStats: {
                totalDeliveries: parseInt(totalStats.totalDeliveries) || 0,
                totalRevenue: parseFloat(totalStats.totalRevenue) || 0,
                avgDeliveryTime: Math.round(totalStats.avgDeliveryTime) || 0
            },
            todayStats: {
                deliveries: parseInt(todayStats.todayDeliveries) || 0,
                revenue: parseFloat(todayStats.todayRevenue) || 0,
                returns: todayReturns
            },
            currentStatus: {
                activeOrders: activeOrdersCount,
                pendingOrders: pendingOrdersCount,
                availableEmployees: availableEmployeesCount
            }
        });
    } catch (error) {
        console.error('Error getting delivery stats:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get all prepared orders ready for assignment (Admin only)
export const getUnassignedOrders = async (req, res) => {
    try {
        // Get orders with status 'Prepared' and not assigned to any delivery employee
        const unassignedOrders = await customerOrderModel.findAll({
            where: {
                status: 'Prepared',
                deliveryEmployeeId: null
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
            ],
            order: [['createdAt', 'ASC']]
        });

        return res.status(200).json({
            count: unassignedOrders.length,
            unassignedOrders
        });
    } catch (error) {
        console.error('Error getting unassigned orders:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get all delivery employees with their current workload (Admin only)
export const getDeliveryEmployeesWorkload = async (req, res) => {
    try {
        const deliveryEmployees = await deliveryEmployeeModel.findAll({
            include: [
                {
                    model: userModel,
                    as: 'user',
                    attributes: ['userId', 'name', 'phoneNumber']
                },
                {
                    model: customerOrderModel,
                    as: 'assignedOrders',
                    where: { status: { [Op.in]: ['Assigned', 'on_theway'] } },
                    required: false,
                    include: [{
                        model: customerModel,
                        as: 'customer',
                        attributes: ['address', 'latitude', 'longitude'],
                        include: [{
                            model: userModel,
                            as: 'user',
                            attributes: ['name']
                        }]
                    }]
                }
            ]
        });

        const workloadData = deliveryEmployees.map(employee => ({
            employeeId: employee.id,
            employeeInfo: employee.user,
            currentLocation: {
                latitude: employee.currentLatitude,
                longitude: employee.currentLongitude,
                lastUpdate: employee.lastLocationUpdate
            },
            activeOrdersCount: employee.assignedOrders?.length || 0,
            activeOrders: employee.assignedOrders || [],
            isAvailable: employee.isAvailable || false
        }));

        return res.status(200).json({
            deliveryEmployees: workloadData
        });
    } catch (error) {
        console.error('Error getting delivery employees workload:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Assign orders to delivery employee (Admin only)
export const assignOrdersToDelivery = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        // Validate request body
        const { error } = assignOrdersSchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({ message: error.details[0].message });
        }

        const { deliveryEmployeeId, orderIds, estimatedTime } = req.body;

        // Check if delivery employee exists
        const deliveryEmployee = await deliveryEmployeeModel.findByPk(deliveryEmployeeId);
        if (!deliveryEmployee) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Delivery employee not found' });
        }

        // Get orders and validate they can be assigned
        const orders = await customerOrderModel.findAll({
            where: {
                id: { [Op.in]: orderIds },
                status: 'Prepared',
                deliveryEmployeeId: null
            },
            include: [{
                model: customerModel,
                as: 'customer',
                attributes: ['latitude', 'longitude']
            }]
        });

        if (orders.length !== orderIds.length) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Some orders are not available for assignment or do not exist'
            });
        }

        // Update orders status and assign to delivery employee
        await customerOrderModel.update({
            status: 'Assigned',
            deliveryEmployeeId: deliveryEmployeeId,
            estimatedDeliveryTime: estimatedTime,
            assignedAt: new Date()
        }, {
            where: { id: { [Op.in]: orderIds } },
            transaction
        });

        // Create delivery history records for each order
        const deliveryHistoryData = orders.map(order => ({
            deliveryEmployeeId: deliveryEmployeeId,
            orderId: order.id,
            customerId: order.customerId,
            assignedTime: new Date(),
            estimatedTime: estimatedTime,
            customerLatitude: order.customer.latitude,
            customerLongitude: order.customer.longitude,
            totalAmount: order.totalCost,
            amountPaid: 0,
            debtAmount: 0,
            actualTime: 0,
            status: 'assigned'
        }));

        await deliveryHistoryModel.bulkCreate(deliveryHistoryData, { transaction });

        await transaction.commit();

        return res.status(200).json({
            message: `Successfully assigned ${orders.length} orders to delivery employee`,
            assignedOrders: orders.map(order => ({
                orderId: order.id,
                customerLocation: {
                    latitude: order.customer.latitude,
                    longitude: order.customer.longitude
                }
            })),
            deliveryEmployeeId,
            estimatedTime
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error assigning orders:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// =================== DELIVERY EMPLOYEE FUNCTIONS ===================

// Get assigned orders for delivery employee
export const getAssignedOrders = async (req, res) => {
    try {
        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        const assignedOrders = await customerOrderModel.findAll({
            where: {
                deliveryEmployeeId: deliveryEmployee.id,
                status: { [Op.in]: ['Assigned', 'on_theway'] }
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
            ],
            order: [['assignedAt', 'ASC']]
        });

        return res.status(200).json({
            count: assignedOrders.length,
            assignedOrders: assignedOrders.map(order => ({
                ...order.get({ plain: true }),
                canStart: order.status === 'Assigned',
                isInProgress: order.status === 'on_theway'
            }))
        });
    } catch (error) {
        console.error('Error getting assigned orders:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Start delivery for a specific assigned order (ENHANCED with location tracking)
export const startDelivery = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { orderId, orderIds, routeNotes, latitude, longitude } = req.body;

        // Determine if single or multiple orders
        let targetOrderIds = [];
        if (orderId) {
            targetOrderIds = [orderId]; // Single order
        } else if (orderIds && Array.isArray(orderIds)) {
            targetOrderIds = orderIds; // Multiple orders
        } else {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Either orderId (single) or orderIds (array) is required'
            });
        }

        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            await transaction.rollback();
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        // Get all orders that can be started
        const orders = await customerOrderModel.findAll({
            where: {
                id: { [Op.in]: targetOrderIds },
                deliveryEmployeeId: deliveryEmployee.id,
                status: 'Assigned'
            },
            include: [{
                model: customerModel,
                as: 'customer',
                attributes: ['id', 'latitude', 'longitude']
            }]
        });

        if (orders.length !== targetOrderIds.length) {
            await transaction.rollback();
            return res.status(404).json({
                message: 'Some orders not found, not assigned to you, or already started'
            });
        }

        const startTime = new Date();

        // Determine employee location (from request or current stored location)
        let employeeLatitude = latitude || deliveryEmployee.currentLatitude;
        let employeeLongitude = longitude || deliveryEmployee.currentLongitude;

        // If location provided in request, update employee's current location
        if (latitude && longitude) {
            await deliveryEmployee.update({
                currentLatitude: latitude,
                currentLongitude: longitude,
                lastLocationUpdate: startTime
            }, { transaction });
        }

        // Update all orders to 'on_theway' status
        await customerOrderModel.update({
            status: 'on_theway',
            deliveryStartTime: startTime,
            deliveryNotes: routeNotes || null
        }, {
            where: { id: { [Op.in]: targetOrderIds } },
            transaction
        });

        // Update delivery history for all orders with employee's location
        await deliveryHistoryModel.update({
            startTime: startTime,
            status: 'in_progress',
            // Store delivery employee's starting location
            employeeStartLatitude: employeeLatitude,
            employeeStartLongitude: employeeLongitude
        }, {
            where: {
                orderId: { [Op.in]: targetOrderIds },
                deliveryEmployeeId: deliveryEmployee.id,
                endTime: null
            },
            transaction
        });

        await transaction.commit();

        // Response format
        if (targetOrderIds.length === 1) {
            // Single order response (backward compatibility)
            return res.status(200).json({
                message: 'Delivery started successfully',
                order: {
                    id: orders[0].id,
                    customerLocation: {
                        latitude: orders[0].customer.latitude,
                        longitude: orders[0].customer.longitude
                    }
                },
                employeeStartLocation: {
                    latitude: employeeLatitude,
                    longitude: employeeLongitude,
                    timestamp: startTime
                }
            });
        } else {
            // Multiple orders response
            return res.status(200).json({
                message: `Successfully started delivery for ${orders.length} orders`,
                orders: orders.map(order => ({
                    id: order.id,
                    customerLocation: {
                        latitude: order.customer.latitude,
                        longitude: order.customer.longitude
                    }
                })),
                startTime: startTime,
                routeNotes: routeNotes || null,
                employeeStartLocation: {
                    latitude: employeeLatitude,
                    longitude: employeeLongitude,
                    timestamp: startTime
                }
            });
        }

    } catch (error) {
        await transaction.rollback();
        console.error('Error starting delivery:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Return order (NEW - when customer unavailable/sick/refuses delivery)
export const returnOrder = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { error } = returnOrderSchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({ message: error.details[0].message });
        }

        const { orderId, returnReason, returnNotes } = req.body;

        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            await transaction.rollback();
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        const order = await customerOrderModel.findOne({
            where: {
                id: orderId,
                deliveryEmployeeId: deliveryEmployee.id,
                status: 'on_theway'
            },
            include: [{
                model: customerModel,
                as: 'customer'
            }]
        });

        if (!order) {
            await transaction.rollback();
            return res.status(404).json({
                message: 'Order not found, not assigned to you, or not in progress'
            });
        }

        // Update order status to 'Returned'
        await order.update({
            status: 'Returned',
            deliveryEndTime: new Date(),
            deliveryNotes: returnNotes,
            returnReason: returnReason
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
            const actualTime = Math.round((endTime - deliveryHistory.startTime) / 60000);

            await deliveryHistory.update({
                endTime: endTime,
                actualTime: actualTime,
                deliveryNotes: returnNotes,
                status: 'returned',
                returnReason: returnReason
            }, { transaction });
        }

        // IMPORTANT: Do NOT subtract quantities - products are returned to inventory
        // No quantity changes needed since products weren't delivered

        await transaction.commit();

        return res.status(200).json({
            message: 'Order marked as returned successfully',
            summary: {
                orderId: orderId,
                status: 'Returned',
                returnReason: returnReason,
                returnTime: new Date(),
                note: 'Product quantities remain unchanged - items returned to inventory'
            }
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error returning order:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get delivery actions for current active deliveries (NEW)
export const getDeliveryActions = async (req, res) => {
    try {
        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        const activeOrders = await customerOrderModel.findAll({
            where: {
                deliveryEmployeeId: deliveryEmployee.id,
                status: 'on_theway'
            },
            include: [
                {
                    model: customerModel,
                    as: 'customer',
                    attributes: ['id', 'address', 'latitude', 'longitude'],
                    include: [{
                        model: userModel,
                        as: 'user',
                        attributes: ['name', 'phoneNumber']
                    }]
                },
                {
                    model: customerOrderItemModel,
                    as: 'items',
                    include: [{
                        model: productModel,
                        as: 'product',
                        attributes: ['productId', 'name', 'quantity']
                    }]
                }
            ],
            order: [['deliveryStartTime', 'ASC']]
        });

        return res.status(200).json({
            inProgressOrders: activeOrders.map(order => ({
                ...order.get({ plain: true }),
                availableActions: [
                    'complete_delivery',    // Mark as successfully delivered
                    'return_order',         // Mark as returned (customer unavailable/sick)
                    'update_estimated_time' // Update delivery time if delayed
                ]
            }))
        });
    } catch (error) {
        console.error('Error getting delivery actions:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Update delivery employee location
export const updateLocation = async (req, res) => {
    try {
        const { error } = updateLocationSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const { latitude, longitude } = req.body;

        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

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
        const { error } = updateEstimatedTimeSchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({ message: error.details[0].message });
        }

        const { orderId, additionalTime, reason } = req.body;

        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            await transaction.rollback();
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        const order = await customerOrderModel.findOne({
            where: {
                id: orderId,
                deliveryEmployeeId: deliveryEmployee.id,
                status: 'on_theway'
            }
        });

        if (!order) {
            await transaction.rollback();
            return res.status(404).json({
                message: 'Order not found, not assigned to you, or not in progress'
            });
        }

        const newEstimatedTime = order.estimatedDeliveryTime + additionalTime;
        await order.update({
            estimatedDeliveryTime: newEstimatedTime,
            deliveryDelayReason: reason
        }, { transaction });

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
            orderId,
            newEstimatedTime,
            reason
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating estimated time:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Complete delivery (ENHANCED - handles inventory correctly)
export const completeDelivery = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { error } = completeDeliverySchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({ message: error.details[0].message });
        }

        const { orderId, paymentMethod, totalAmount, amountPaid, deliveryNotes } = req.body;

        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            await transaction.rollback();
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        const order = await customerOrderModel.findOne({
            where: {
                id: orderId,
                deliveryEmployeeId: deliveryEmployee.id,
                status: 'on_theway'
            },
            include: [{
                model: customerModel,
                as: 'customer'
            }]
        });

        if (!order) {
            await transaction.rollback();
            return res.status(404).json({
                message: 'Order not found, not assigned to you, or not in progress'
            });
        }

        const debtAmount = totalAmount - amountPaid;

        // Update customer account balance if needed
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
            const actualTime = Math.round((endTime - deliveryHistory.startTime) / 60000);

            await deliveryHistory.update({
                endTime: endTime,
                actualTime: actualTime,
                paymentMethod: paymentMethod,
                amountPaid: amountPaid,
                debtAmount: debtAmount,
                deliveryNotes: deliveryNotes,
                status: 'completed'
            }, { transaction });
        }

        // SUBTRACT product quantities ONLY for successful deliveries
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
                status: 'Shipped',
                paymentMethod: paymentMethod,
                totalAmount: totalAmount,
                amountPaid: amountPaid,
                debtAmount: debtAmount,
                customerNewBalance: paymentMethod !== 'cash' ?
                    order.customer.accountBalance + debtAmount :
                    order.customer.accountBalance,
                note: 'Product quantities have been deducted from inventory'
            }
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error completing delivery:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get all current deliveries
export const getCurrentDeliveries = async (req, res) => {
    try {
        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        const currentOrders = await customerOrderModel.findAll({
            where: {
                deliveryEmployeeId: deliveryEmployee.id,
                status: { [Op.in]: ['Assigned', 'on_theway'] }
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
            ],
            order: [['assignedAt', 'ASC']]
        });

        const currentDeliveries = await Promise.all(currentOrders.map(async (order) => {
            const deliveryHistory = await deliveryHistoryModel.findOne({
                where: {
                    orderId: order.id,
                    deliveryEmployeeId: deliveryEmployee.id,
                    endTime: null
                }
            });

            return {
                ...order.get({ plain: true }),
                deliveryInfo: {
                    assignedTime: deliveryHistory?.assignedTime,
                    startTime: deliveryHistory?.startTime,
                    estimatedTime: deliveryHistory?.estimatedTime,
                    elapsedTime: deliveryHistory?.startTime ?
                        Math.round((new Date() - deliveryHistory.startTime) / 60000) : 0,
                    status: order.status
                }
            };
        }));

        return res.status(200).json({
            totalActiveDeliveries: currentDeliveries.length,
            assignedCount: currentDeliveries.filter(d => d.status === 'Assigned').length,
            inProgressCount: currentDeliveries.filter(d => d.status === 'on_theway').length,
            currentDeliveries
        });
    } catch (error) {
        console.error('Error getting current deliveries:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get delivery history
export const getDeliveryHistory = async (req, res) => {
    try {
        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        const { error } = paginationSchema.validate(req.query);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const { startDate, endDate, page = 1, limit = 10 } = req.query;

        const whereConditions = {
            deliveryEmployeeId: deliveryEmployee.id,
            endTime: { [Op.not]: null }
        };

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

        const offset = (page - 1) * limit;

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

        // Get current active orders count
        const activeOrdersCount = await customerOrderModel.count({
            where: {
                deliveryEmployeeId: deliveryEmployee.id,
                status: { [Op.in]: ['Assigned', 'on_theway'] }
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
                    todayDeliveries: todayDeliveries,
                    activeOrdersCount: activeOrdersCount
                }
            }
        });
    } catch (error) {
        console.error('Error getting delivery employee profile:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// =================== LEGACY FUNCTIONS (for backward compatibility) ===================

// Get prepared orders (LEGACY)
export const getPreparedOrders = async (req, res) => {
    try {
        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        const preparedOrders = await customerOrderModel.findAll({
            where: {
                status: 'Prepared',
                deliveryEmployeeId: null
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
            ],
            order: [['createdAt', 'ASC']]
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

// Get current delivery (LEGACY)
export const getCurrentDelivery = async (req, res) => {
    try {
        const deliveryEmployee = await deliveryEmployeeModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!deliveryEmployee) {
            return res.status(403).json({ message: 'Access denied. User is not a delivery employee' });
        }

        const currentOrder = await customerOrderModel.findOne({
            where: {
                deliveryEmployeeId: deliveryEmployee.id,
                status: { [Op.in]: ['Assigned', 'on_theway'] }
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
            ],
            order: [['assignedAt', 'ASC']]
        });

        if (!currentOrder) {
            return res.status(200).json({
                message: 'No active delivery',
                currentDelivery: null
            });
        }

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
                    assignedTime: deliveryHistory?.assignedTime,
                    startTime: deliveryHistory?.startTime,
                    estimatedTime: deliveryHistory?.estimatedTime,
                    elapsedTime: deliveryHistory?.startTime ?
                        Math.round((new Date() - deliveryHistory.startTime) / 60000) : 0,
                    status: currentOrder.status
                }
            }
        });
    } catch (error) {
        console.error('Error getting current delivery:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get all delivery employees
export const getAllDeliveryEmployees = async (req, res) => {
    try {
        const deliveryEmployees = await deliveryEmployeeModel.findAll({
            include: [
                {
                    model: userModel,
                    as: 'user',
                    attributes: ['userId', 'name', 'email', 'phoneNumber']
                }
            ],
            attributes: [
                'id',
                'userId',
                'isAvailable',
                'currentLatitude',
                'currentLongitude',
                'lastLocationUpdate'
            ],
            order: [['id', 'ASC']]
        });

        return res.status(200).json({
            count: deliveryEmployees.length,
            deliveryEmployees
        });

    } catch (error) {
        console.error('Error getting delivery employees:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};