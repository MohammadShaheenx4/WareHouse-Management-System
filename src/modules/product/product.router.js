import { Router } from 'express';
import * as controller from './product.controller.js';
import fileUpload, { fileValidation } from '../../utils/multer.js';
import Auth from '../../middleware/authMiddleware.js';

const router = Router();

// Public routes - no authentication required
router.get('/products', controller.getAllProducts);
router.get('/low-stock', controller.getLowStockProducts);
router.get('/:id', controller.getProductById);

// Admin only routes - requires admin privileges
router.post('/add', Auth.adminOnly, fileUpload(fileValidation.image).single('image'), controller.createProduct);
router.put('/:id', Auth.adminOnly, fileUpload(fileValidation.image).single('image'), controller.updateProduct);
router.delete('/:id', Auth.adminOnly, controller.deleteProduct);

export default router;