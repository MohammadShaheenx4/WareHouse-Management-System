import Joi from "joi";

// User profile update validation schema
export const updateUserProfileSchema = Joi.object({
    // Basic profile fields
    name: Joi.string().min(2).max(100).optional()
        .messages({
            'string.min': 'Name must be at least 2 characters',
            'string.max': 'Name cannot exceed 100 characters'
        }),

    email: Joi.string().email().optional()
        .messages({
            'string.email': 'Please provide a valid email address'
        }),

    // ADD THIS - Phone number validation
    phoneNumber: Joi.string().pattern(/^[0-9+\-\s()]*$/).min(10).max(20).optional()
        .messages({
            'string.pattern.base': 'Phone number can only contain numbers, +, -, spaces, and parentheses',
            'string.min': 'Phone number must be at least 10 characters',
            'string.max': 'Phone number cannot exceed 20 characters'
        }),

    // Password update fields
    currentPassword: Joi.string().optional(),

    newPassword: Joi.string().min(6).optional()
        .messages({
            'string.min': 'New password must be at least 6 characters'
        }),

    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).optional()
        .messages({
            'any.only': 'Confirm password must match new password'
        })
}).custom((value, helpers) => {
    // Custom validation: If any password field is provided, all are required
    const { currentPassword, newPassword, confirmPassword } = value;

    if ((currentPassword || newPassword || confirmPassword) &&
        !(currentPassword && newPassword && confirmPassword)) {
        return helpers.error('object.passwordFields', {
            message: 'All password fields (currentPassword, newPassword, confirmPassword) must be provided together'
        });
    }

    return value;
});

// Change password validation schema (separate endpoint)
export const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required()
        .messages({
            'any.required': 'Current password is required'
        }),

    newPassword: Joi.string().min(6).required()
        .messages({
            'string.min': 'New password must be at least 6 characters',
            'any.required': 'New password is required'
        }),

    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
        .messages({
            'any.only': 'Confirm password must match new password',
            'any.required': 'Confirm password is required'
        })
});

// Get user by ID validation schema
export const validateUserId = Joi.object({
    userId: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'User ID must be a number',
            'number.integer': 'User ID must be an integer',
            'number.positive': 'User ID must be positive',
            'any.required': 'User ID is required'
        })
});

// File validation for profile picture
export const profilePictureValidation = Joi.object({
    fieldname: Joi.string().required(),
    originalname: Joi.string().required(),
    encoding: Joi.string().required(),
    mimetype: Joi.string().valid('image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp').required()
        .messages({
            'any.only': 'Only image files (jpeg, png, jpg, gif, webp) are allowed'
        }),
    size: Joi.number().max(5 * 1024 * 1024).required()
        .messages({
            'number.max': 'Image size should not exceed 5MB'
        }),
    path: Joi.string().required()
}).unknown(true);