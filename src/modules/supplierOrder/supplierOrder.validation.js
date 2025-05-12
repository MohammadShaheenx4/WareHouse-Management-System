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

// Create schema for order items in update request
// Order item schema for updates
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
    prodDate: Joi.date().iso().allow(null).optional(),
    expDate: Joi.date().iso().allow(null).optional()
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