import { Router } from 'express';
import * as requestProductController from './requestProduct.controller.js';
import fileUpload, { fileValidation } from '../../utils/multer.js';
import Auth from '../../middleware/authMiddleware.js';


const router = Router();

// Create product request (Supplier only)
router.post('/',
    Auth.isAuthenticated,
    Auth.isSupplier,
    fileUpload(fileValidation.image).single('image'),
    requestProductController.createProductRequest
);

// Get all product requests with filters (Admin only)
router.get('/',
    Auth.isAuthenticated,
    Auth.isAdmin,
    requestProductController.getProductRequests
);

// Get single product request by ID (Admin or Supplier)
router.get('/:requestId',
    Auth.isAuthenticated,
    Auth.isAdminOrSupplier,
    requestProductController.getProductRequestById
);

// Update product request status (Admin only)
router.patch('/:requestId/status',

    requestProductController.updateProductRequestStatus
);

// Delete product request (Admin or Supplier for pending requests only)
router.delete('/:requestId',
    Auth.isAuthenticated,
    Auth.isAdminOrSupplier,
    requestProductController.deleteProductRequest
);

export default router;