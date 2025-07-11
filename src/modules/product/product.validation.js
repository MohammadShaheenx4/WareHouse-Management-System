import Joi from 'joi';

// Create product validation schema
export const createProductSchema = Joi.object({
    name: Joi.string().min(3).max(255).required()
        .messages({
            'string.min': 'Product name must be at least 3 characters',
            'string.max': 'Product name cannot exceed 255 characters',
            'any.required': 'Product name is required'
        }),
    costPrice: Joi.number().positive().required()
        .messages({
            'number.base': 'Cost price must be a number',
            'number.positive': 'Cost price must be positive',
            'any.required': 'Cost price is required'
        }),
    lowStock: Joi.number().integer().min(0).optional().default(10),
    sellPrice: Joi.number().positive().required()
        .messages({
            'number.base': 'Sell price must be a number',
            'number.positive': 'Sell price must be positive',
            'any.required': 'Sell price is required'
        }),
    quantity: Joi.number().integer().min(0).required()
        .messages({
            'number.base': 'Quantity must be a number',
            'number.integer': 'Quantity must be an integer',
            'number.min': 'Quantity cannot be negative',
            'any.required': 'Quantity is required'
        }),
    unit: Joi.string().max(100).allow('', null)
        .messages({
            'string.base': 'Unit must be a string',
            'string.max': 'Unit cannot exceed 100 characters'
        }),
    // Allow either categoryId or categoryName
    categoryId: Joi.number().integer().positive()
        .messages({
            'number.base': 'Category ID must be a number',
            'number.integer': 'Category ID must be an integer',
            'number.positive': 'Category ID must be positive'
        }),
    categoryName: Joi.string()
        .messages({
            'string.base': 'Category name must be a string'
        }),
    // Add validation for suppliers - can be array of IDs or supplier names
    supplierIds: Joi.array().items(Joi.number().integer().positive())
        .messages({
            'array.base': 'Supplier IDs must be an array',
            'number.base': 'Supplier ID must be a number',
            'number.integer': 'Supplier ID must be an integer',
            'number.positive': 'Supplier ID must be positive'
        }),
    supplierNames: Joi.array().items(Joi.string())
        .messages({
            'array.base': 'Supplier names must be an array',
            'string.base': 'Supplier name must be a string'
        }),
    status: Joi.string().valid('Active', 'NotActive').default('Active'),
    barcode: Joi.string().allow('', null),
    warranty: Joi.string().allow('', null),
    prodDate: Joi.date().allow(null),
    expDate: Joi.date().allow(null),
    description: Joi.string().allow('', null),
    // NEW: Batch-related fields
    supplierOrderId: Joi.number().integer().positive().allow(null).optional()
        .messages({
            'number.base': 'Supplier order ID must be a number',
            'number.integer': 'Supplier order ID must be an integer',
            'number.positive': 'Supplier order ID must be positive'
        })
}).custom((value, helpers) => {
    // Ensure at least one of categoryId or categoryName is provided
    if (!value.categoryId && !value.categoryName) {
        return helpers.error('any.custom', { message: 'Either categoryId or categoryName must be provided' });
    }

    // Validate expiry date is after production date
    if (value.prodDate && value.expDate) {
        const prodDate = new Date(value.prodDate);
        const expDate = new Date(value.expDate);

        if (expDate <= prodDate) {
            return helpers.error('any.custom', { message: 'Expiry date must be after production date' });
        }
    }

    // Validate expiry date is not in the past
    if (value.expDate) {
        const expDate = new Date(value.expDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day

        if (expDate < today) {
            return helpers.error('any.custom', { message: 'Expiry date cannot be in the past' });
        }
    }

    return value;
});

// Update product validation schema
// Update product validation schema - Using the same approach as category
export const updateProductSchema = Joi.object({
    name: Joi.string().min(3).max(255)
        .messages({
            'string.min': 'Product name must be at least 3 characters',
            'string.max': 'Product name cannot exceed 255 characters'
        }),
    costPrice: Joi.number().positive()
        .messages({
            'number.base': 'Cost price must be a number',
            'number.positive': 'Cost price must be positive'
        }),
    lowStock: Joi.number().integer().min(0).optional(),
    sellPrice: Joi.number().positive()
        .messages({
            'number.base': 'Sell price must be a number',
            'number.positive': 'Sell price must be positive'
        }),
    quantity: Joi.number().integer().min(0)
        .messages({
            'number.base': 'Quantity must be a number',
            'number.integer': 'Quantity must be an integer',
            'number.min': 'Quantity cannot be negative'
        }),
    unit: Joi.string().max(100).allow('', null)
        .messages({
            'string.base': 'Unit must be a string',
            'string.max': 'Unit cannot exceed 100 characters'
        }),
    // Allow either categoryId or categoryName
    categoryId: Joi.number().integer().positive()
        .messages({
            'number.base': 'Category ID must be a number',
            'number.integer': 'Category ID must be an integer',
            'number.positive': 'Category ID must be positive'
        }),
    categoryName: Joi.string()
        .messages({
            'string.base': 'Category name must be a string'
        }),
    // Add validation for suppliers - can be array of IDs or supplier names
    supplierIds: Joi.array().items(Joi.number().integer().positive())
        .messages({
            'array.base': 'Supplier IDs must be an array',
            'number.base': 'Supplier ID must be a number',
            'number.integer': 'Supplier ID must be an integer',
            'number.positive': 'Supplier ID must be positive'
        }),
    supplierNames: Joi.array().items(Joi.string())
        .messages({
            'array.base': 'Supplier names must be an array',
            'string.base': 'Supplier name must be a string'
        }),
    status: Joi.string().valid('Active', 'NotActive'),
    barcode: Joi.string().allow('', null),
    warranty: Joi.string().allow('', null),
    prodDate: Joi.date().allow(null),
    expDate: Joi.date().allow(null),
    description: Joi.string().allow('', null),
    // NEW: Batch-related fields
    supplierOrderId: Joi.number().integer().positive().allow(null).optional()
        .messages({
            'number.base': 'Supplier order ID must be a number',
            'number.integer': 'Supplier order ID must be an integer',
            'number.positive': 'Supplier order ID must be positive'
        })
}).custom((value, helpers) => {
    // Allow empty body only if this is an image-only update (handled in controller)
    // Otherwise require at least one field
    const hasFields = Object.keys(value).length > 0;
    if (!hasFields) {
        // This will be handled in the controller - if there's no file, it will error there
        return value;
    }
    // Validate expiry date is after production date
    if (value.prodDate && value.expDate) {
        const prodDate = new Date(value.prodDate);
        const expDate = new Date(value.expDate);

        if (expDate <= prodDate) {
            return helpers.error('any.custom', { message: 'Expiry date must be after production date' });
        }
    }

    // Validate expiry date is not in the past (only for new expiry dates)
    if (value.expDate) {
        const expDate = new Date(value.expDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day

        if (expDate < today) {
            return helpers.error('any.custom', { message: 'Expiry date cannot be in the past' });
        }
    }

    return value;
});
// Validate product ID parameter
export const validateProductId = Joi.object({
    id: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'Product ID must be a number',
            'number.integer': 'Product ID must be an integer',
            'number.positive': 'Product ID must be positive',
            'any.required': 'Product ID is required'
        })
});

// File validation for product image
export const fileValidation = Joi.object({
    fieldname: Joi.string().required(),
    originalname: Joi.string().required(),
    encoding: Joi.string().required(),
    mimetype: Joi.string().valid('image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp').required()
        .messages({
            'any.only': 'Only image files (jpeg, png, jpg, gif, webp) are allowed'
        }),
    size: Joi.number().max(5 * 1024 * 1024).required()
        .messages({
            'number.max': 'Image size should not exceed 5MB'
        }),
    path: Joi.string().required()
}).unknown(true);

// NEW: Batch-specific validation schemas
export const batchQuerySchema = Joi.object({
    productId: Joi.number().integer().positive().required(),
    includeExpired: Joi.boolean().default(false),
    includeNearExpiry: Joi.boolean().default(true),
    daysAhead: Joi.number().integer().min(1).max(365).default(30),
    sortBy: Joi.string().valid('prodDate', 'expDate', 'receivedDate', 'quantity').default('prodDate')
});

// NEW: Product filtering validation with batch options
export const productFilterSchema = Joi.object({
    name: Joi.string().optional(),
    minPrice: Joi.number().positive().optional(),
    maxPrice: Joi.number().positive().optional(),
    category: Joi.alternatives().try(
        Joi.number().integer().positive(),
        Joi.string()
    ).optional(),
    supplier: Joi.alternatives().try(
        Joi.number().integer().positive(),
        Joi.string()
    ).optional(),
    status: Joi.string().valid('Active', 'NotActive').optional(),
    inStock: Joi.boolean().optional(),
    includeBatches: Joi.boolean().default(false),
    lowStockOnly: Joi.boolean().default(false),
    hasExpiring: Joi.boolean().optional(), // Products with expiring batches
    expiringDays: Joi.number().integer().min(1).max(365).default(30),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('name', 'quantity', 'sellPrice', 'createdAt', 'expDate').default('createdAt'),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC')
});

// NEW: Stock adjustment validation
export const stockAdjustmentSchema = Joi.object({
    adjustmentType: Joi.string().valid('add', 'subtract', 'set').required(),
    quantity: Joi.number().integer().min(0).required(),
    reason: Joi.string().required().max(500),
    prodDate: Joi.date().allow(null).optional(),
    expDate: Joi.date().allow(null).optional(),
    batchId: Joi.number().integer().positive().optional(), // For adjusting specific batch
    createBatch: Joi.boolean().default(true), // Whether to create new batch for additions
    supplierOrderId: Joi.number().integer().positive().allow(null).optional()
}).custom((value, helpers) => {
    // Validate dates if both provided
    if (value.prodDate && value.expDate) {
        const prodDate = new Date(value.prodDate);
        const expDate = new Date(value.expDate);

        if (expDate <= prodDate) {
            return helpers.error('any.custom', { message: 'Expiry date must be after production date' });
        }
    }

    // For subtract/set operations, don't allow batch creation fields
    if ((value.adjustmentType === 'subtract' || value.adjustmentType === 'set') &&
        (value.prodDate || value.expDate || value.createBatch)) {
        return helpers.error('any.custom', {
            message: 'Batch creation fields (prodDate, expDate, createBatch) are only valid for add operations'
        });
    }

    return value;
});

// Validation helper functions
export const validationHelpers = {
    // Validate batch number format (if manually provided)
    isValidBatchNumber: (batchNumber) => {
        // Format: P{productId}-{YYYYMMDD}-{sequence}
        const pattern = /^P\d+-\d{8}-\d{3}$/;
        return pattern.test(batchNumber);
    },

    // Check if date is within reasonable range
    isReasonableDate: (date, maxYearsAhead = 5) => {
        const checkDate = new Date(date);
        const now = new Date();
        const maxDate = new Date();
        maxDate.setFullYear(now.getFullYear() + maxYearsAhead);

        return checkDate >= now && checkDate <= maxDate;
    },

    // Validate supplier order reference
    validateSupplierOrder: async (supplierOrderId, supplierId = null) => {
        // This would check if supplier order exists and belongs to supplier
        // Implementation depends on your supplier order model
        return true; // Placeholder
    }
};