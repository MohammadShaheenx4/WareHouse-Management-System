import { Router } from 'express';
import * as controller from './user.controller.js';
import fileUpload, { fileValidation } from '../../utils/multer.js';
import Auth from '../../middleware/authMiddleware.js';

const router = Router();

// =================== USER PROFILE ROUTES ===================

/**
 * @desc    Get current user's profile
 * @route   GET /api/user/profile
 * @access  Authenticated
 */
router.get('/profile',
    Auth.isAuthenticated,
    controller.getUserProfile
);

/**
 * @desc    Update current user's profile
 * @route   PUT /api/user/profile
 * @access  Authenticated
 */
router.put('/profile',
    Auth.isAuthenticated,
    fileUpload(fileValidation.image).single('profilePicture'),
    controller.updateUserProfile
);

/**
 * @desc    Get user by ID
 * @route   GET /api/user/:userId
 * @access  Authenticated (Admin or own profile)
 */
router.get('/:userId',
    Auth.isAuthenticated,
    controller.getUserById
);

/**
 * @desc    Change password
 * @route   PUT /api/user/change-password
 * @access  Authenticated
 */
router.put('/change-password',
    Auth.isAuthenticated,
    controller.changePassword
);

export default router;