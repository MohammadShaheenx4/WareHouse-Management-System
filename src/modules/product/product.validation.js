import Joi from 'joi';

// Create product validation schema
export const createProductSchema = Joi.object({
    name: Joi.string().min(3).max(255).required()
        .messages({
            'string.min': 'Product name must be at least 3 characters',
            'string.max': 'Product name cannot exceed 255 characters',
            'any.required': 'Product name is required'
        }),
    costPrice: Joi.number().positive().required()
        .messages({
            'number.base': 'Cost price must be a number',
            'number.positive': 'Cost price must be positive',
            'any.required': 'Cost price is required'
        }),
    sellPrice: Joi.number().positive().required()
        .messages({
            'number.base': 'Sell price must be a number',
            'number.positive': 'Sell price must be positive',
            'any.required': 'Sell price is required'
        }),
    quantity: Joi.number().integer().min(0).required()
        .messages({
            'number.base': 'Quantity must be a number',
            'number.integer': 'Quantity must be an integer',
            'number.min': 'Quantity cannot be negative',
            'any.required': 'Quantity is required'
        }),
    // Allow either categoryId or categoryName
    categoryId: Joi.number().integer().positive()
        .messages({
            'number.base': 'Category ID must be a number',
            'number.integer': 'Category ID must be an integer',
            'number.positive': 'Category ID must be positive'
        }),
    categoryName: Joi.string()
        .messages({
            'string.base': 'Category name must be a string'
        }),
    // Add validation for suppliers - can be array of IDs or supplier names
    supplierIds: Joi.array().items(Joi.number().integer().positive())
        .messages({
            'array.base': 'Supplier IDs must be an array',
            'number.base': 'Supplier ID must be a number',
            'number.integer': 'Supplier ID must be an integer',
            'number.positive': 'Supplier ID must be positive'
        }),
    supplierNames: Joi.array().items(Joi.string())
        .messages({
            'array.base': 'Supplier names must be an array',
            'string.base': 'Supplier name must be a string'
        }),
    status: Joi.string().valid('Active', 'NotActive').default('Active'),
    barcode: Joi.string().allow('', null),
    warranty: Joi.string().allow('', null),
    prodDate: Joi.date().allow(null),
    expDate: Joi.date().allow(null),
    description: Joi.string().allow('', null)
}).custom((value, helpers) => {
    // Ensure at least one of categoryId or categoryName is provided
    if (!value.categoryId && !value.categoryName) {
        return helpers.error('any.custom', { message: 'Either categoryId or categoryName must be provided' });
    }

    // Ensure at least one of supplierIds or supplierNames is provided
    if (value.supplierIds === undefined && value.supplierNames === undefined) {
        return value; // Suppliers can be optional
    }

    // If supplierIds is empty array and supplierNames is empty array, it's valid (no suppliers)
    if (
        (Array.isArray(value.supplierIds) && value.supplierIds.length === 0) &&
        (Array.isArray(value.supplierNames) && value.supplierNames.length === 0)
    ) {
        return value;
    }

    // If one is provided, it should not be empty
    if (
        (Array.isArray(value.supplierIds) && value.supplierIds.length === 0) &&
        (!Array.isArray(value.supplierNames) || value.supplierNames.length === 0)
    ) {
        return helpers.error('any.custom', { message: 'At least one supplier must be provided' });
    }

    if (
        (Array.isArray(value.supplierNames) && value.supplierNames.length === 0) &&
        (!Array.isArray(value.supplierIds) || value.supplierIds.length === 0)
    ) {
        return helpers.error('any.custom', { message: 'At least one supplier must be provided' });
    }

    return value;
});

// Update product validation schema
export const updateProductSchema = Joi.object({
    name: Joi.string().min(3).max(255)
        .messages({
            'string.min': 'Product name must be at least 3 characters',
            'string.max': 'Product name cannot exceed 255 characters'
        }),
    costPrice: Joi.number().positive()
        .messages({
            'number.base': 'Cost price must be a number',
            'number.positive': 'Cost price must be positive'
        }),
    sellPrice: Joi.number().positive()
        .messages({
            'number.base': 'Sell price must be a number',
            'number.positive': 'Sell price must be positive'
        }),
    quantity: Joi.number().integer().min(0)
        .messages({
            'number.base': 'Quantity must be a number',
            'number.integer': 'Quantity must be an integer',
            'number.min': 'Quantity cannot be negative'
        }),
    // Allow either categoryId or categoryName
    categoryId: Joi.number().integer().positive()
        .messages({
            'number.base': 'Category ID must be a number',
            'number.integer': 'Category ID must be an integer',
            'number.positive': 'Category ID must be positive'
        }),
    categoryName: Joi.string()
        .messages({
            'string.base': 'Category name must be a string'
        }),
    // Add validation for suppliers - can be array of IDs or supplier names
    supplierIds: Joi.array().items(Joi.number().integer().positive())
        .messages({
            'array.base': 'Supplier IDs must be an array',
            'number.base': 'Supplier ID must be a number',
            'number.integer': 'Supplier ID must be an integer',
            'number.positive': 'Supplier ID must be positive'
        }),
    supplierNames: Joi.array().items(Joi.string())
        .messages({
            'array.base': 'Supplier names must be an array',
            'string.base': 'Supplier name must be a string'
        }),
    status: Joi.string().valid('Active', 'NotActive'),
    barcode: Joi.string().allow('', null),
    warranty: Joi.string().allow('', null),
    prodDate: Joi.date().allow(null),
    expDate: Joi.date().allow(null),
    description: Joi.string().allow('', null)
}).min(1).message('Please provide at least one field to update');

// Validate product ID parameter
export const validateProductId = Joi.object({
    id: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'Product ID must be a number',
            'number.integer': 'Product ID must be an integer',
            'number.positive': 'Product ID must be positive',
            'any.required': 'Product ID is required'
        })
});

// File validation for product image
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