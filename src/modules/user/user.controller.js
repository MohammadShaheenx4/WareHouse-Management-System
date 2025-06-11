import userModel from "../../../DB/Models/user.model.js";
import bcrypt from 'bcryptjs';
import { updateUserProfileSchema } from "./user.valdiation.js";
import cloudinary from "../../utils/cloudinary.js";
import sequelize from "../../../DB/Connection.js";

/**
 * @desc    Get user profile
 * @route   GET /api/user/profile
 * @access  Authenticated
 */
export const getUserProfile = async (req, res) => {
    try {
        // Check if user object exists
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: 'Authentication error: User not found in request' });
        }

        // Get user information
        const user = await userModel.findByPk(req.user.userId, {
            attributes: [
                'userId', 'name', 'email', 'phoneNumber',
                'isActive', 'roleName', 'registrationDate', 'profilePicture'
            ]
        });

        if (!user) {
            return res.status(404).json({ message: 'User profile not found' });
        }

        return res.status(200).json({
            message: 'User profile retrieved successfully',
            user: {
                userId: user.userId,
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                isActive: user.isActive,
                roleName: user.roleName,
                registrationDate: user.registrationDate,
                profilePicture: user.profilePicture
            }
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/user/profile
 * @access  Authenticated
 */
export const updateUserProfile = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        // Check if user object exists
        if (!req.user || !req.user.userId) {
            await transaction.rollback();
            return res.status(401).json({ message: 'Authentication error: User not found in request' });
        }

        // Validate request body
        const { error } = updateUserProfileSchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({ message: error.details[0].message });
        }

        const userId = req.user.userId;
        const {
            name, email, phoneNumber,
            currentPassword, newPassword
        } = req.body;

        // Get user record
        const user = await userModel.findByPk(userId);

        if (!user) {
            await transaction.rollback();
            return res.status(404).json({ message: 'User profile not found' });
        }

        // Check if email is already in use by another user
        if (email && email !== user.email) {
            const existingUser = await userModel.findOne({ where: { email } });
            if (existingUser && existingUser.userId !== userId) {
                await transaction.rollback();
                return res.status(400).json({ message: 'Email already in use by another account' });
            }
        }

        // Create update object
        const updateData = {};

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
            updateData.password = hashedPassword;
        }

        // Handle file upload for profile picture
        let profilePictureFile = null;

        // Check for file in different ways based on multer configuration
        if (req.file) {
            // If using .single('profilePicture')
            profilePictureFile = req.file;
        } else if (req.files) {
            // If using .any() or .fields()
            if (Array.isArray(req.files)) {
                // .any() returns array
                profilePictureFile = req.files.find(file => file.fieldname === 'profilePicture');
            } else if (req.files.profilePicture) {
                // .fields() returns object
                profilePictureFile = req.files.profilePicture[0];
            }
        }

        // Process profile picture update if file uploaded
        if (profilePictureFile) {
            try {
                const { secure_url } = await cloudinary.uploader.upload(profilePictureFile.path, {
                    folder: 'warehouse/profiles'
                });
                updateData.profilePicture = secure_url;
            } catch (cloudinaryError) {
                console.error('Error uploading to cloudinary:', cloudinaryError);
                await transaction.rollback();
                return res.status(500).json({ message: 'Error uploading profile picture. Please try again.' });
            }
        }

        // Process regular profile updates
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (phoneNumber) updateData.phoneNumber = phoneNumber;

        // Apply updates if there are any changes
        if (Object.keys(updateData).length === 0 && !profilePictureFile) {
            await transaction.rollback();
            return res.status(400).json({ message: 'No updates provided' });
        }

        await user.update(updateData, { transaction });

        // Commit the transaction
        await transaction.commit();

        // Get updated user profile (excluding password)
        const updatedUser = await userModel.findByPk(userId, {
            attributes: [
                'userId', 'name', 'email', 'phoneNumber',
                'isActive', 'roleName', 'registrationDate', 'profilePicture'
            ]
        });

        // Prepare response message
        let successMessage = 'Profile updated successfully';
        if (currentPassword && newPassword) successMessage += ' with password change';
        if (profilePictureFile) successMessage += ' with new profile picture';

        return res.status(200).json({
            message: successMessage,
            user: updatedUser
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating user profile:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get user's basic info (for other users/admins)
 * @route   GET /api/user/:userId
 * @access  Authenticated (Admin or specific roles)
 */
export const getUserById = async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate user ID
        if (!userId || isNaN(userId)) {
            return res.status(400).json({ message: 'Valid user ID is required' });
        }

        // Check if requesting user has permission (admin or requesting own profile)
        if (req.user.roleName !== 'Admin' && req.user.userId !== parseInt(userId)) {
            return res.status(403).json({ message: 'Access denied. You can only view your own profile' });
        }

        // Get user information (limited fields for privacy)
        const user = await userModel.findByPk(userId, {
            attributes: [
                'userId', 'name', 'email', 'phoneNumber',
                'isActive', 'roleName', 'registrationDate', 'profilePicture'
            ]
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // If not admin, hide sensitive information
        let userResponse = user;
        if (req.user.roleName !== 'Admin' && req.user.userId !== parseInt(userId)) {
            userResponse = {
                userId: user.userId,
                name: user.name,
                roleName: user.roleName,
                profilePicture: user.profilePicture
            };
        }

        return res.status(200).json({
            message: 'User information retrieved successfully',
            user: userResponse
        });
    } catch (error) {
        console.error('Error fetching user by ID:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Change user password (separate endpoint)
 * @route   PUT /api/user/change-password
 * @access  Authenticated
 */
export const changePassword = async (req, res) => {
    try {
        // Check if user object exists
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: 'Authentication error: User not found in request' });
        }

        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Validate required fields
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                message: 'Current password, new password, and confirm password are required'
            });
        }

        // Validate new password length
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters long' });
        }

        // Check if new password matches confirmation
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'New password and confirm password do not match' });
        }

        const userId = req.user.userId;

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
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};