import Joi from "joi";

// Create order validation schema - Initial creation by customer
export const createOrderSchema = Joi.object({
    note: Joi.string().optional(),
    items: Joi.array().items(
        Joi.object({
            productId: Joi.number().integer().required(),
            quantity: Joi.number().integer().min(1).required()
        })
    ).min(1).required()
});

// UPDATED: Update order status validation schema with new statuses
export const updateOrderStatusSchema = Joi.object({
    status: Joi.string().valid(
        "Pending",
        "Accepted",
        "Rejected",
        "Preparing",
        "Prepared",
        "Assigned",
        "on_theway",
        "Shipped",
        "Cancelled"  // Add this
    ).required(),
    note: Joi.string().optional()
});

// NEW: Start preparation validation schema
export const startPreparationSchema = Joi.object({
    notes: Joi.string().max(500).optional()
        .messages({
            'string.max': 'Notes cannot exceed 500 characters'
        })
});

// NEW: Complete preparation validation schema - auto-detects method
export const completePreparationSchema = Joi.object({
    manualBatchAllocations: Joi.array().items(
        Joi.object({
            productId: Joi.number().integer().required()
                .messages({
                    'number.base': 'Product ID must be a number',
                    'number.integer': 'Product ID must be an integer',
                    'any.required': 'Product ID is required'
                }),
            batchAllocations: Joi.array().items(
                Joi.object({
                    batchId: Joi.number().integer().required()
                        .messages({
                            'number.base': 'Batch ID must be a number',
                            'number.integer': 'Batch ID must be an integer',
                            'any.required': 'Batch ID is required'
                        }),
                    quantity: Joi.number().integer().min(1).required()
                        .messages({
                            'number.base': 'Quantity must be a number',
                            'number.integer': 'Quantity must be an integer',
                            'number.min': 'Quantity must be at least 1',
                            'any.required': 'Quantity is required'
                        })
                })
            ).min(1).required()
                .messages({
                    'array.min': 'At least one batch allocation is required',
                    'any.required': 'Batch allocations are required'
                })
        })
    ).optional()
        .messages({
            'array.base': 'Manual batch allocations must be an array'
        }),
    notes: Joi.string().max(1000).optional()
        .messages({
            'string.max': 'Notes cannot exceed 1000 characters'
        })
});

// NEW: Batch allocation validation for API responses
export const batchAllocationSchema = Joi.object({
    batchId: Joi.number().integer().required(),
    quantity: Joi.number().integer().min(1).required(),
    prodDate: Joi.date().allow(null).optional(),
    expDate: Joi.date().allow(null).optional(),
    receivedDate: Joi.date().required(),
    batchNumber: Joi.string().allow(null).optional(),
    remainingInBatch: Joi.number().integer().min(0).required()
});

// Order ID validation schema
export const validateOrderId = Joi.object({
    id: Joi.number().integer().required()
});

// Get products by category validation schema
export const getCategoryProductsSchema = Joi.object({
    categoryId: Joi.number().integer().required()
});

// NEW: Validate warehouse employee access (for verification only)
export const warehouseEmployeeAccessSchema = Joi.object({
    userId: Joi.number().integer().required() // For cross-verification with token
});

// NEW: Product batch query validation
export const batchQuerySchema = Joi.object({
    productId: Joi.number().integer().required(),
    includeExpired: Joi.boolean().default(false),
    includeNearExpiry: Joi.boolean().default(true),
    sortBy: Joi.string().valid('prodDate', 'expDate', 'receivedDate', 'quantity').default('prodDate')
});

// NEW: FIFO allocation request validation
export const fifoAllocationSchema = Joi.object({
    productId: Joi.number().integer().required(),
    requiredQuantity: Joi.number().integer().min(1).required(),
    includeAlerts: Joi.boolean().default(true)
});

// NEW: Order preparation status validation
export const preparationStatusSchema = Joi.object({
    orderId: Joi.number().integer().required(),
    includePreparers: Joi.boolean().default(true),
    includeBatchInfo: Joi.boolean().default(false)
});

// UPDATED: Enhanced order filtering validation
export const orderFilterSchema = Joi.object({
    status: Joi.string().valid(
        "Pending",
        "Accepted",
        "Rejected",
        "Preparing",
        "Prepared",
        "Assigned",
        "on_theway",
        "Shipped"
    ).optional(),
    customerId: Joi.number().integer().optional(),
    fromDate: Joi.date().optional(),
    toDate: Joi.date().optional(),
    preparationMethod: Joi.string().valid('auto_fifo', 'manual_batches').optional(),
    hasMultipleBatches: Joi.boolean().optional(), // Filter orders that used multiple batches
    myPreparations: Joi.boolean().optional(), // NEW: Filter orders prepared by authenticated user
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
});

// NEW: Batch management validation schemas
export const createBatchSchema = Joi.object({
    productId: Joi.number().integer().required(),
    quantity: Joi.number().integer().min(1).required(),
    prodDate: Joi.date().allow(null).optional(),
    expDate: Joi.date().allow(null).optional(),
    supplierId: Joi.number().integer().allow(null).optional(),
    supplierOrderId: Joi.number().integer().allow(null).optional(),
    costPrice: Joi.number().positive().allow(null).optional(),
    notes: Joi.string().max(500).allow(null).optional()
    // batchNumber is auto-generated, not required in request
});

export const updateBatchSchema = Joi.object({
    quantity: Joi.number().integer().min(0).optional(),
    status: Joi.string().valid('Active', 'Expired', 'Depleted').optional(),
    notes: Joi.string().max(500).allow(null).optional()
});

// NEW: Expiry alert validation
export const expiryAlertSchema = Joi.object({
    daysAhead: Joi.number().integer().min(1).max(365).default(30),
    includeProductInfo: Joi.boolean().default(true),
    minQuantity: Joi.number().integer().min(0).default(0), // Only include batches with quantity >= this
    sortBy: Joi.string().valid('expDate', 'quantity', 'productName').default('expDate')
});

// NEW: Stock adjustment validation (for manual stock corrections)
export const stockAdjustmentSchema = Joi.object({
    productId: Joi.number().integer().required(),
    adjustmentType: Joi.string().valid('add', 'subtract', 'set').required(),
    quantity: Joi.number().integer().min(0).required(),
    reason: Joi.string().required().max(500),
    batchId: Joi.number().integer().optional(), // If adjusting specific batch
    createNewBatch: Joi.boolean().default(false), // If adding stock, whether to create new batch
    batchDetails: Joi.when('createNewBatch', {
        is: true,
        then: Joi.object({
            prodDate: Joi.date().allow(null).optional(),
            expDate: Joi.date().allow(null).optional(),
            supplierId: Joi.number().integer().allow(null).optional(),
            costPrice: Joi.number().positive().allow(null).optional()
            // batchNumber is auto-generated
        }).optional(),
        otherwise: Joi.forbidden()
    })
});

// Validation helper functions
export const validateBatchAvailability = (batchAllocations, requiredQuantity) => {
    const totalAllocated = batchAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
    return totalAllocated === requiredQuantity;
};

export const validatePreparationPermissions = (userRole, warehouseEmployeeId) => {
    // Add logic to verify user has permission to act as warehouse employee
    return userRole === 'warehouse' || userRole === 'admin';
};

// Export validation utility functions
export const validationUtils = {
    validateBatchAvailability,
    validatePreparationPermissions,

    // Date validation helpers
    isValidExpiryDate: (expDate, prodDate = null) => {
        if (!expDate) return true; // Expiry date is optional
        const expiry = new Date(expDate);
        const now = new Date();

        if (expiry <= now) return false; // Already expired

        if (prodDate) {
            const production = new Date(prodDate);
            if (expiry <= production) return false; // Expiry before production
        }

        return true;
    },

    // Quantity validation helpers
    isValidQuantityAllocation: (allocations, totalRequired) => {
        const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.quantity, 0);
        return totalAllocated === totalRequired;
    },

    // FIFO validation
    isValidFIFOOrder: (batches) => {
        for (let i = 1; i < batches.length; i++) {
            const prevDate = new Date(batches[i - 1].prodDate || batches[i - 1].receivedDate);
            const currDate = new Date(batches[i].prodDate || batches[i].receivedDate);
            if (currDate < prevDate) return false;
        }
        return true;
    }
};
export const cancelOrderSchema = Joi.object({
    reason: Joi.string().valid(
        'customer_request',
        'out_of_stock',
        'payment_issue',
        'address_issue',
        'customer_unavailable',
        'administrative_decision',
        'quality_issue',
        'delivery_emergency',  // New: For delivery employee emergency cancellations
        'vehicle_breakdown',   // New: For delivery employee vehicle issues
        'safety_concern',      // New: For delivery employee safety issues
        'other'
    ).required()
        .messages({
            'string.base': 'Cancellation reason must be a string',
            'any.only': 'Cancellation reason must be one of: customer_request, out_of_stock, payment_issue, address_issue, customer_unavailable, administrative_decision, quality_issue, delivery_emergency, vehicle_breakdown, safety_concern, other',
            'any.required': 'Cancellation reason is required'
        }),
    notes: Joi.string().max(500).optional()
        .messages({
            'string.max': 'Cancellation notes cannot exceed 500 characters'
        })
});