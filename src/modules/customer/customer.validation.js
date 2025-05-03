import Joi from "joi";

// Update customer profile validation schema
export const updateCustomerProfileSchema = Joi.object({
    // User table fields
    email: Joi.string().email().optional(),
    password: Joi.string().min(6).optional(),
    phoneNumber: Joi.string().optional(),

    // Customer table fields
    address: Joi.string().optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
});

// Update customer password validation schema
export const updatePasswordSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).required().disallow(Joi.ref('currentPassword')),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
        .messages({ 'any.only': 'Confirm password must match new password' })
});

// Upload profile picture validation
export const imageValidation = {
    allowedTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    maxSize: 5 * 1024 * 1024 // 5MB
};