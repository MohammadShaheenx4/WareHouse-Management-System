import Joi from "joi";

// Create order validation schema
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
// Update order status validation schema
export const updateOrderStatusSchema = Joi.object({
    status: Joi.string().valid("Pending", "Accepted", "Rejected", "Confirmed", "Delivered").required(),
    note: Joi.string().optional()
});

// Order ID validation schema
export const validateOrderId = Joi.object({
    id: Joi.number().integer().required()
});

// Get products by category validation schema
export const getCategoryProductsSchema = Joi.object({
    categoryId: Joi.number().integer().required()
});