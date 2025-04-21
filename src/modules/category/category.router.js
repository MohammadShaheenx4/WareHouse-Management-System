import { Router } from "express";
import * as controller from './category.controller.js';
import Auth from "../../middleware/authMiddleware.js";
import fileUpload, { fileValidation } from "../../utils/multer.js";

const router = Router();

router.get('/getall', controller.getAllCategories);
router.get('/:id', controller.getCategoryById);
router.get('/:id/products', controller.getProductsByCategory);

// Admin only routes - requires admin privileges
router.post('/add', fileUpload(fileValidation.image).single('image'), controller.createCategory);
router.put('/:id', Auth.adminOnly, fileUpload(fileValidation.image).single('image'), controller.updateCategory);
router.delete('/:id', Auth.adminOnly, controller.deleteCategory);


//


export default router;