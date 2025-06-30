// File: Modules/warehouseEmployee/worker.validation.js
import Joi from 'joi';

// Validate prepare customer order request
export const prepareCustomerOrderSchema = Joi.object({
    status: Joi.string().valid('Preparing', 'Prepared').required(),
    note: Joi.string().allow('', null)
});

// Enhanced validate receive supplier order request with batch information
export const receiveSupplierOrderSchema = Joi.object({
    status: Joi.string().valid('Delivered').required(),
    note: Joi.string().allow('', null),
    items: Joi.array().items(
        Joi.object({
            id: Joi.number().integer().positive().required(),
            receivedQuantity: Joi.number().integer().min(0).optional(),
            prodDate: Joi.date().iso().allow(null).optional()
                .messages({
                    'date.base': 'Production date must be a valid date',
                    'date.format': 'Production date must be in ISO format (YYYY-MM-DD)'
                }),
            expDate: Joi.date().iso().allow(null).optional()
                .messages({
                    'date.base': 'Expiry date must be a valid date',
                    'date.format': 'Expiry date must be in ISO format (YYYY-MM-DD)'
                }),
            batchNumber: Joi.string().max(100).allow('', null).optional()
                .messages({
                    'string.max': 'Batch number cannot exceed 100 characters'
                }),
            notes: Joi.string().allow('', null).optional()
                .messages({
                    'string.base': 'Notes must be a string'
                })
        })
    ).optional()
}).custom((value, helpers) => {
    // Custom validation: if items are provided, validate date logic
    if (value.items && value.items.length > 0) {
        for (const item of value.items) {
            // If both dates are provided, expiry should be after production
            if (item.prodDate && item.expDate) {
                const prodDate = new Date(item.prodDate);
                const expDate = new Date(item.expDate);

                if (expDate <= prodDate) {
                    return helpers.error('any.custom', {
                        message: `Expiry date must be after production date for item ${item.id}`
                    });
                }
            }

            // Production date should not be in the future
            if (item.prodDate) {
                const prodDate = new Date(item.prodDate);
                const today = new Date();
                today.setHours(23, 59, 59, 999); // End of today

                if (prodDate > today) {
                    return helpers.error('any.custom', {
                        message: `Production date cannot be in the future for item ${item.id}`
                    });
                }
            }

            // Expiry date should not be in the past
            if (item.expDate) {
                const expDate = new Date(item.expDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Start of today

                if (expDate < today) {
                    return helpers.error('any.custom', {
                        message: `Expiry date cannot be in the past for item ${item.id}`
                    });
                }
            }
        }
    }

    return value;
});

// Validate order ID parameter
export const validateOrderId = Joi.object({
    id: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'Order ID must be a number',
            'number.integer': 'Order ID must be an integer',
            'number.positive': 'Order ID must be positive',
            'any.required': 'Order ID is required'
        })
});

// Validate query parameters for expiring products
export const validateExpiringProductsQuery = Joi.object({
    days: Joi.number().integer().min(1).max(365).optional().default(30)
        .messages({
            'number.base': 'Days must be a number',
            'number.integer': 'Days must be an integer',
            'number.min': 'Days must be at least 1',
            'number.max': 'Days cannot exceed 365'
        })
});