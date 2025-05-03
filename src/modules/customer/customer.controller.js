import customerModel from "../../../DB/Models/customer.model.js";
import userModel from "../../../DB/Models/user.model.js";
import bcrypt from 'bcryptjs';
import { updateCustomerProfileSchema, updatePasswordSchema, imageValidation } from ".//customer.validation.js";
import cloudinary from "../../utils/cloudinary.js";
import sequelize from "../../../DB/Connection.js";

/**
 * @desc    Get customer profile
 * @route   GET /api/customer/profile
 * @access  Customer
 */
export const getCustomerProfile = async (req, res) => {
    try {
        // Get customer ID from authenticated user
        const userId = req.user.userId;

        // Get customer with user information
        const customer = await customerModel.findOne({
            where: { userId },
            include: [{
                model: userModel,
                as: 'user',
                attributes: ['userId', 'name', 'email', 'phoneNumber', 'profilePicture']
            }]
        });

        if (!customer) {
            return res.status(404).json({ message: 'Customer profile not found' });
        }

        return res.status(200).json({
            message: 'Customer profile retrieved successfully',
            customer: {
                id: customer.id,
                address: customer.address,
                latitude: customer.latitude,
                longitude: customer.longitude,
                accountBalance: customer.accountBalance,
                user: {
                    userId: customer.user.userId,
                    name: customer.user.name,
                    email: customer.user.email,
                    phoneNumber: customer.user.phoneNumber,
                    profilePicture: customer.user.profilePicture
                }
            }
        });
    } catch (error) {
        console.error('Error fetching customer profile:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Update customer profile
 * @route   PUT /api/customer/profile
 * @access  Customer
 */
export const updateCustomerProfile = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        // Validate request body
        const { error } = updateCustomerProfileSchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({ message: error.details[0].message });
        }

        const userId = req.user.userId;
        const { email, password, phoneNumber, address, latitude, longitude } = req.body;

        // Get customer and user records
        const customer = await customerModel.findOne({ where: { userId } });
        const user = await userModel.findByPk(userId);

        if (!customer || !user) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Customer profile not found' });
        }

        // Check if email is already in use by another user
        if (email && email !== user.email) {
            const existingUser = await userModel.findOne({ where: { email } });
            if (existingUser && existingUser.userId !== userId) {
                await transaction.rollback();
                return res.status(400).json({ message: 'Email already in use by another account' });
            }
        }

        // Create update objects
        const userUpdateData = {};
        const customerUpdateData = {};

        // User table updates
        if (email) userUpdateData.email = email;
        if (phoneNumber) userUpdateData.phoneNumber = phoneNumber;
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            userUpdateData.password = hashedPassword;
        }

        // Customer table updates
        if (address) customerUpdateData.address = address;
        if (latitude !== undefined) customerUpdateData.latitude = latitude;
        if (longitude !== undefined) customerUpdateData.longitude = longitude;

        // Update user record if there are changes
        if (Object.keys(userUpdateData).length > 0) {
            await user.update(userUpdateData, { transaction });
        }

        // Update customer record if there are changes
        if (Object.keys(customerUpdateData).length > 0) {
            await customer.update(customerUpdateData, { transaction });
        }

        // Commit the transaction
        await transaction.commit();

        // Get updated customer profile
        const updatedCustomer = await customerModel.findOne({
            where: { userId },
            include: [{
                model: userModel,
                as: 'user',
                attributes: ['userId', 'name', 'email', 'phoneNumber', 'profilePicture']
            }]
        });

        return res.status(200).json({
            message: 'Customer profile updated successfully',
            customer: {
                id: updatedCustomer.id,
                address: updatedCustomer.address,
                latitude: updatedCustomer.latitude,
                longitude: updatedCustomer.longitude,
                accountBalance: updatedCustomer.accountBalance,
                user: {
                    userId: updatedCustomer.user.userId,
                    name: updatedCustomer.user.name,
                    email: updatedCustomer.user.email,
                    phoneNumber: updatedCustomer.user.phoneNumber,
                    profilePicture: updatedCustomer.user.profilePicture
                }
            }
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating customer profile:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Update customer password
 * @route   PUT /api/customer/password
 * @access  Customer
 */
export const updateCustomerPassword = async (req, res) => {
    try {
        // Validate request body
        const { error } = updatePasswordSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;

        // Get user record
        const user = await userModel.findByPk(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await user.update({ password: hashedPassword });

        return res.status(200).json({
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Error updating password:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Upload profile picture
 * @route   POST /api/customer/profile-picture
 * @access  Customer
 */
export const uploadProfilePicture = async (req, res) => {
    try {
        // Check if file exists
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an image' });
        }

        // Validate file type
        if (!imageValidation.allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                message: 'Invalid file type. Allowed types: JPG, JPEG, PNG,wepb'
            });
        }

        // Validate file size
        if (req.file.size > imageValidation.maxSize) {
            return res.status(400).json({
                message: 'File size too large. Maximum size: 5MB'
            });
        }

        const userId = req.user.userId;

        // Get user record
        const user = await userModel.findByPk(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Upload image to cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'warehouse/profiles'
        });

        // Delete old profile picture from cloudinary if exists
        if (user.profilePicture) {
            // Extract public_id from the URL
            const publicId = user.profilePicture.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`warehouse/profiles/${publicId}`);
        }

        // Update user profile picture
        await user.update({ profilePicture: result.secure_url });

        return res.status(200).json({
            message: 'Profile picture uploaded successfully',
            profilePicture: result.secure_url
        });
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};