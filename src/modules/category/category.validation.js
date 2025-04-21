import Joi from 'joi';

// Create category validation schema
export const createCategorySchema = Joi.object({
    categoryName: Joi.string().min(3).max(100).required()
        .messages({
            'string.min': 'Category name must be at least 3 characters',
            'string.max': 'Category name cannot exceed 100 characters',
            'any.required': 'Category name is required'
        }),
    description: Joi.string().max(500).allow('', null)
        .messages({
            'string.max': 'Description cannot exceed 500 characters'
        }),
    status: Joi.string().valid('Active', 'NotActive').default('Active')
});

// Update category validation schema
export const updateCategorySchema = Joi.object({
    categoryName: Joi.string().min(3).max(100)
        .messages({
            'string.min': 'Category name must be at least 3 characters',
            'string.max': 'Category name cannot exceed 100 characters'
        }),
    description: Joi.string().max(500).allow('', null)
        .messages({
            'string.max': 'Description cannot exceed 500 characters'
        }),
    status: Joi.string().valid('Active', 'NotActive')
}).min(1).message('Please provide at least one field to update');

// Validate category ID parameter
export const validateCategoryId = Joi.object({
    id: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'Category ID must be a number',
            'number.integer': 'Category ID must be an integer',
            'number.positive': 'Category ID must be positive',
            'any.required': 'Category ID is required'
        })
});

// File validation for category image
export const fileValidation = Joi.object({
    fieldname: Joi.string().required(),
    originalname: Joi.string().required(),
    encoding: Joi.string().required(),
    mimetype: Joi.string().valid('image/jpeg', 'image/png', 'image/jpg', 'image/gif').required()
        .messages({
            'any.only': 'Only image files (jpeg, png, jpg, gif) are allowed'
        }),
    size: Joi.number().max(5 * 1024 * 1024).required()
        .messages({
            'number.max': 'Image size should not exceed 5MB'
        }),
    path: Joi.string().required()
}).unknown(true);