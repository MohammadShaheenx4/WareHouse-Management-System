// File: Modules/warehouseEmployee/warehouseEmployee.validation.js
import Joi from 'joi';

// Validate prepare customer order request
export const prepareCustomerOrderSchema = Joi.object({
    status: Joi.string().valid('Preparing', 'Prepared').required(),
    note: Joi.string().allow('', null)
});

// Validate receive supplier order request
export const receiveSupplierOrderSchema = Joi.object({
    status: Joi.string().valid('Delivered').required(),
    note: Joi.string().allow('', null),
    items: Joi.array().items(
        Joi.object({
            id: Joi.number().integer().positive().required(),
            receivedQuantity: Joi.number().integer().min(0).optional()
        })
    ).optional()
});

// Validate order ID parameter
export const validateOrderId = Joi.object({
    id: Joi.number().integer().positive().required()
});