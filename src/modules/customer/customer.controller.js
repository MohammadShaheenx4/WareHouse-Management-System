import customerModel from "../../../DB/Models/customer.model.js";
import userModel from "../../../DB/Models/user.model.js";
import bcrypt from 'bcryptjs';
import { updateCustomerProfileSchema } from ".//customer.validation.js";
import cloudinary from "../../utils/cloudinary.js";
import sequelize from "../../../DB/Connection.js";

/**
 * @desc    Get customer profile
 * @route   GET /api/customer/profile
 * @access  Customer
 */
export const getCustomerProfile = async (req, res) => {
    try {
        // Check if user object exists
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: 'Authentication error: User not found in request' });
        }

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
        // Check if user object exists
        if (!req.user || !req.user.userId) {
            await transaction.rollback();
            return res.status(401).json({ message: 'Authentication error: User not found in request' });
        }

        // Validate request body
        const { error } = updateCustomerProfileSchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({ message: error.details[0].message });
        }

        const userId = req.user.userId;
        const {
            email, phoneNumber, address, latitude, longitude,
            currentPassword, newPassword
        } = req.body;

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

        // Handle password changes
        if (currentPassword && newPassword) {
            // Verify current password
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

            if (!isPasswordValid) {
                await transaction.rollback();
                return res.status(401).json({ message: 'Current password is incorrect' });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            userUpdateData.password = hashedPassword;
        }

        // Process profile picture update if file uploaded - simplified approach like updateUser
        if (req.file) {
            try {
                const { secure_url } = await cloudinary.uploader.upload(req.file.path, {
                    folder: 'warehouse/profiles'
                });
                userUpdateData.profilePicture = secure_url;
            } catch (cloudinaryError) {
                console.error('Error uploading to cloudinary:', cloudinaryError);
                await transaction.rollback();
                return res.status(500).json({ message: 'Error uploading profile picture. Please try again.' });
            }
        }

        // Process regular profile updates
        if (email) userUpdateData.email = email;
        if (phoneNumber) userUpdateData.phoneNumber = phoneNumber;

        if (address) customerUpdateData.address = address;
        if (latitude !== undefined) customerUpdateData.latitude = latitude;
        if (longitude !== undefined) customerUpdateData.longitude = longitude;

        // Apply updates if there are any changes
        if (Object.keys(userUpdateData).length > 0) {
            await user.update(userUpdateData, { transaction });
        }

        if (Object.keys(customerUpdateData).length > 0) {
            await customer.update(customerUpdateData, { transaction });
        }

        // If no updates were made, inform the user
        if (Object.keys(userUpdateData).length === 0 &&
            Object.keys(customerUpdateData).length === 0 &&
            !req.file) {
            await transaction.rollback();
            return res.status(400).json({ message: 'No updates provided' });
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

        // Prepare response message
        let successMessage = 'Profile updated successfully';
        if (currentPassword && newPassword) successMessage += ' with password change';
        if (req.file) successMessage += ' with new profile picture';

        return res.status(200).json({
            message: successMessage,
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