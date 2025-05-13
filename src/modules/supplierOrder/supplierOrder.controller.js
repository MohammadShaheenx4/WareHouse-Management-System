import supplierOrderModel from "../../../DB/Models/supplierOrder.model.js";
import supplierOrderItemModel from "../../../DB/Models/supplierOrderItem.model.js";
import supplierModel from "../../../DB/Models/supplier.model.js";
import productModel from "../../../DB/Models/product.model.js";
import userModel from "../../../DB/Models/user.model.js";
import productSupplierModel from "../../../DB/Models/productSupplier.model.js";
import { Op } from "sequelize";
import sequelize from "../../../DB/Connection.js";
import { createSupplierOrderSchema, updateOrderStatusSchema, validateOrderId, updateSupplierProductSchema } from "./supplierOrder.validation.js";
import categoryModel from "../../../DB/Models/category.model.js";

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

        // Get all product-supplier relationships for this supplier including status
        const productSuppliers = await productSupplierModel.findAll({
            where: { supplierId },
            attributes: ['productId', 'priceSupplier', 'status']
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

        // Create a map of productId to priceSupplier and status for easy lookup
        const supplierInfoMap = productSuppliers.reduce((map, item) => {
            map[item.productId] = {
                priceSupplier: item.priceSupplier,
                status: item.status
            };
            return map;
        }, {});

        // Get all products with category information
        const products = await productModel.findAll({
            where: {
                productId: { [Op.in]: productIds }
            },
            attributes: [
                'productId', 'name', 'costPrice', 'sellPrice',
                'quantity', 'image', 'description'
            ],
            include: [{
                model: categoryModel,
                as: 'category',
                attributes: ['categoryID', 'categoryName']
            }]
        });

        // Add priceSupplier and status from productSupplier table to each product
        const productsWithSupplierInfo = products.map(product => {
            const plainProduct = product.get({ plain: true });
            const supplierInfo = supplierInfoMap[product.productId] || { priceSupplier: null, status: null };

            return {
                ...plainProduct,
                priceSupplier: supplierInfo.priceSupplier,
                status: supplierInfo.status // Using status from productSupplier
            };
        });

        return res.status(200).json({
            message: 'Supplier products retrieved successfully',
            supplier: {
                id: supplier.id,
                name: supplier.user.name
            },
            products: productsWithSupplierInfo // Return all products with their statuses
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

        let { supplierId, supplierName, items, note } = req.body;

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

        // Get all product-supplier relationships in one query
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

        // Create productSupplier lookup map for faster access to priceSupplier
        const productSupplierMap = productSuppliers.reduce((map, ps) => {
            map[ps.productId] = ps;
            return map;
        }, {});

        // Get the products to have their details available
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
            const productSupplier = productSupplierMap[item.productId];

            // Determine the cost price to use (priority: item.costPrice > productSupplier.priceSupplier > product.costPrice)
            let costPrice;
            if (item.costPrice) {
                // Use the provided cost price if specified in the request
                costPrice = parseFloat(item.costPrice);
            } else if (productSupplier && productSupplier.priceSupplier) {
                // Use the supplier-specific price from productSupplier table
                costPrice = parseFloat(productSupplier.priceSupplier);
            } else {
                // Fall back to product's general cost price
                costPrice = parseFloat(product.costPrice) || 0;
            }

            const quantity = parseInt(item.quantity);
            const subtotal = costPrice * quantity;

            orderItems.push({
                productId: item.productId,
                quantity: quantity,
                costPrice: costPrice,
                originalCostPrice: costPrice, // Store as original for reference
                subtotal: subtotal,
                status: null // Initially null, will be set when supplier responds
            });

            totalCost += subtotal;
        }

        // Create the order
        const newOrder = await supplierOrderModel.create({
            supplierId,
            totalCost,
            status: 'Pending',
            note: note || null
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
                        attributes: ['userId', 'name', 'email', 'phoneNumber']
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

        // Get the order with all related data
        const order = await supplierOrderModel.findByPk(orderId, {
            include: [
                {
                    model: supplierOrderItemModel,
                    as: 'items',
                    include: [{
                        model: productModel,
                        as: 'product'
                    }]
                },
                {
                    model: supplierModel,
                    as: 'supplier'
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

        // Special logic for admin confirming a partially accepted order
        if (order.status === 'PartiallyAccepted' && status === 'Accepted') {
            // Recalculate total cost based only on accepted items
            let totalCost = 0;

            // Get fresh data for all items
            const orderItems = await supplierOrderItemModel.findAll({
                where: { orderId: order.id }
            });

            // Only include items marked as 'Accepted' in the total cost
            for (const orderItem of orderItems) {
                if (orderItem.status === 'Accepted') {
                    totalCost += parseFloat(orderItem.subtotal) || 0;
                }
            }

            // Admin is confirming they're okay with the partial order - just update status
            await order.update({
                status,
                totalCost, // Update with the correct total (excluding declined items)
                note: note || `Admin accepted partial order on ${new Date().toISOString().split('T')[0]}`
            }, { transaction });

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
                message: `Order status updated to ${status} successfully by admin (declined items remain excluded)`,
                order: updatedOrder
            });
        }

        // Normal order status flow checks
        if (order.status !== 'Pending' && order.status !== 'PartiallyAccepted' && status !== 'Delivered') {
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

        // New logic for handling partially accepted orders
        let orderStatus = status;
        let hasDeclinedItems = false;
        let totalCost = 0;

        // HANDLE SIMPLE ACCEPT: If status is Accepted and no items are provided, mark all items as accepted
        if (status === 'Accepted' && (!items || items.length === 0)) {
            // Update all order items to Accepted status
            for (const orderItem of order.items) {
                await orderItem.update({
                    status: 'Accepted'
                }, { transaction });

                // Add to total cost
                totalCost += parseFloat(orderItem.subtotal) || 0;
            }

            // Update order with new total cost
            await order.update({
                totalCost,
                status: 'Accepted',
                note: note || null
            }, { transaction });

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
                message: `Order status updated to Accepted successfully`,
                order: updatedOrder
            });
        }

        // Handle partial acceptance with specific item details
        if (items && items.length > 0) {
            // Create a mapping between productId and orderItem
            const productToOrderItemMap = {};
            for (const item of order.items) {
                productToOrderItemMap[item.productId] = item;
            }

            // Validate that all products belong to this order
            const orderProductIds = order.items.map(item => item.productId);
            const providedProductIds = items.map(item => item.id); // Using id as productId

            const invalidProductIds = providedProductIds.filter(id => !orderProductIds.includes(id));
            if (invalidProductIds.length > 0) {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'Some items do not belong to this order',
                    invalidItems: invalidProductIds
                });
            }

            // First pass: identify which items are explicitly declined
            for (const item of items) {
                if (item.status === 'Declined') {
                    hasDeclinedItems = true;
                }
            }

            // Process explicitly provided items
            const processedProductIds = new Set();

            for (const item of items) {
                const productId = item.id; // Using id as productId
                const orderItem = productToOrderItemMap[productId];
                processedProductIds.add(productId);

                if (!orderItem) {
                    continue; // Skip if order item not found
                }

                // Update item status
                await orderItem.update({
                    status: item.status
                }, { transaction });

                // If supplier is updating price, update both orderItem and productSupplier
                if (item.status === 'Accepted' && item.costPrice) {
                    // Get the corresponding productSupplier record
                    const productSupplier = await productSupplierModel.findOne({
                        where: {
                            productId: productId,
                            supplierId: order.supplierId
                        }
                    });

                    // Calculate new subtotal with the updated price
                    const newQuantity = item.quantity || orderItem.quantity;
                    const newCostPrice = parseFloat(item.costPrice);
                    const newSubtotal = newCostPrice * newQuantity;

                    // Update the order item with new price and subtotal
                    await orderItem.update({
                        costPrice: newCostPrice,
                        subtotal: newSubtotal
                    }, { transaction });

                    // Update the productSupplier record with the new price
                    if (productSupplier) {
                        await productSupplier.update({
                            priceSupplier: newCostPrice
                        }, { transaction });
                    }
                }

                // Update quantity if provided
                if (item.status === 'Accepted' && item.quantity && item.quantity !== orderItem.quantity) {
                    // Recalculate subtotal with new quantity
                    const currentCostPrice = item.costPrice || orderItem.costPrice;
                    const newSubtotal = parseFloat(currentCostPrice) * item.quantity;

                    await orderItem.update({
                        quantity: item.quantity,
                        subtotal: newSubtotal
                    }, { transaction });
                }

                // Update production and expiry dates if provided
                if (item.status === 'Accepted' && (item.prodDate || item.expDate)) {
                    const updateData = {};
                    if (item.prodDate) updateData.prodDate = item.prodDate;
                    if (item.expDate) updateData.expDate = item.expDate;

                    await orderItem.update(updateData, { transaction });
                }
            }

            // Automatically set all other items as Accepted if not explicitly mentioned
            for (const orderItem of order.items) {
                if (!processedProductIds.has(orderItem.productId)) {
                    // This item wasn't explicitly mentioned, so it's automatically Accepted
                    await orderItem.update({
                        status: 'Accepted'
                    }, { transaction });
                }
            }

            // Get all updated items to calculate the total cost correctly
            const updatedItems = await supplierOrderItemModel.findAll({
                where: { orderId: order.id }
            });

            // Calculate total cost based only on accepted items
            totalCost = 0;
            for (const item of updatedItems) {
                if (item.status === 'Accepted') {
                    totalCost += parseFloat(item.subtotal) || 0;
                }
            }

            // If any items were declined, change order status to 'PartiallyAccepted'
            if (hasDeclinedItems) {
                orderStatus = 'PartiallyAccepted';
            }

            // Update order with new status, totalCost, and note
            await order.update({
                status: orderStatus,
                totalCost: totalCost,
                note: note || null
            }, { transaction });
        }

        // If status is Delivered, update product quantities
        if (status === 'Delivered') {
            // Get fresh order items data
            const orderItems = await supplierOrderItemModel.findAll({
                where: { orderId: order.id },
                include: [{
                    model: productModel,
                    as: 'product'
                }]
            });

            for (const item of orderItems) {
                // Only update inventory for accepted items
                if (item.status === 'Accepted') {
                    const product = item.product;

                    if (product) {
                        // Update product quantity by adding the ordered quantity
                        const currentQuantity = parseFloat(product.quantity) || 0;
                        const itemQuantity = parseFloat(item.quantity) || 0;
                        const newQuantity = currentQuantity + itemQuantity;

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

        // Final verification of totalCost
        if ((updatedOrder.status === 'Accepted' || updatedOrder.status === 'PartiallyAccepted') &&
            (updatedOrder.totalCost === 0 || updatedOrder.totalCost === null)) {

            // Recalculate one more time
            let verifiedTotalCost = 0;
            for (const item of updatedOrder.items) {
                if (item.status === 'Accepted') {
                    verifiedTotalCost += parseFloat(item.subtotal) || 0;
                }
            }

            if (verifiedTotalCost > 0) {
                // Fix the total if it should not be zero
                await supplierOrderModel.update(
                    { totalCost: verifiedTotalCost },
                    { where: { id: orderId } }
                );

                updatedOrder.totalCost = verifiedTotalCost;
            }
        }

        return res.status(200).json({
            message: `Order status updated to ${updatedOrder.status} successfully`,
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
        // First check if user exists in request
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Find supplier ID for the authenticated user
        const supplier = await supplierModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!supplier) {
            return res.status(403).json({ message: 'Access denied. You are not a supplier' });
        }

        const supplierId = supplier.id;

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
//

/**
 * @desc    Update the price supplier sets for a product
 * @route   PATCH /api/suppliers/:supplierId/products/:productId/price
 * @access  Supplier (own products only)
 */

export const updateSupplierPrice = async (req, res) => {
    try {
        const { supplierId, productId } = req.params;

        // Validate request body
        const { error } = updateSupplierProductSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const { priceSupplier, status } = req.body;

        // Check if supplier exists
        const supplier = await supplierModel.findByPk(supplierId);
        if (!supplier) {
            return res.status(404).json({ message: 'Supplier not found' });
        }

        // Check if product exists
        const product = await productModel.findByPk(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Make sure the user is the supplier or an admin
        if (req.supplier && req.supplier.id !== parseInt(supplierId)) {
            return res.status(403).json({ message: 'Access denied. Suppliers can only update their own products' });
        }

        // Check if this product-supplier relationship exists
        const productSupplier = await productSupplierModel.findOne({
            where: {
                productId,
                supplierId
            }
        });

        if (!productSupplier) {
            return res.status(404).json({ message: 'This product is not associated with this supplier' });
        }

        // Create update object
        const updateData = { priceSupplier };

        // Add status to update data if provided
        if (status) {
            updateData.status = status;
        }

        // Update the price and status
        await productSupplier.update(updateData);

        // Get the updated record
        const updatedRecord = await productSupplierModel.findOne({
            where: {
                productId,
                supplierId
            },
            include: [
                {
                    model: productModel,
                    as: 'product',
                    attributes: ['productId', 'name', 'image']
                }
            ]
        });

        return res.status(200).json({
            message: 'Supplier product updated successfully',
            data: {
                id: updatedRecord.id,
                productId: updatedRecord.productId,
                supplierId: updatedRecord.supplierId,
                priceSupplier: updatedRecord.priceSupplier,
                status: updatedRecord.status,
                productName: updatedRecord.product ? updatedRecord.product.name : null,
                productImage: updatedRecord.product ? updatedRecord.product.image : null
            }
        });
    } catch (error) {
        console.error('Error updating supplier product:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};