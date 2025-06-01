import Joi from 'joi';

// Validate order ID parameter
export const validateOrderId = Joi.object({
    id: Joi.number().integer().positive().required()
});

// Start delivery validation
export const startDeliverySchema = Joi.object({
    orderId: Joi.number().integer().positive().required(),
    estimatedTime: Joi.number().integer().min(1).max(300).required() // in minutes, max 5 hours
});

// Update location validation
export const updateLocationSchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
});

// Update estimated time validation
export const updateEstimatedTimeSchema = Joi.object({
    orderId: Joi.number().integer().positive().required(),
    additionalTime: Joi.number().integer().min(1).max(120).required(), // additional minutes, max 2 hours
    reason: Joi.string().min(3).max(500).required()
});

// Complete delivery validation
export const completeDeliverySchema = Joi.object({
    orderId: Joi.number().integer().positive().required(),
    paymentMethod: Joi.string().valid('cash', 'debt', 'partial').required(),
    totalAmount: Joi.number().positive().required(),
    amountPaid: Joi.number().min(0).required(),
    deliveryNotes: Joi.string().max(1000).optional().allow(null, '')
});

// Validate pagination parameters
export const paginationSchema = Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
});