import productBatchModel from '../../DB/Models/productPatch.model.js';
import productModel from '../../DB/Models/product.model.js';
import { Op } from 'sequelize';

/**
 * Batch Management Utility
 * Handles product batch tracking with production and expiry dates
 */

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
                quantity: batch.quantity,
                prodDate: batch.prodDate,
                expDate: batch.expDate,
                receivedDate: batch.receivedDate
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
                quantity: batch.quantity,
                prodDate: batch.prodDate,
                expDate: batch.expDate,
                receivedDate: batch.receivedDate
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
                remainingInBatch: batch.quantity - allocateFromThisBatch
            });

            remainingQuantity -= allocateFromThisBatch;
        }

        // Generate alerts for multiple batches
        if (hasMultipleBatches && hasMultipleDates) {
            alerts.push({
                type: 'MULTIPLE_BATCHES',
                message: `⚠️ FIFO ALERT: This product has multiple batches with different dates. Please prepare using FIFO (First In, First Out) method.`,
                batchDetails: allocation.map(alloc => ({
                    quantity: alloc.quantity,
                    prodDate: alloc.prodDate,
                    expDate: alloc.expDate,
                    priority: allocation.indexOf(alloc) + 1
                }))
            });
        }

        // Check for near-expiry items
        const nearExpiryAlerts = allocation.filter(alloc => {
            if (!alloc.expDate) return false;
            const daysUntilExpiry = Math.ceil((new Date(alloc.expDate) - new Date()) / (1000 * 60 * 60 * 24));
            return daysUntilExpiry <= 30; // Alert if expiring within 30 days
        });

        if (nearExpiryAlerts.length > 0) {
            alerts.push({
                type: 'NEAR_EXPIRY',
                message: `⚠️ EXPIRY ALERT: Some items are near expiry. Please prioritize these in preparation.`,
                nearExpiryItems: nearExpiryAlerts.map(alloc => ({
                    quantity: alloc.quantity,
                    expDate: alloc.expDate,
                    daysUntilExpiry: Math.ceil((new Date(alloc.expDate) - new Date()) / (1000 * 60 * 60 * 24))
                }))
            });
        }

        return {
            canFulfill: true,
            totalAvailable,
            requiredQuantity,
            allocation,
            alerts,
            fifoRecommendation: hasMultipleBatches ? "Use oldest stock first (FIFO method)" : "Single batch available"
        };
    } catch (error) {
        console.error('Error getting FIFO allocation:', error);
        return {
            canFulfill: false,
            allocation: [],
            alerts: [{
                type: 'SYSTEM_ERROR',
                message: 'System error occurred while checking stock allocation.'
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
        for (const alloc of allocation) {
            const batch = await productBatchModel.findByPk(alloc.batchId);
            if (batch) {
                const newQuantity = batch.quantity - alloc.quantity;
                await batch.update({
                    quantity: Math.max(0, newQuantity),
                    status: newQuantity <= 0 ? 'Depleted' : 'Active'
                }, { transaction });
            }
        }
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
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);

        const expiringBatches = await productBatchModel.findAll({
            where: {
                expDate: {
                    [Op.lte]: futureDate,
                    [Op.gte]: new Date()
                },
                quantity: { [Op.gt]: 0 },
                status: 'Active'
            },
            include: [{
                model: productModel,
                as: 'product',
                attributes: ['productId', 'name', 'image']
            }],
            order: [['expDate', 'ASC']]
        });

        return expiringBatches.map(batch => ({
            batchId: batch.id,
            productId: batch.productId,
            productName: batch.product.name,
            quantity: batch.quantity,
            expDate: batch.expDate,
            daysUntilExpiry: Math.ceil((new Date(batch.expDate) - new Date()) / (1000 * 60 * 60 * 24))
        }));
    } catch (error) {
        console.error('Error getting expiring batches:', error);
        return [];
    }
};