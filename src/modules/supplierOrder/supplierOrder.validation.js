import Joi from 'joi';

// Enhanced create order validation schema - allows suppliers to provide estimated dates during creation
export const createSupplierOrderSchema = Joi.object({
    supplierId: Joi.number().integer().positive()
        .messages({
            'number.base': 'Supplier ID must be a number',
            'number.integer': 'Supplier ID must be an integer',
            'number.positive': 'Supplier ID must be positive'
        }),
    supplierName: Joi.string()
        .messages({
            'string.base': 'Supplier name must be a string'
        }),
    items: Joi.array().items(
        Joi.object({
            productId: Joi.number().integer().positive().required(),
            quantity: Joi.number().integer().positive().required(),
            costPrice: Joi.number().positive(),
            // Optional: Suppliers can provide estimated dates during order creation
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
        }).custom((value, helpers) => {
            // Validate dates if provided during creation
            if (value.prodDate && value.expDate) {
                const prodDate = new Date(value.prodDate);
                const expDate = new Date(value.expDate);

                if (expDate <= prodDate) {
                    return helpers.error('any.custom', {
                        message: `Expiry date must be after production date for product ${value.productId}`
                    });
                }
            }

            return value;
        })
    ).min(1).required(),
    note: Joi.string().allow('', null).optional()
}).or('supplierId', 'supplierName')
    .custom((value, helpers) => {
        if (!value.supplierId && !value.supplierName) {
            return helpers.error('any.custom', {
                message: 'Either supplier ID or supplier name must be provided'
            });
        }
        return value;
    });

// Enhanced order item schema for supplier acceptance with dates
const orderItemSchema = Joi.object({
    id: Joi.number().integer().positive().required(), // This is the productId
    status: Joi.string().valid('Accepted', 'Declined').default('Accepted'),
    costPrice: Joi.number().positive().when('status', {
        is: 'Accepted',
        then: Joi.optional(),
        otherwise: Joi.optional()
    }),
    quantity: Joi.number().integer().positive().when('status', {
        is: 'Accepted',
        then: Joi.optional(),
        otherwise: Joi.optional()
    }),
    // Production and expiry dates - supplier provides when accepting
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
}).custom((value, helpers) => {
    // Custom validation for accepted items with dates
    if (value.status === 'Accepted') {
        // If both dates are provided, expiry should be after production
        if (value.prodDate && value.expDate) {
            const prodDate = new Date(value.prodDate);
            const expDate = new Date(value.expDate);

            if (expDate <= prodDate) {
                return helpers.error('any.custom', {
                    message: `Expiry date must be after production date for product ${value.id}`
                });
            }
        }

        // Production date should not be in the future
        if (value.prodDate) {
            const prodDate = new Date(value.prodDate);
            const today = new Date();
            today.setHours(23, 59, 59, 999);

            if (prodDate > today) {
                return helpers.error('any.custom', {
                    message: `Production date cannot be in the future for product ${value.id}`
                });
            }
        }

        // Expiry date should not be in the past
        if (value.expDate) {
            const expDate = new Date(value.expDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (expDate < today) {
                return helpers.error('any.custom', {
                    message: `Expiry date cannot be in the past for product ${value.id}`
                });
            }
        }
    }

    return value;
});

// Update order status validation schema
export const updateOrderStatusSchema = Joi.object({
    status: Joi.string().valid('Accepted', 'Declined', 'Delivered', 'PartiallyAccepted').required()
        .messages({
            'string.base': 'Status must be a string',
            'any.only': 'Status must be one of: Accepted, Declined, Delivered, PartiallyAccepted',
            'any.required': 'Status is required'
        }),
    note: Joi.string().when('status', {
        is: 'Declined',
        then: Joi.string().required().messages({
            'string.base': 'Note must be a string',
            'any.required': 'Note is required when status is Declined'
        }),
        otherwise: Joi.string().allow('', null)
    }),
    items: Joi.array().items(orderItemSchema).when('status', {
        is: Joi.string().valid('Accepted', 'PartiallyAccepted'),
        then: Joi.array().optional(),
        otherwise: Joi.when('status', {
            is: 'Delivered',
            then: Joi.array().forbidden(),
            otherwise: Joi.array().optional()
        })
    })
});

// Create a validation schema for the update request
export const updateSupplierProductSchema = Joi.object({
    priceSupplier: Joi.number().min(0).optional(),
    status: Joi.string().valid('Active', 'NotActive').optional()
}).or('priceSupplier', 'status');

// Get order by ID validation schema
export const validateOrderId = Joi.object({
    id: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'Order ID must be a number',
            'number.integer': 'Order ID must be an integer',
            'number.positive': 'Order ID must be positive',
            'any.required': 'Order ID is required'
        })
});