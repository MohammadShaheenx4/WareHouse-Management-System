import productBatchModel from '../../DB/Models/productPatch.model.js';
import productModel from '../../DB/Models/product.model.js';
import { Op } from 'sequelize';

/**
 * Enhanced Batch Management Utility
 * Handles comprehensive product batch tracking with production and expiry dates
 */

/**
 * Auto-generate batch number
 * @param {number} productId - Product ID
 * @param {Date} prodDate - Production date
 * @returns {string} - Generated batch number
 */
export const generateBatchNumber = async (productId, prodDate = null) => {
    try {
        const date = prodDate ? new Date(prodDate) : new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD format

        // Count existing batches for this product on this date to ensure uniqueness
        const existingCount = await productBatchModel.count({
            where: {
                productId,
                batchNumber: {
                    [Op.like]: `P${productId}-${dateStr}-%`
                }
            }
        });

        const sequence = String(existingCount + 1).padStart(3, '0'); // 001, 002, etc.
        return `P${productId}-${dateStr}-${sequence}`;

    } catch (error) {
        console.error('Error generating batch number:', error);
        // Fallback to simple timestamp-based number
        const timestamp = Date.now();
        return `P${productId}-${timestamp}`;
    }
};

/**
 * Check if there are existing batches with different dates for a product
 * @param {number} productId - Product ID
 * @param {Date} newProdDate - New production date
 * @param {Date} newExpDate - New expiry date
 * @returns {Object} - Alert information and existing batches
 */
export const checkExistingBatches = async (productId, newProdDate, newExpDate) => {
    try {
        const existingBatches = await productBatchModel.findAll({
            where: {
                productId,
                quantity: { [Op.gt]: 0 }, // Only active batches with remaining quantity
                status: 'Active'
            },
            order: [['prodDate', 'ASC'], ['receivedDate', 'ASC']]
        });

        if (existingBatches.length === 0) {
            return {
                hasAlert: false,
                alertMessage: null,
                existingBatches: []
            };
        }

        // Check if any existing batch has different dates
        const hasDateConflicts = existingBatches.some(batch => {
            const batchProdDate = batch.prodDate ? new Date(batch.prodDate).toDateString() : null;
            const batchExpDate = batch.expDate ? new Date(batch.expDate).toDateString() : null;
            const newProdDateStr = newProdDate ? new Date(newProdDate).toDateString() : null;
            const newExpDateStr = newExpDate ? new Date(newExpDate).toDateString() : null;

            return batchProdDate !== newProdDateStr || batchExpDate !== newExpDateStr;
        });

        if (hasDateConflicts) {
            const dateInfo = existingBatches.map(batch => ({
                batchId: batch.id,
                quantity: batch.quantity,
                prodDate: batch.prodDate,
                expDate: batch.expDate,
                receivedDate: batch.receivedDate,
                batchNumber: batch.batchNumber
            }));

            return {
                hasAlert: true,
                alertMessage: "⚠️ ALERT: This product already has existing stock with different production/expiry dates. Please verify batch management.",
                alertType: "DATE_CONFLICT",
                existingBatches: dateInfo,
                newDates: {
                    prodDate: newProdDate,
                    expDate: newExpDate
                }
            };
        }

        return {
            hasAlert: false,
            alertMessage: null,
            existingBatches: existingBatches.map(batch => ({
                batchId: batch.id,
                quantity: batch.quantity,
                prodDate: batch.prodDate,
                expDate: batch.expDate,
                receivedDate: batch.receivedDate,
                batchNumber: batch.batchNumber
            }))
        };
    } catch (error) {
        console.error('Error checking existing batches:', error);
        return {
            hasAlert: false,
            alertMessage: null,
            existingBatches: []
        };
    }
};

/**
 * Create a new product batch
 * @param {Object} batchData - Batch information
 * @param {Object} transaction - Database transaction
 * @returns {Object} - Created batch
 */
export const createProductBatch = async (batchData, transaction = null) => {
    const {
        productId,
        quantity,
        prodDate,
        expDate,
        supplierId,
        supplierOrderId,
        costPrice,
        batchNumber,
        notes
    } = batchData;

    try {
        const batch = await productBatchModel.create({
            productId,
            quantity,
            originalQuantity: quantity,
            prodDate: prodDate || null,
            expDate: expDate || null,
            supplierId,
            supplierOrderId,
            costPrice,
            batchNumber: batchNumber || null,
            notes: notes || null,
            receivedDate: new Date(),
            status: 'Active'
        }, { transaction });

        return batch;
    } catch (error) {
        console.error('Error creating product batch:', error);
        throw error;
    }
};

/**
 * Get FIFO allocation for order preparation
 * @param {number} productId - Product ID
 * @param {number} requiredQuantity - Required quantity for order
 * @returns {Object} - FIFO allocation details and alerts
 */
export const getFIFOAllocation = async (productId, requiredQuantity) => {
    try {
        // Get all active batches for this product ordered by FIFO logic
        const batches = await productBatchModel.findAll({
            where: {
                productId,
                quantity: { [Op.gt]: 0 },
                status: 'Active'
            },
            order: [
                ['prodDate', 'ASC'], // Oldest production date first
                ['receivedDate', 'ASC'], // Then oldest received date
                ['id', 'ASC'] // Finally by ID for consistency
            ]
        });

        if (batches.length === 0) {
            return {
                canFulfill: false,
                totalAvailable: 0,
                requiredQuantity,
                allocation: [],
                alerts: [{
                    type: 'NO_STOCK',
                    message: '❌ ERROR: No stock available for this product.'
                }]
            };
        }

        // Check if we have multiple batches with different dates
        const hasMultipleBatches = batches.length > 1;
        const hasMultipleDates = batches.some((batch, index) => {
            if (index === 0) return false;
            const prevBatch = batches[index - 1];
            const batchProdDate = batch.prodDate ? new Date(batch.prodDate).toDateString() : null;
            const prevProdDate = prevBatch.prodDate ? new Date(prevBatch.prodDate).toDateString() : null;
            const batchExpDate = batch.expDate ? new Date(batch.expDate).toDateString() : null;
            const prevExpDate = prevBatch.expDate ? new Date(prevBatch.expDate).toDateString() : null;

            return batchProdDate !== prevProdDate || batchExpDate !== prevExpDate;
        });

        // Calculate total available quantity
        const totalAvailable = batches.reduce((sum, batch) => sum + batch.quantity, 0);

        if (totalAvailable < requiredQuantity) {
            return {
                canFulfill: false,
                totalAvailable,
                requiredQuantity,
                allocation: [],
                alerts: [{
                    type: 'INSUFFICIENT_STOCK',
                    message: `❌ ERROR: Insufficient stock. Required: ${requiredQuantity}, Available: ${totalAvailable}`
                }]
            };
        }

        // Create FIFO allocation
        const allocation = [];
        let remainingQuantity = requiredQuantity;
        const alerts = [];

        for (const batch of batches) {
            if (remainingQuantity <= 0) break;

            const allocateFromThisBatch = Math.min(batch.quantity, remainingQuantity);

            allocation.push({
                batchId: batch.id,
                quantity: allocateFromThisBatch,
                prodDate: batch.prodDate,
                expDate: batch.expDate,
                receivedDate: batch.receivedDate,
                batchNumber: batch.batchNumber,
                remainingInBatch: batch.quantity - allocateFromThisBatch,
                costPrice: batch.costPrice,
                supplierId: batch.supplierId
            });

            remainingQuantity -= allocateFromThisBatch;
        }

        // Generate alerts for multiple batches
        if (hasMultipleBatches && hasMultipleDates) {
            alerts.push({
                type: 'MULTIPLE_BATCHES',
                message: `⚠️ FIFO ALERT: This product has multiple batches with different dates. Please prepare using FIFO (First In, First Out) method.`,
                severity: 'warning',
                batchDetails: allocation.map((alloc, index) => ({
                    priority: index + 1,
                    quantity: alloc.quantity,
                    prodDate: alloc.prodDate,
                    expDate: alloc.expDate,
                    batchNumber: alloc.batchNumber || `Batch #${alloc.batchId}`
                }))
            });
        }

        // Check for near-expiry items
        const today = new Date();
        const nearExpiryAlerts = allocation.filter(alloc => {
            if (!alloc.expDate) return false;
            const daysUntilExpiry = Math.ceil((new Date(alloc.expDate) - today) / (1000 * 60 * 60 * 24));
            return daysUntilExpiry <= 30 && daysUntilExpiry > 0; // Alert if expiring within 30 days
        });

        if (nearExpiryAlerts.length > 0) {
            alerts.push({
                type: 'NEAR_EXPIRY',
                message: `⚠️ EXPIRY ALERT: Some items are near expiry. Please prioritize these in preparation.`,
                severity: 'warning',
                nearExpiryItems: nearExpiryAlerts.map(alloc => ({
                    quantity: alloc.quantity,
                    expDate: alloc.expDate,
                    daysUntilExpiry: Math.ceil((new Date(alloc.expDate) - today) / (1000 * 60 * 60 * 24)),
                    batchNumber: alloc.batchNumber || `Batch #${alloc.batchId}`
                }))
            });
        }

        // Check for already expired items (should not happen with proper filtering, but safety check)
        const expiredItems = allocation.filter(alloc => {
            if (!alloc.expDate) return false;
            return new Date(alloc.expDate) <= today;
        });

        if (expiredItems.length > 0) {
            alerts.push({
                type: 'EXPIRED_STOCK',
                message: `❌ CRITICAL: Some items have already expired. Please check batch status.`,
                severity: 'critical',
                expiredItems: expiredItems.map(alloc => ({
                    quantity: alloc.quantity,
                    expDate: alloc.expDate,
                    batchNumber: alloc.batchNumber || `Batch #${alloc.batchId}`
                }))
            });
        }

        return {
            canFulfill: true,
            totalAvailable,
            requiredQuantity,
            allocation,
            alerts,
            fifoRecommendation: hasMultipleBatches ? "Use oldest stock first (FIFO method)" : "Single batch available",
            batchSummary: {
                totalBatches: batches.length,
                batchesUsed: allocation.length,
                hasMultipleDates: hasMultipleDates,
                oldestBatch: batches[0] ? {
                    prodDate: batches[0].prodDate,
                    expDate: batches[0].expDate,
                    batchNumber: batches[0].batchNumber || `Batch #${batches[0].id}`
                } : null
            }
        };
    } catch (error) {
        console.error('Error getting FIFO allocation:', error);
        return {
            canFulfill: false,
            totalAvailable: 0,
            requiredQuantity,
            allocation: [],
            alerts: [{
                type: 'SYSTEM_ERROR',
                message: 'System error occurred while checking stock allocation.',
                severity: 'critical'
            }]
        };
    }
};

/**
 * Update batch quantities after order preparation
 * @param {Array} allocation - FIFO allocation array
 * @param {Object} transaction - Database transaction
 */
export const updateBatchQuantities = async (allocation, transaction = null) => {
    try {
        const updateSummary = [];

        for (const alloc of allocation) {
            const batch = await productBatchModel.findByPk(alloc.batchId);
            if (batch) {
                const originalQuantity = batch.quantity;
                const newQuantity = Math.max(0, batch.quantity - alloc.quantity);
                const newStatus = newQuantity <= 0 ? 'Depleted' : 'Active';

                await batch.update({
                    quantity: newQuantity,
                    status: newStatus
                }, { transaction });

                updateSummary.push({
                    batchId: alloc.batchId,
                    batchNumber: batch.batchNumber || `Batch #${batch.id}`,
                    originalQuantity,
                    deductedQuantity: alloc.quantity,
                    remainingQuantity: newQuantity,
                    status: newStatus,
                    prodDate: batch.prodDate,
                    expDate: batch.expDate
                });
            }
        }

        return updateSummary;
    } catch (error) {
        console.error('Error updating batch quantities:', error);
        throw error;
    }
};

/**
 * Get expiring batches (for proactive alerts)
 * @param {number} daysAhead - Days to look ahead for expiry
 * @returns {Array} - Expiring batches
 */
export const getExpiringBatches = async (daysAhead = 30) => {
    try {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + daysAhead);

        const expiringBatches = await productBatchModel.findAll({
            where: {
                expDate: {
                    [Op.lte]: futureDate,
                    [Op.gte]: today
                },
                quantity: { [Op.gt]: 0 },
                status: 'Active'
            },
            include: [{
                model: productModel,
                as: 'product',
                attributes: ['productId', 'name', 'image', 'sellPrice']
            }],
            order: [['expDate', 'ASC']]
        });

        return expiringBatches.map(batch => {
            const daysUntilExpiry = Math.ceil((new Date(batch.expDate) - today) / (1000 * 60 * 60 * 24));
            const urgencyLevel = daysUntilExpiry <= 7 ? 'critical' :
                daysUntilExpiry <= 14 ? 'high' : 'medium';

            return {
                batchId: batch.id,
                productId: batch.productId,
                productName: batch.product.name,
                quantity: batch.quantity,
                expDate: batch.expDate,
                daysUntilExpiry,
                urgencyLevel,
                estimatedValue: batch.quantity * (batch.costPrice || batch.product.sellPrice || 0),
                batchNumber: batch.batchNumber || `Batch #${batch.id}`,
                prodDate: batch.prodDate,
                supplierId: batch.supplierId
            };
        });
    } catch (error) {
        console.error('Error getting expiring batches:', error);
        return [];
    }
};

/**
 * Get low stock products with batch information
 * @param {number} threshold - Low stock threshold
 * @returns {Array} - Low stock products with batch details
 */
export const getLowStockWithBatches = async (threshold = 10) => {
    try {
        const lowStockProducts = await productModel.findAll({
            where: {
                [Op.or]: [
                    { quantity: { [Op.lt]: threshold } },
                    { quantity: { [Op.lt]: sequelize.col('lowStock') } }
                ],
                status: 'Active'
            },
            include: [{
                model: productBatchModel,
                as: 'batches',
                where: { status: 'Active', quantity: { [Op.gt]: 0 } },
                required: false,
                order: [['expDate', 'ASC']]
            }],
            order: [['quantity', 'ASC']]
        });

        return lowStockProducts.map(product => {
            const nearExpiryBatches = product.batches?.filter(batch => {
                if (!batch.expDate) return false;
                const daysUntilExpiry = Math.ceil((new Date(batch.expDate) - new Date()) / (1000 * 60 * 60 * 24));
                return daysUntilExpiry <= 30;
            }) || [];

            return {
                productId: product.productId,
                productName: product.name,
                currentQuantity: product.quantity,
                lowStockThreshold: product.lowStock,
                isLowStock: product.quantity < product.lowStock,
                isCriticallyLow: product.quantity <= (product.lowStock * 0.5),
                totalBatches: product.batches?.length || 0,
                nearExpiryBatches: nearExpiryBatches.length,
                batchDetails: product.batches?.map(batch => ({
                    batchId: batch.id,
                    quantity: batch.quantity,
                    expDate: batch.expDate,
                    daysUntilExpiry: batch.expDate ?
                        Math.ceil((new Date(batch.expDate) - new Date()) / (1000 * 60 * 60 * 24)) : null
                })) || []
            };
        });
    } catch (error) {
        console.error('Error getting low stock with batches:', error);
        return [];
    }
};

/**
 * Validate manual batch allocation
 * @param {number} productId - Product ID
 * @param {Array} batchAllocations - Manual allocations
 * @param {number} requiredQuantity - Total required quantity
 * @returns {Object} - Validation result
 */
export const validateManualAllocation = async (productId, batchAllocations, requiredQuantity) => {
    try {
        const errors = [];
        const warnings = [];

        // Check total quantity matches
        const totalAllocated = batchAllocations.reduce((sum, alloc) => sum + alloc.quantity, 0);
        if (totalAllocated !== requiredQuantity) {
            errors.push(`Total allocated quantity (${totalAllocated}) doesn't match required quantity (${requiredQuantity})`);
        }

        // Validate each batch
        for (const allocation of batchAllocations) {
            const batch = await productBatchModel.findByPk(allocation.batchId);

            if (!batch) {
                errors.push(`Batch ID ${allocation.batchId} not found`);
                continue;
            }

            if (batch.productId !== productId) {
                errors.push(`Batch ${allocation.batchId} belongs to different product`);
                continue;
            }

            if (batch.status !== 'Active') {
                errors.push(`Batch ${allocation.batchId} is not active (status: ${batch.status})`);
                continue;
            }

            if (batch.quantity < allocation.quantity) {
                errors.push(`Insufficient quantity in batch ${allocation.batchId}. Available: ${batch.quantity}, Required: ${allocation.quantity}`);
                continue;
            }

            // Check for expiry warnings
            if (batch.expDate) {
                const daysUntilExpiry = Math.ceil((new Date(batch.expDate) - new Date()) / (1000 * 60 * 60 * 24));
                if (daysUntilExpiry <= 0) {
                    errors.push(`Batch ${allocation.batchId} has expired`);
                } else if (daysUntilExpiry <= 7) {
                    warnings.push(`Batch ${allocation.batchId} expires in ${daysUntilExpiry} days`);
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            totalAllocated,
            requiredQuantity
        };
    } catch (error) {
        console.error('Error validating manual allocation:', error);
        return {
            isValid: false,
            errors: ['System error during validation'],
            warnings: [],
            totalAllocated: 0,
            requiredQuantity
        };
    }
};

/**
 * Get comprehensive batch report for a product
 * @param {number} productId - Product ID
 * @returns {Object} - Comprehensive batch information
 */
export const getProductBatchReport = async (productId) => {
    try {
        const product = await productModel.findByPk(productId, {
            include: [{
                model: productBatchModel,
                as: 'batches',
                order: [['expDate', 'ASC'], ['prodDate', 'ASC']]
            }]
        });

        if (!product) {
            return { error: 'Product not found' };
        }

        const activeBatches = product.batches.filter(b => b.status === 'Active' && b.quantity > 0);
        const expiredBatches = product.batches.filter(b => b.status === 'Expired');
        const depletedBatches = product.batches.filter(b => b.status === 'Depleted');

        const today = new Date();
        const expiringNext30Days = activeBatches.filter(b => {
            if (!b.expDate) return false;
            const daysUntilExpiry = Math.ceil((new Date(b.expDate) - today) / (1000 * 60 * 60 * 24));
            return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
        });

        return {
            productId: product.productId,
            productName: product.name,
            totalQuantity: product.quantity,
            lowStockThreshold: product.lowStock,
            batchSummary: {
                totalBatches: product.batches.length,
                activeBatches: activeBatches.length,
                expiredBatches: expiredBatches.length,
                depletedBatches: depletedBatches.length,
                expiringNext30Days: expiringNext30Days.length
            },
            batches: {
                active: activeBatches.map(b => ({
                    batchId: b.id,
                    quantity: b.quantity,
                    originalQuantity: b.originalQuantity,
                    prodDate: b.prodDate,
                    expDate: b.expDate,
                    daysUntilExpiry: b.expDate ?
                        Math.ceil((new Date(b.expDate) - today) / (1000 * 60 * 60 * 24)) : null,
                    batchNumber: b.batchNumber,
                    costPrice: b.costPrice,
                    receivedDate: b.receivedDate
                })),
                expiring: expiringNext30Days.map(b => ({
                    batchId: b.id,
                    quantity: b.quantity,
                    expDate: b.expDate,
                    daysUntilExpiry: Math.ceil((new Date(b.expDate) - today) / (1000 * 60 * 60 * 24)),
                    batchNumber: b.batchNumber
                }))
            }
        };
    } catch (error) {
        console.error('Error getting product batch report:', error);
        return { error: 'System error' };
    }
};