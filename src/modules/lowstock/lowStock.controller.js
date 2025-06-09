import { Op } from 'sequelize';
import productModel from '../../../DB/Models/product.model.js';
import supplierOrderModel from '../../../DB/Models/supplierOrder.model.js';
import supplierOrderItemModel from '../../../DB/Models/supplierOrderItem.model.js';
import supplierModel from '../../../DB/Models/supplier.model.js';
import userModel from '../../../DB/Models/user.model.js';
import productSupplierModel from '../../../DB/Models/productSupplier.model.js';
import categoryModel from '../../../DB/Models/category.model.js';
import sequelize from '../../../DB/Connection.js';

// Get all low-stock items with their last orders
export const getLowStockItems = async (req, res) => {
    try {
        const lowStockProducts = await productModel.findAll({
            where: {
                [Op.and]: [
                    sequelize.where(
                        sequelize.col('quantity'),
                        Op.lte,
                        sequelize.col('lowStock')
                    ),
                    { status: 'Active' }
                ]
            },
            include: [
                {
                    model: categoryModel,
                    as: 'category',
                    attributes: ['categoryID', 'categoryName']
                },
                {
                    model: supplierModel,
                    as: 'suppliers',
                    attributes: ['id'],
                    through: {
                        attributes: ['status']
                    },
                    required: false,
                    include: [
                        {
                            model: userModel,
                            as: 'user',
                            attributes: ['name', 'isActive'],
                            required: false
                        }
                    ]
                }
            ]
        });

        const simpleAnalysis = lowStockProducts.map(product => {
            const activeSuppliers = product.suppliers?.filter(s =>
                s.ProductSupplier?.status === 'Active' && s.user?.isActive === 'Active'
            ).length || 0;

            return {
                productId: product.productId,
                name: product.name,
                quantity: product.quantity,
                lowStock: product.lowStock,
                category: product.category?.categoryName || 'No category',
                alertLevel: product.quantity === 0 ? 'CRITICAL' :
                    product.quantity <= Math.floor(product.lowStock * 0.5) ? 'HIGH' : 'MEDIUM',
                hasActiveSuppliers: activeSuppliers > 0,
                activeSupplierCount: activeSuppliers,
                stockDeficit: Math.max(0, product.lowStock - product.quantity + 1)
            };
        });

        return res.status(200).json({
            success: true,
            message: `Found ${lowStockProducts.length} low stock items`,
            data: simpleAnalysis,
            count: lowStockProducts.length
        });

    } catch (error) {
        console.error('Error in simple low stock analysis:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
        });
    }
};

// Generate orders for specific low-stock items (grouped by supplier)
export const generateLowStockOrders = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { selectedProductIds = [], selectAll = false } = req.body;

        // Build where condition based on selection
        let productWhereCondition = {
            [Op.and]: [
                sequelize.where(
                    sequelize.col('quantity'),
                    Op.lte,
                    sequelize.col('lowStock')
                ),
                { status: 'Active' }
            ]
        };

        // If specific products selected and not selecting all
        if (!selectAll && selectedProductIds.length > 0) {
            productWhereCondition[Op.and].push({
                productId: { [Op.in]: selectedProductIds }
            });
        }

        // Find low-stock products with all suppliers (Active + NotActive)
        const lowStockProducts = await productModel.findAll({
            where: productWhereCondition,
            include: [
                {
                    model: supplierModel,
                    as: 'suppliers',
                    attributes: ['id', 'userId'],
                    through: {
                        attributes: ['priceSupplier', 'status'] // Include status
                        // Removed where condition to get ALL suppliers
                    },
                    include: [
                        {
                            model: userModel,
                            as: 'user',
                            attributes: ['userId', 'name', 'email', 'phoneNumber', 'isActive'],
                            where: { isActive: 'Active' } // Only active users
                        }
                    ]
                }
            ]
        });

        if (lowStockProducts.length === 0) {
            await transaction.rollback();
            return res.status(200).json({
                message: selectAll ? 'No low stock items found' : 'No matching low stock items found for selected products',
                generatedOrders: [],
                count: 0
            });
        }

        // Group products by supplier
        const supplierProductsMap = new Map();

        for (const product of lowStockProducts) {
            // Get the most recent order for this product to determine preferred supplier and quantity
            const lastOrderItem = await supplierOrderItemModel.findOne({
                where: { productId: product.productId },
                include: [
                    {
                        model: supplierOrderModel,
                        as: 'order',
                        include: [
                            {
                                model: supplierModel,
                                as: 'supplier'
                            }
                        ]
                    }
                ],
                order: [['createdAt', 'DESC']]
            });

            // Determine preferred supplier (last ordered from, or first available)
            let preferredSupplier = null;
            let orderQuantity = Math.max(product.lowStock * 2, product.lowStock - product.quantity + 10); // Order enough to go above threshold

            if (lastOrderItem && product.suppliers.find(s => s.id === lastOrderItem.order.supplierId)) {
                // Use the supplier from the last order if they're still available
                preferredSupplier = product.suppliers.find(s => s.id === lastOrderItem.order.supplierId);
                // Use similar quantity as last order, but ensure it's enough to cover deficit
                orderQuantity = Math.max(lastOrderItem.quantity, orderQuantity);
            } else if (product.suppliers.length > 0) {
                // Use the first available supplier
                preferredSupplier = product.suppliers[0];
            }

            if (preferredSupplier) {
                const supplierId = preferredSupplier.id;

                if (!supplierProductsMap.has(supplierId)) {
                    supplierProductsMap.set(supplierId, {
                        supplier: preferredSupplier,
                        products: []
                    });
                }

                // Get the supplier-specific price
                const supplierPrice = preferredSupplier.ProductSupplier?.priceSupplier || product.costPrice;

                supplierProductsMap.get(supplierId).products.push({
                    productId: product.productId,
                    name: product.name,
                    currentQuantity: product.quantity,
                    lowStockThreshold: product.lowStock,
                    orderQuantity: orderQuantity,
                    costPrice: supplierPrice,
                    lastOrderQuantity: lastOrderItem ? lastOrderItem.quantity : null,
                    lastOrderDate: lastOrderItem ? lastOrderItem.createdAt : null
                });
            }
        }

        // Create draft orders for each supplier
        const generatedOrders = [];

        for (const [supplierId, supplierData] of supplierProductsMap.entries()) {
            let totalCost = 0;
            const orderItems = [];

            for (const productData of supplierData.products) {
                const subtotal = productData.costPrice * productData.orderQuantity;
                totalCost += subtotal;

                orderItems.push({
                    productId: productData.productId,
                    quantity: productData.orderQuantity,
                    costPrice: productData.costPrice,
                    originalCostPrice: productData.costPrice, // Store as original for reference
                    subtotal: subtotal,
                    status: null // Will be set when supplier responds
                });
            }

            // Create the order directly as Pending (sent to supplier)
            const newOrder = await supplierOrderModel.create({
                supplierId: supplierId,
                totalCost: totalCost,
                status: 'Pending', // Direct to Pending - no draft stage
                isAutoGenerated: true,
                note: `Auto-generated order for low stock items. Generated on ${new Date().toISOString()}. Sent directly to supplier.`
            }, { transaction });

            // Create order items
            for (const item of orderItems) {
                item.orderId = newOrder.id;
            }

            await supplierOrderItemModel.bulkCreate(orderItems, { transaction });

            // Get the created order with full details
            const createdOrder = await supplierOrderModel.findByPk(newOrder.id, {
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
                            attributes: ['productId', 'name', 'image', 'quantity', 'lowStock']
                        }]
                    }
                ],
                transaction
            });

            generatedOrders.push({
                order: createdOrder,
                lowStockProducts: supplierData.products
            });
        }

        await transaction.commit();

        return res.status(201).json({
            message: `Generated ${generatedOrders.length} orders for ${selectAll ? 'all' : 'selected'} low stock items and sent to suppliers`,
            generatedOrders: generatedOrders,
            count: generatedOrders.length,
            selectedItems: lowStockProducts.length,
            note: "Orders have been sent directly to suppliers"
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error generating low stock orders:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Generate order for a single low-stock item based on its last order
export const generateOrderForSingleItem = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { productId } = req.params;
        const { quantity, supplierId, costPrice } = req.body; // Optional overrides

        // Find the product and verify it's low stock
        const product = await productModel.findOne({
            where: {
                productId: productId,
                status: 'Active'
            },
            include: [
                {
                    model: supplierModel,
                    as: 'suppliers',
                    attributes: ['id', 'userId'],
                    through: {
                        attributes: ['priceSupplier', 'status'] // Include status
                        // Removed where condition to get ALL suppliers
                    },
                    include: [
                        {
                            model: userModel,
                            as: 'user',
                            attributes: ['userId', 'name', 'email', 'phoneNumber', 'isActive'],
                            where: { isActive: 'Active' } // Only active users
                        }
                    ]
                }
            ]
        });

        if (!product) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Product not found or inactive' });
        }

        // Check if product is actually low stock (optional check)
        const isLowStock = product.quantity <= product.lowStock;

        // Get the most recent order for this product
        const lastOrderItem = await supplierOrderItemModel.findOne({
            where: { productId: productId },
            include: [
                {
                    model: supplierOrderModel,
                    as: 'order',
                    include: [
                        {
                            model: supplierModel,
                            as: 'supplier',
                            include: [
                                {
                                    model: userModel,
                                    as: 'user',
                                    attributes: ['userId', 'name', 'email']
                                }
                            ]
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Determine supplier (priority: provided supplierId > last order supplier > first available)
        let selectedSupplier = null;
        let orderQuantity = quantity || Math.max(product.lowStock * 2, product.lowStock - product.quantity + 10);
        let orderCostPrice = costPrice;

        if (supplierId) {
            // Use provided supplier
            selectedSupplier = product.suppliers.find(s => s.id === parseInt(supplierId));
            if (!selectedSupplier) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Specified supplier not found for this product' });
            }
        } else if (lastOrderItem && product.suppliers.find(s => s.id === lastOrderItem.order.supplierId)) {
            // Use supplier from last order
            selectedSupplier = product.suppliers.find(s => s.id === lastOrderItem.order.supplierId);
            if (!quantity) {
                orderQuantity = Math.max(lastOrderItem.quantity, orderQuantity);
            }
        } else if (product.suppliers.length > 0) {
            // Use first available supplier
            selectedSupplier = product.suppliers[0];
        }

        if (!selectedSupplier) {
            await transaction.rollback();
            return res.status(400).json({ message: 'No active suppliers found for this product' });
        }

        // Determine cost price
        if (!orderCostPrice) {
            orderCostPrice = selectedSupplier.ProductSupplier?.priceSupplier || product.costPrice;
        }

        const totalCost = orderQuantity * orderCostPrice;

        // Create the order directly as Pending (sent to supplier)
        const newOrder = await supplierOrderModel.create({
            supplierId: selectedSupplier.id,
            totalCost: totalCost,
            status: 'Pending', // Direct to Pending - no draft stage
            isAutoGenerated: true,
            note: `Single item order for ${product.name}. Generated on ${new Date().toISOString()}. ${lastOrderItem ? `Based on last order from ${lastOrderItem.createdAt}` : 'No previous order history'}. Sent directly to supplier.`
        }, { transaction });

        // Create order item
        await supplierOrderItemModel.create({
            orderId: newOrder.id,
            productId: product.productId,
            quantity: orderQuantity,
            costPrice: orderCostPrice,
            originalCostPrice: orderCostPrice,
            subtotal: totalCost,
            status: null
        }, { transaction });

        await transaction.commit();

        // Get the created order with full details
        const createdOrder = await supplierOrderModel.findByPk(newOrder.id, {
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
                        attributes: ['productId', 'name', 'image', 'quantity', 'lowStock']
                    }]
                }
            ]
        });

        return res.status(201).json({
            message: 'Order created successfully and sent to supplier',
            order: createdOrder,
            isLowStock: isLowStock,
            lastOrderReference: lastOrderItem ? {
                orderId: lastOrderItem.order.id,
                orderDate: lastOrderItem.order.createdAt,
                previousQuantity: lastOrderItem.quantity,
                previousCostPrice: lastOrderItem.costPrice,
                previousSupplier: lastOrderItem.order.supplier.user.name
            } : null,
            note: "Order has been sent directly to supplier"
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error generating single item order:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get detailed information for a specific low-stock item
export const getLowStockItemDetails = async (req, res) => {
    try {
        const { productId } = req.params;

        // Find the product with full details
        const product = await productModel.findOne({
            where: {
                productId: productId,
                status: 'Active'
            },
            include: [
                {
                    model: categoryModel,
                    as: 'category',
                    attributes: ['categoryID', 'categoryName']
                },
                {
                    model: supplierModel,
                    as: 'suppliers',
                    attributes: ['id', 'userId', 'accountBalance'],
                    through: {
                        attributes: ['priceSupplier', 'status'] // Include status
                        // Removed where condition to get ALL suppliers
                    },
                    include: [
                        {
                            model: userModel,
                            as: 'user',
                            attributes: ['userId', 'name', 'email', 'phoneNumber', 'isActive'],
                            where: { isActive: 'Active' } // Only active users
                        }
                    ]
                }
            ]
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found or inactive' });
        }

        // Get last 3 orders for this product
        const recentOrders = await supplierOrderItemModel.findAll({
            where: { productId: productId },
            include: [
                {
                    model: supplierOrderModel,
                    as: 'order',
                    include: [
                        {
                            model: supplierModel,
                            as: 'supplier',
                            include: [
                                {
                                    model: userModel,
                                    as: 'user',
                                    attributes: ['userId', 'name', 'email']
                                }
                            ]
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: 3
        });

        // Check if there are any pending draft orders for this product
        const pendingDraftOrders = await supplierOrderItemModel.findAll({
            where: { productId: productId },
            include: [
                {
                    model: supplierOrderModel,
                    as: 'order',
                    where: { status: 'Draft' },
                    include: [
                        {
                            model: supplierModel,
                            as: 'supplier',
                            include: [
                                {
                                    model: userModel,
                                    as: 'user',
                                    attributes: ['userId', 'name']
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        const isLowStock = product.quantity <= product.lowStock;
        const stockDeficit = Math.max(0, product.lowStock - product.quantity + 1);
        const alertLevel = product.quantity === 0 ? 'CRITICAL' :
            product.quantity <= Math.floor(product.lowStock * 0.5) ? 'HIGH' : 'MEDIUM';

        // Calculate suggested order quantity based on last order
        const lastOrder = recentOrders[0];
        const suggestedQuantity = lastOrder ?
            Math.max(lastOrder.quantity, stockDeficit) :
            Math.max(product.lowStock * 2, stockDeficit);

        return res.status(200).json({
            message: 'Product details retrieved successfully',
            product: {
                productId: product.productId,
                name: product.name,
                quantity: product.quantity,
                lowStock: product.lowStock,
                costPrice: product.costPrice,
                sellPrice: product.sellPrice,
                image: product.image,
                category: product.category,
                suppliers: product.suppliers
            },
            stockStatus: {
                isLowStock: isLowStock,
                stockDeficit: stockDeficit,
                alertLevel: alertLevel,
                suggestedOrderQuantity: suggestedQuantity
            },
            orderHistory: recentOrders.map(orderItem => ({
                orderId: orderItem.order.id,
                orderDate: orderItem.order.createdAt,
                quantity: orderItem.quantity,
                costPrice: orderItem.costPrice,
                status: orderItem.order.status,
                supplier: {
                    id: orderItem.order.supplier.id,
                    name: orderItem.order.supplier.user.name,
                    email: orderItem.order.supplier.user.email
                }
            })),
            pendingDraftOrders: pendingDraftOrders.map(orderItem => ({
                orderId: orderItem.order.id,
                createdDate: orderItem.order.createdAt,
                quantity: orderItem.quantity,
                costPrice: orderItem.costPrice,
                supplier: {
                    id: orderItem.order.supplier.id,
                    name: orderItem.order.supplier.user.name
                }
            })),
            recommendations: {
                preferredSupplier: lastOrder ? {
                    id: lastOrder.order.supplier.id,
                    name: lastOrder.order.supplier.user.name,
                    lastOrderQuantity: lastOrder.quantity,
                    lastOrderCostPrice: lastOrder.costPrice
                } : null,
                suggestedQuantity: suggestedQuantity,
                estimatedCost: product.suppliers.length > 0 ?
                    (product.suppliers[0].ProductSupplier?.priceSupplier || product.costPrice) * suggestedQuantity :
                    product.costPrice * suggestedQuantity
            }
        });

    } catch (error) {
        console.error('Error getting low stock item details:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Check for low stock and generate alerts (basic function for system use)
export const checkLowStockAlerts = async () => {
    try {
        const lowStockProducts = await productModel.findAll({
            where: {
                [Op.and]: [
                    sequelize.where(
                        sequelize.col('quantity'),
                        Op.lte,
                        sequelize.col('lowStock')
                    ),
                    { status: 'Active' }
                ]
            },
            attributes: ['productId', 'name', 'quantity', 'lowStock']
        });

        if (lowStockProducts.length > 0) {
            console.log(`🚨 LOW STOCK ALERT: ${lowStockProducts.length} products are below their low stock threshold:`);
            lowStockProducts.forEach(product => {
                console.log(`   - ${product.name}: ${product.quantity}/${product.lowStock} remaining`);
            });

            return {
                alertCount: lowStockProducts.length,
                products: lowStockProducts
            };
        }

        return { alertCount: 0, products: [] };
    } catch (error) {
        console.error('Error checking low stock alerts:', error);
        return { error: 'Failed to check low stock alerts' };
    }
};