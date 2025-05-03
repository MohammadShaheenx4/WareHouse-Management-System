import { Router } from 'express';
import * as controller from './customer.controller.js';
import fileUpload, { fileValidation } from '../../utils/multer.js';
import Auth from '../../middleware/authMiddleware.js';

const router = express.Router();



// Get customer profile
router.get("/profile", Auth.customerOnly, getCustomerProfile);

// Update customer profile
router.put("/profile", Auth.customerOnly, updateCustomerProfile);

// Update customer password
router.put("/password", Auth.customerOnly, updateCustomerPassword);

// Upload profile picture
router.post("/profile-picture", Auth.customerOnly, fileUpload(fileValidation.image).single('profilePicture'), uploadProfilePicture);

export default router;