import { Router } from 'express';
import * as controller from './customer.controller.js';
import fileUpload, { fileValidation } from '../../utils/multer.js';
import Auth from '../../middleware/authMiddleware.js';

const router = Router();



// Get customer profile
router.get("/profile", Auth.isAuthenticated, controller.getCustomerProfile);

// Update customer profile
router.put("/profile", Auth.isAuthenticated, controller.updateCustomerProfile);

// Update customer password
router.put("/password", controller.updateCustomerPassword);

// Upload profile picture
router.post("/profile-picture", fileUpload(fileValidation.image).single('profilePicture'), controller.uploadProfilePicture);

export default router;