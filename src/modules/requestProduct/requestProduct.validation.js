import Joi from 'joi';

export const createRequestProductSchema = Joi.object({
    name: Joi.string().max(255).required(),
    costPrice: Joi.number().positive().required(),
    sellPrice: Joi.number().positive().required(),
    unit: Joi.string().max(100).allow('', null)
        .messages({
            'string.base': 'Unit must be a string',
            'string.max': 'Unit cannot exceed 100 characters'
        }),
    categoryId: Joi.number().integer().positive().allow(null),
    categoryName: Joi.string().max(255).allow(null),
    barcode: Joi.string().max(255).allow(null),
    warranty: Joi.string().max(255).allow(null),
    prodDate: Joi.date().allow(null),
    expDate: Joi.date().allow(null),
    description: Joi.string().allow(null)
}).or('categoryId', 'categoryName'); // Require at least one of categoryId or categoryName

export const updateRequestStatusSchema = Joi.object({
    status: Joi.string().valid('Accepted', 'Declined').required(),
    adminNote: Joi.string().when('status', {
        is: 'Declined',
        then: Joi.required(),
        otherwise: Joi.allow(null, '')
    })
});

export const validateRequestId = Joi.object({
    requestId: Joi.number().integer().positive().required()
});

export const fileValidation = Joi.object({
    fieldname: Joi.string().required(),
    originalname: Joi.string().required(),
    encoding: Joi.string().required(),
    mimetype: Joi.string().valid('image/jpeg', 'image/png', 'image/gif', 'image/webp').required(),
    size: Joi.number().max(5 * 1024 * 1024).required(), // 5MB max
    destination: Joi.string().required(),
    filename: Joi.string().required(),
    path: Joi.string().required(),
    buffer: Joi.any()
}).unknown(true); // Allow additional unknown fields