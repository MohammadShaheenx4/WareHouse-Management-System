import supplierOrderModel from "../../../DB/Models/supplierOrder.model.js";
import supplierOrderItemModel from "../../../DB/Models/supplierOrderItem.model.js";
import supplierModel from "../../../DB/Models/supplier.model.js";
import productModel from "../../../DB/Models/product.model.js";
import userModel from "../../../DB/Models/user.model.js";
import productSupplierModel from "../../../DB/Models/productSupplier.model.js";
import { Op } from "sequelize";
import sequelize from "../../../DB/Connection.js";
import { createSupplierOrderSchema, updateOrderStatusSchema, validateOrderId } from "./supplierOrder.validation.js";

/**
 * @desc    Get products for a specific supplier (for order creation)
 * @route   GET /api/supplierOrders/supplier/:supplierId/products
 * @access  Admin
 */
export const getSupplierProducts = async (req, res) => {
    try {
        const { supplierId } = req.params;

        // Validate supplier ID
        if (!supplierId || isNaN(supplierId)) {
            return res.status(400).json({ message: 'Invalid supplier ID' });
        }

        // Check if supplier exists
        const supplier = await supplierModel.findByPk(supplierId, {
            include: [{
                model: userModel,
                as: 'user',
                attributes: ['userId', 'name']
            }]
        });

        if (!supplier) {
            return res.status(404).json({ message: 'Supplier not found' });
        }

        // Get all product IDs associated with this supplier
        const productSuppliers = await productSupplierModel.findAll({
            where: { supplierId },
            attributes: ['productId']
        });

        if (productSuppliers.length === 0) {
            return res.status(200).json({
                message: 'No products found for this supplier',
                supplier: {
                    id: supplier.id,
                    name: supplier.user.name
                },
                products: []
            });
        }

        const productIds = productSuppliers.map(ps => ps.productId);

        // Get all products
        const products = await productModel.findAll({
            where: {
                productId: { [Op.in]: productIds },
                status: 'Active'
            },
            attributes: [
                'productId', 'name', 'costPrice', 'sellPrice',
                'quantity', 'image', 'description'
            ]
        });

        return res.status(200).json({
            message: 'Supplier products retrieved successfully',
            supplier: {
                id: supplier.id,
                name: supplier.user.name
            },
            products
        });
    } catch (error) {
        console.error('Error fetching supplier products:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get all suppliers that provide a specific product
 * @route   GET /api/supplierOrders/product/:productId/suppliers
 * @access  Admin
 */
export const getProductSuppliers = async (req, res) => {
    try {
        const { productId } = req.params;

        // Validate product ID
        if (!productId || isNaN(productId)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }

        // Check if product exists
        const product = await productModel.findByPk(productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Get all supplier IDs associated with this product
        const productSuppliers = await productSupplierModel.findAll({
            where: { productId },
            attributes: ['supplierId']
        });

        if (productSuppliers.length === 0) {
            return res.status(200).json({
                message: 'No suppliers found for this product',
                product: {
                    id: product.productId,
                    name: product.name
                },
                suppliers: []
            });
        }

        const supplierIds = productSuppliers.map(ps => ps.supplierId);

        // Get all suppliers with user information
        const suppliers = await supplierModel.findAll({
            where: {
                id: { [Op.in]: supplierIds }
            },
            include: [{
                model: userModel,
                as: 'user',
                attributes: ['userId', 'name', 'email', 'phoneNumber']
            }],
            attributes: ['id', 'accountBalance']
        });

        return res.status(200).json({
            message: 'Product suppliers retrieved successfully',
            product: {
                id: product.productId,
                name: product.name
            },
            suppliers: suppliers.map(supplier => ({
                id: supplier.id,
                name: supplier.user.name,
                email: supplier.user.email,
                phone: supplier.user.phone
            }))
        });
    } catch (error) {
        console.error('Error fetching product suppliers:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Create a new order from supplier
 * @route   POST /api/supplierOrders
 * @access  Admin
 */
export const createSupplierOrder = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        // Validate request body
        const { error } = createSupplierOrderSchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({ message: error.details[0].message });
        }

        let { supplierId, supplierName, items } = req.body;

        // If supplierName is provided instead of supplierId, find the supplier
        if (!supplierId && supplierName) {
            const user = await userModel.findOne({
                where: { name: supplierName }
            });

            if (!user) {
                await transaction.rollback();
                return res.status(404).json({ message: `No user found with name: ${supplierName}` });
            }

            const supplier = await supplierModel.findOne({
                where: { userId: user.id }
            });

            if (!supplier) {
                await transaction.rollback();
                return res.status(404).json({ message: `No supplier found for user: ${supplierName}` });
            }

            supplierId = supplier.id;
        }

        // Verify the supplier exists
        const supplier = await supplierModel.findByPk(supplierId, {
            include: [{
                model: userModel,
                as: 'user',
                attributes: ['userId', 'name', 'isActive']
            }]
        });

        if (!supplier) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Supplier not found' });
        }

        // Check if the supplier's user account is active
        if (supplier.user.isActive !== 'Active') {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Cannot create order for inactive supplier account',
                supplierName: supplier.user.name
            });
        }

        // Verify this supplier provides all these products
        const productIds = items.map(item => item.productId);

        const productSuppliers = await productSupplierModel.findAll({
            where: {
                supplierId,
                productId: { [Op.in]: productIds }
            }
        });

        if (productSuppliers.length !== productIds.length) {
            // Find which products are not provided by this supplier
            const foundProductIds = productSuppliers.map(ps => ps.productId);
            const notFoundProductIds = productIds.filter(id => !foundProductIds.includes(id));

            // Get the names of the products not found
            const notFoundProducts = await productModel.findAll({
                where: { productId: { [Op.in]: notFoundProductIds } },
                attributes: ['productId', 'name']
            });

            await transaction.rollback();
            return res.status(400).json({
                message: 'Some products are not provided by this supplier',
                products: notFoundProducts.map(p => p.name)
            });
        }

        // Get the products to get their current cost prices
        const products = await productModel.findAll({
            where: { productId: { [Op.in]: productIds } }
        });

        // Create product lookup map for faster access
        const productMap = products.reduce((map, product) => {
            map[product.productId] = product;
            return map;
        }, {});

        // Calculate total cost and prepare order items
        let totalCost = 0;
        const orderItems = [];

        for (const item of items) {
            const product = productMap[item.productId];
            const costPrice = item.costPrice || product.costPrice;
            const subtotal = costPrice * item.quantity;

            orderItems.push({
                productId: item.productId,
                quantity: item.quantity,
                costPrice: costPrice,
                originalCostPrice: product.costPrice,
                subtotal: subtotal
            });

            totalCost += subtotal;
        }

        // Create the order
        const newOrder = await supplierOrderModel.create({
            supplierId,
            totalCost,
            status: 'Pending'
        }, { transaction });

        // Create order items
        for (const item of orderItems) {
            item.orderId = newOrder.id;
        }

        await supplierOrderItemModel.bulkCreate(orderItems, { transaction });

        // Commit the transaction
        await transaction.commit();

        // Get the created order with all details
        const createdOrder = await supplierOrderModel.findByPk(newOrder.id, {
            include: [
                {
                    model: supplierModel,
                    as: 'supplier',
                    attributes: ['id'],
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
        await transaction.rollback();
        console.error('Error creating supplier order:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
/**
 * @desc    Get all supplier orders
 * @route   GET /api/supplierOrders
 * @access  Admin
 */
export const getAllSupplierOrders = async (req, res) => {
    try {
        // Get query parameters for filtering
        const { status, supplierId, fromDate, toDate } = req.query;

        // Build filter object
        const filter = {};

        if (status) {
            filter.status = status;
        }

        if (supplierId) {
            filter.supplierId = supplierId;
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

        // Get orders with supplier and item information
        const orders = await supplierOrderModel.findAll({
            where: filter,
            include: [
                {
                    model: supplierModel,
                    as: 'supplier',
                    attributes: ['id'],
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
        console.error('Error fetching supplier orders:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get supplier order by ID
 * @route   GET /api/supplierOrders/:id
 * @access  Admin/Supplier
 */
export const getSupplierOrderById = async (req, res) => {
    try {
        // Validate ID parameter
        const { error } = validateOrderId.validate({ id: req.params.id });
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const orderId = req.params.id;

        // Get order with all details
        const order = await supplierOrderModel.findByPk(orderId, {
            include: [
                {
                    model: supplierModel,
                    as: 'supplier',
                    attributes: ['id'],
                    include: [{
                        model: userModel,
                        as: 'user',
                        attributes: ['id', 'name', 'email', 'phone']
                    }]
                },
                {
                    model: supplierOrderItemModel,
                    as: 'items',
                    include: [{
                        model: productModel,
                        as: 'product',
                        attributes: ['productId', 'name', 'image', 'description', 'costPrice', 'sellPrice']
                    }]
                }
            ]
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // If user is a supplier, check if the order belongs to them
        if (req.user && req.user.role === 'supplier') {
            // Assuming req.user.supplierId contains the supplier's ID
            if (order.supplierId !== req.user.supplierId) {
                return res.status(403).json({ message: 'Access denied. This order does not belong to you' });
            }
        }

        return res.status(200).json({
            message: 'Order retrieved successfully',
            order
        });
    } catch (error) {
        console.error('Error fetching supplier order:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Update supplier order status
 * @route   PUT /api/supplierOrders/:id/status
 * @access  Supplier
 */
export const updateSupplierOrderStatus = async (req, res) => {
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
        const { status, note, items } = req.body;

        // Get the order
        const order = await supplierOrderModel.findByPk(orderId, {
            include: [
                {
                    model: supplierOrderItemModel,
                    as: 'items'
                }
            ]
        });

        if (!order) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        // If user is a supplier, check if the order belongs to them
        if (req.user && req.user.role === 'supplier') {
            if (order.supplierId !== req.user.supplierId) {
                await transaction.rollback();
                return res.status(403).json({ message: 'Access denied. This order does not belong to you' });
            }
        }

        // Check if order can be updated
        if (order.status !== 'Pending' && status !== 'Delivered') {
            await transaction.rollback();
            return res.status(400).json({
                message: `Cannot update order with status ${order.status} to ${status}`
            });
        }

        if (status === 'Delivered' && order.status !== 'Accepted') {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Order must be Accepted before it can be marked as Delivered'
            });
        }

        // Update order status
        const updateData = { status };
        if (note) updateData.note = note;

        await order.update(updateData, { transaction });

        // If status is Accepted, update product cost prices if needed
        if (status === 'Accepted' && items && items.length > 0) {
            // Validate that all items belong to this order
            const orderItemIds = order.items.map(item => item.id);
            const providedItemIds = items.map(item => item.id);

            const invalidItemIds = providedItemIds.filter(id => !orderItemIds.includes(id));
            if (invalidItemIds.length > 0) {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'Some items do not belong to this order',
                    invalidItems: invalidItemIds
                });
            }

            // Create order item lookup for faster access
            const orderItemMap = order.items.reduce((map, item) => {
                map[item.id] = item;
                return map;
            }, {});

            // Process item updates
            let totalCost = 0;

            for (const item of items) {
                const orderItem = orderItemMap[item.id];

                // Update cost price if provided
                if (item.costPrice && item.costPrice !== orderItem.costPrice) {
                    await orderItem.update({
                        costPrice: item.costPrice,
                        subtotal: item.costPrice * (item.quantity || orderItem.quantity)
                    }, { transaction });
                }

                // Update quantity if provided
                if (item.quantity && item.quantity !== orderItem.quantity) {
                    await orderItem.update({
                        quantity: item.quantity,
                        subtotal: (item.costPrice || orderItem.costPrice) * item.quantity
                    }, { transaction });
                }

                // Recalculate subtotal for unchanged items
                if (!item.costPrice && !item.quantity) {
                    totalCost += orderItem.subtotal;
                } else {
                    // Use the updated values
                    const updatedItem = await supplierOrderItemModel.findByPk(item.id);
                    totalCost += updatedItem.subtotal;
                }
            }

            // Update order total cost
            await order.update({ totalCost }, { transaction });
        }

        // If status is Delivered, update product quantities
        if (status === 'Delivered') {
            for (const item of order.items) {
                const product = await productModel.findByPk(item.productId);

                if (product) {
                    // Update product quantity by adding the ordered quantity
                    await product.update({
                        quantity: product.quantity + item.quantity
                    }, { transaction });
                }
            }
        }

        // Commit the transaction
        await transaction.commit();

        // Get updated order with all details
        const updatedOrder = await supplierOrderModel.findByPk(orderId, {
            include: [
                {
                    model: supplierModel,
                    as: 'supplier',
                    attributes: ['id'],
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
        console.error('Error updating supplier order status:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get supplier's orders
 * @route   GET /api/supplierOrders/myOrders
 * @access  Supplier
 */
export const getMySupplierOrders = async (req, res) => {
    try {
        // Ensure user is a supplier
        if (!req.user || !req.user.supplierId) {
            return res.status(403).json({ message: 'Access denied. You are not a supplier' });
        }

        const supplierId = req.user.supplierId;

        // Get query parameters for filtering
        const { status, fromDate, toDate } = req.query;

        // Build filter object
        const filter = { supplierId };

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
        const orders = await supplierOrderModel.findAll({
            where: filter,
            include: [
                {
                    model: supplierOrderItemModel,
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
        console.error('Error fetching supplier orders:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};