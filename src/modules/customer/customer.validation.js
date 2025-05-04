import Joi from "joi";

// Combined profile update validation schema
export const updateCustomerProfileSchema = Joi.object({
    // General profile fields
    email: Joi.string().email().optional(),
    phoneNumber: Joi.string().optional(),
    address: Joi.string().optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),

    // Password update fields
    currentPassword: Joi.string().optional(),
    newPassword: Joi.string().min(6).optional(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).optional()
        .messages({ 'any.only': 'Confirm password must match new password' })
}).custom((value, helpers) => {
    // Custom validation: If one password field is provided, all are required
    const { currentPassword, newPassword, confirmPassword } = value;

    if ((currentPassword || newPassword || confirmPassword) &&
        !(currentPassword && newPassword && confirmPassword)) {
        return helpers.error('object.passwordFields', {
            message: 'All password fields (currentPassword, newPassword, confirmPassword) must be provided together'
        });
    }

    return value;
});