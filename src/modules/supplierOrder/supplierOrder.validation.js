import Joi from 'joi';

// Create order validation schema
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
            costPrice: Joi.number().positive()
        })
    ).min(1).required()
}).or('supplierId', 'supplierName')
    .custom((value, helpers) => {
        if (!value.supplierId && !value.supplierName) {
            return helpers.error('any.custom', {
                message: 'Either supplier ID or supplier name must be provided'
            });
        }
        return value;
    });

// Update order status validation schema
export const updateOrderStatusSchema = Joi.object({
    status: Joi.string().valid('Accepted', 'Declined', 'Delivered').required()
        .messages({
            'string.base': 'Status must be a string',
            'any.only': 'Status must be one of: Accepted, Declined, Delivered',
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
    items: Joi.array().items(
        Joi.object({
            id: Joi.number().integer().positive().required(),
            costPrice: Joi.number().positive().required(),
            quantity: Joi.number().integer().positive()
        })
    ).when('status', {
        is: 'Accepted',
        then: Joi.array().optional(),
        otherwise: Joi.array().forbidden()
    })
});

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