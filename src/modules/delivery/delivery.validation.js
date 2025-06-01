import Joi from 'joi';

// Validation for assigning multiple orders to delivery employee (Admin)
export const assignOrdersSchema = Joi.object({
    deliveryEmployeeId: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'Delivery employee ID must be a number',
            'number.integer': 'Delivery employee ID must be an integer',
            'number.positive': 'Delivery employee ID must be positive',
            'any.required': 'Delivery employee ID is required'
        }),
    orderIds: Joi.array().items(
        Joi.number().integer().positive()
    ).min(1).max(10).required()
        .messages({
            'array.base': 'Order IDs must be an array',
            'array.min': 'At least one order ID is required',
            'array.max': 'Maximum 10 orders can be assigned at once',
            'any.required': 'Order IDs are required'
        }),
    estimatedTime: Joi.number().integer().min(5).max(480).required()
        .messages({
            'number.base': 'Estimated time must be a number',
            'number.integer': 'Estimated time must be an integer',
            'number.min': 'Estimated time must be at least 5 minutes',
            'number.max': 'Estimated time cannot exceed 8 hours (480 minutes)',
            'any.required': 'Estimated time is required'
        }),
    notes: Joi.string().max(500).optional()
        .messages({
            'string.max': 'Notes cannot exceed 500 characters'
        })
});

// Validation for starting delivery (modified to not require estimatedTime)
export const startDeliverySchema = Joi.object({
    // Single order (existing functionality)
    orderId: Joi.number().integer().positive()
        .messages({
            'number.base': 'Order ID must be a number',
            'number.integer': 'Order ID must be an integer',
            'number.positive': 'Order ID must be positive'
        }),

    // Multiple orders (new functionality)
    orderIds: Joi.array().items(
        Joi.number().integer().positive()
    ).min(1).max(5)
        .messages({
            'array.base': 'Order IDs must be an array',
            'array.min': 'At least one order ID is required',
            'array.max': 'Maximum 5 orders can be started together'
        }),

    // Optional route notes
    routeNotes: Joi.string().max(300).optional()
        .messages({
            'string.max': 'Route notes cannot exceed 300 characters'
        })
}).xor('orderId', 'orderIds')  // Must have either orderId OR orderIds, not both
    .messages({
        'object.xor': 'Either orderId (single order) or orderIds (multiple orders) is required, but not both'
    });

// Validation for updating location
export const updateLocationSchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).required()
        .messages({
            'number.base': 'Latitude must be a number',
            'number.min': 'Latitude must be between -90 and 90',
            'number.max': 'Latitude must be between -90 and 90',
            'any.required': 'Latitude is required'
        }),
    longitude: Joi.number().min(-180).max(180).required()
        .messages({
            'number.base': 'Longitude must be a number',
            'number.min': 'Longitude must be between -180 and 180',
            'number.max': 'Longitude must be between -180 and 180',
            'any.required': 'Longitude is required'
        })
});

// Validation for updating estimated time
export const updateEstimatedTimeSchema = Joi.object({
    orderId: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'Order ID must be a number',
            'number.integer': 'Order ID must be an integer',
            'number.positive': 'Order ID must be positive',
            'any.required': 'Order ID is required'
        }),
    additionalTime: Joi.number().integer().min(1).max(240).required()
        .messages({
            'number.base': 'Additional time must be a number',
            'number.integer': 'Additional time must be an integer',
            'number.min': 'Additional time must be at least 1 minute',
            'number.max': 'Additional time cannot exceed 4 hours (240 minutes)',
            'any.required': 'Additional time is required'
        }),
    reason: Joi.string().min(3).max(200).required()
        .messages({
            'string.base': 'Reason must be a string',
            'string.min': 'Reason must be at least 3 characters long',
            'string.max': 'Reason cannot exceed 200 characters',
            'any.required': 'Reason for delay is required'
        })
});

// Validation for completing delivery
export const completeDeliverySchema = Joi.object({
    orderId: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'Order ID must be a number',
            'number.integer': 'Order ID must be an integer',
            'number.positive': 'Order ID must be positive',
            'any.required': 'Order ID is required'
        }),
    paymentMethod: Joi.string().valid('cash', 'debt', 'partial').required()
        .messages({
            'string.base': 'Payment method must be a string',
            'any.only': 'Payment method must be either cash, debt, or partial',
            'any.required': 'Payment method is required'
        }),
    totalAmount: Joi.number().positive().precision(2).required()
        .messages({
            'number.base': 'Total amount must be a number',
            'number.positive': 'Total amount must be positive',
            'any.required': 'Total amount is required'
        }),
    amountPaid: Joi.number().min(0).precision(2).required()
        .messages({
            'number.base': 'Amount paid must be a number',
            'number.min': 'Amount paid cannot be negative',
            'any.required': 'Amount paid is required'
        }),
    deliveryNotes: Joi.string().max(500).optional().allow('')
        .messages({
            'string.base': 'Delivery notes must be a string',
            'string.max': 'Delivery notes cannot exceed 500 characters'
        })
}).custom((value, helpers) => {
    const { paymentMethod, totalAmount, amountPaid } = value;

    // Validate payment logic
    if (paymentMethod === 'cash' && amountPaid !== totalAmount) {
        return helpers.error('custom.cashPaymentMismatch');
    }

    if (paymentMethod === 'debt' && amountPaid !== 0) {
        return helpers.error('custom.debtPaymentMismatch');
    }

    if (paymentMethod === 'partial' && (amountPaid <= 0 || amountPaid >= totalAmount)) {
        return helpers.error('custom.partialPaymentInvalid');
    }

    return value;
}).messages({
    'custom.cashPaymentMismatch': 'For cash payment, amount paid must equal total amount',
    'custom.debtPaymentMismatch': 'For debt payment, amount paid must be 0',
    'custom.partialPaymentInvalid': 'For partial payment, amount paid must be greater than 0 and less than total amount'
});

// Validation for order ID parameter
export const validateOrderId = Joi.object({
    orderId: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'Order ID must be a number',
            'number.integer': 'Order ID must be an integer',
            'number.positive': 'Order ID must be positive',
            'any.required': 'Order ID is required'
        })
});

// Validation for pagination and filtering
export const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1)
        .messages({
            'number.base': 'Page must be a number',
            'number.integer': 'Page must be an integer',
            'number.min': 'Page must be at least 1'
        }),
    limit: Joi.number().integer().min(1).max(100).default(10)
        .messages({
            'number.base': 'Limit must be a number',
            'number.integer': 'Limit must be an integer',
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 100'
        }),
    startDate: Joi.date().iso().optional()
        .messages({
            'date.base': 'Start date must be a valid date',
            'date.format': 'Start date must be in ISO format (YYYY-MM-DD)'
        }),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
        .messages({
            'date.base': 'End date must be a valid date',
            'date.format': 'End date must be in ISO format (YYYY-MM-DD)',
            'date.min': 'End date must be after start date'
        })
});

// Validation for delivery employee workload query (Admin)
export const workloadQuerySchema = Joi.object({
    includeOffline: Joi.boolean().default(false)
        .messages({
            'boolean.base': 'Include offline must be a boolean'
        }),
    sortBy: Joi.string().valid('name', 'activeOrders', 'location', 'lastUpdate').default('name')
        .messages({
            'string.base': 'Sort by must be a string',
            'any.only': 'Sort by must be one of: name, activeOrders, location, lastUpdate'
        }),
    sortOrder: Joi.string().valid('asc', 'desc').default('asc')
        .messages({
            'string.base': 'Sort order must be a string',
            'any.only': 'Sort order must be either asc or desc'
        })
});

// Validation for bulk order assignment (Admin)
export const bulkAssignOrdersSchema = Joi.object({
    assignments: Joi.array().items(
        Joi.object({
            deliveryEmployeeId: Joi.number().integer().positive().required(),
            orderIds: Joi.array().items(Joi.number().integer().positive()).min(1).max(10).required(),
            estimatedTime: Joi.number().integer().min(5).max(480).required()
        })
    ).min(1).max(20).required()
        .messages({
            'array.base': 'Assignments must be an array',
            'array.min': 'At least one assignment is required',
            'array.max': 'Maximum 20 assignments can be processed at once',
            'any.required': 'Assignments are required'
        })
});

// Validation for reassigning orders (Admin)
export const reassignOrderSchema = Joi.object({
    orderId: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'Order ID must be a number',
            'number.integer': 'Order ID must be an integer',
            'number.positive': 'Order ID must be positive',
            'any.required': 'Order ID is required'
        }),
    fromDeliveryEmployeeId: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'From delivery employee ID must be a number',
            'number.integer': 'From delivery employee ID must be an integer',
            'number.positive': 'From delivery employee ID must be positive',
            'any.required': 'From delivery employee ID is required'
        }),
    toDeliveryEmployeeId: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'To delivery employee ID must be a number',
            'number.integer': 'To delivery employee ID must be an integer',
            'number.positive': 'To delivery employee ID must be positive',
            'any.required': 'To delivery employee ID is required'
        }),
    reason: Joi.string().min(3).max(200).required()
        .messages({
            'string.base': 'Reason must be a string',
            'string.min': 'Reason must be at least 3 characters long',
            'string.max': 'Reason cannot exceed 200 characters',
            'any.required': 'Reason for reassignment is required'
        })
}).custom((value, helpers) => {
    if (value.fromDeliveryEmployeeId === value.toDeliveryEmployeeId) {
        return helpers.error('custom.sameEmployee');
    }
    return value;
}).messages({
    'custom.sameEmployee': 'Cannot reassign order to the same delivery employee'
});

// Validation for updating delivery employee status (Admin)
export const updateDeliveryEmployeeStatusSchema = Joi.object({
    deliveryEmployeeId: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'Delivery employee ID must be a number',
            'number.integer': 'Delivery employee ID must be an integer',
            'number.positive': 'Delivery employee ID must be positive',
            'any.required': 'Delivery employee ID is required'
        }),
    isOnline: Joi.boolean().required()
        .messages({
            'boolean.base': 'Online status must be a boolean',
            'any.required': 'Online status is required'
        }),
    reason: Joi.string().max(200).optional()
        .messages({
            'string.max': 'Reason cannot exceed 200 characters'
        })
});