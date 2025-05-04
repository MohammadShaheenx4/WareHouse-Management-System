import { Router } from 'express';
import * as controller from './customer.controller.js';
import fileUpload, { fileValidation } from '../../utils/multer.js';
import Auth from '../../middleware/authMiddleware.js';

const router = Router();



// Get customer profile
router.get("/profile", Auth.isAuthenticated, controller.getCustomerProfile);

router.put("/profile",
    Auth.isAuthenticated,
    fileUpload(fileValidation.image).single('profilePicture'),
    controller.updateCustomerProfile);

export default router;