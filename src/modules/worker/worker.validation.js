// File: Modules/warehouseEmployee/worker.validation.js
import Joi from 'joi';

// Standard prepare customer order request (for Preparing status)
export const prepareCustomerOrderSchema = Joi.object({
    status: Joi.string().valid('Preparing', 'Prepared').required(),
    note: Joi.string().allow('', null).optional()
});

// Enhanced validation for preparing with batch selections (for Prepared status with custom batches)
export const preparerWithBatchesSchema = Joi.object({
    status: Joi.string().valid('Prepared').required(),
    note: Joi.string().allow('', null).optional(),
    batchSelections: Joi.array().items(
        Joi.object({
            productId: Joi.number().integer().positive().required()
                .messages({
                    'number.base': 'Product ID must be a number',
                    'number.integer': 'Product ID must be an integer',
                    'number.positive': 'Product ID must be positive',
                    'any.required': 'Product ID is required'
                }),
            batchId: Joi.number().integer().positive().required()
                .messages({
                    'number.base': 'Batch ID must be a number',
                    'number.integer': 'Batch ID must be an integer',
                    'number.positive': 'Batch ID must be positive',
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
    ).optional()
        .messages({
            'array.base': 'Batch selections must be an array'
        })
});

// Worker validation for receiving supplier order
export const receiveSupplierOrderSchema = Joi.object({
    status: Joi.string().valid('Delivered').required(),
    note: Joi.string().allow('', null),
    items: Joi.array().items(
        Joi.object({
            id: Joi.number().integer().positive().required(),
            receivedQuantity: Joi.number().integer().min(0).optional(),
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