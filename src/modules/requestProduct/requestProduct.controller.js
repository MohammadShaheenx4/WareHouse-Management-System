import requestProductModel from "../../../DB/Models/requestProduct.model.js";
import productModel from "../../../DB/Models/product.model.js";
import categoryModel from "../../../DB/Models/category.model.js";
import supplierModel from "../../../DB/Models/supplier.model.js";
import userModel from "../../../DB/Models/user.model.js";
import productSupplierModel from "../../../DB/Models/productSupplier.model.js";
import cloudinary from "../../utils/cloudinary.js";
import {
    createRequestProductSchema,
    updateRequestStatusSchema,
    validateRequestId,
    fileValidation
} from "./requestProduct.validation.js";

/**
 * @desc    Create a new product request by supplier
 * @route   POST /api/product-requests
 * @access  Supplier
 */
export const createProductRequest = async (req, res) => {
    try {
        // Debug: Check if user is available
        console.log('User in request:', req.user);

        // Validate request body
        const { error } = createRequestProductSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        // Validate file if exists
        if (req.file) {
            const fileValidationResult = fileValidation.validate(req.file);
            if (fileValidationResult.error) {
                return res.status(400).json({ message: fileValidationResult.error.details[0].message });
            }
        }

        const {
            name, costPrice, sellPrice,
            categoryId, categoryName, barcode,
            warranty, prodDate, expDate, description
        } = req.body;

        // Check if user object exists
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: 'Authentication error: User not found in request' });
        }

        // Get supplier ID from authenticated user
        const supplier = await supplierModel.findOne({
            where: { userId: req.user.userId }
        });

        if (!supplier) {
            return res.status(403).json({ message: 'Only suppliers can create product requests' });
        }

        // Handle category lookup
        let finalCategoryId = categoryId;
        if (categoryName && !categoryId) {
            const category = await categoryModel.findOne({
                where: { categoryName: categoryName }
            });

            if (!category) {
                return res.status(404).json({ message: `Category '${categoryName}' not found` });
            }
            finalCategoryId = category.categoryID;
        }

        // Verify category exists
        const category = await categoryModel.findByPk(finalCategoryId);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        // Check for duplicate barcode in both product and requestProduct tables
        if (barcode) {
            const existingProduct = await productModel.findOne({
                where: { barcode }
            });
            const existingRequest = await requestProductModel.findOne({
                where: { barcode, status: 'Pending' }
            });

            if (existingProduct || existingRequest) {
                return res.status(400).json({
                    message: `Barcode ${barcode} already exists in the system. Please use a unique barcode.`
                });
            }
        }

        // Create product request
        const productRequest = await requestProductModel.create({
            name,
            costPrice,
            sellPrice,
            categoryId: finalCategoryId,
            supplierId: supplier.id,
            barcode: barcode || null,
            warranty: warranty || null,
            prodDate: prodDate || null,
            expDate: expDate || null,
            description: description || null,
            status: 'Pending'
        });

        // Upload image to cloudinary if provided
        if (req.file) {
            const { secure_url } = await cloudinary.uploader.upload(req.file.path, {
                folder: 'warehouse/productRequestImages'
            });
            await productRequest.update({ image: secure_url });
        }

        // Get the created request with associations
        const createdRequest = await requestProductModel.findByPk(productRequest.requestId, {
            include: [
                {
                    model: categoryModel,
                    as: 'category',
                    attributes: ['categoryID', 'categoryName']
                },
                {
                    model: supplierModel,
                    as: 'supplier',
                    attributes: ['id', 'userId', 'accountBalance'],
                    include: [
                        {
                            model: userModel,
                            as: 'user',
                            attributes: ['userId', 'name', 'email']
                        }
                    ]
                }
            ]
        });

        return res.status(201).json({
            message: 'Product request created successfully',
            productRequest: createdRequest
        });
    } catch (error) {
        console.error('Error creating product request:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get all product requests (with filters)
 * @route   GET /api/product-requests
 * @access  Admin
 */
export const getProductRequests = async (req, res) => {
    try {
        const { status, supplierId } = req.query;
        const where = {};

        if (status) {
            where.status = status;
        }

        if (supplierId) {
            where.supplierId = supplierId;
        }

        const productRequests = await requestProductModel.findAll({
            where,
            include: [
                {
                    model: categoryModel,
                    as: 'category',
                    attributes: ['categoryID', 'categoryName']
                },
                {
                    model: supplierModel,
                    as: 'supplier',
                    attributes: ['id', 'userId', 'accountBalance'],
                    include: [
                        {
                            model: userModel,
                            as: 'user',
                            attributes: ['userId', 'name', 'email']
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        return res.status(200).json({
            message: 'Product requests retrieved successfully',
            productRequests
        });
    } catch (error) {
        console.error('Error getting product requests:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get single product request by ID
 * @route   GET /api/product-requests/:requestId
 * @access  Admin/Supplier
 */
export const getProductRequestById = async (req, res) => {
    try {
        const { error } = validateRequestId.validate(req.params);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const productRequest = await requestProductModel.findByPk(req.params.requestId, {
            include: [
                {
                    model: categoryModel,
                    as: 'category',
                    attributes: ['categoryID', 'categoryName']
                },
                {
                    model: supplierModel,
                    as: 'supplier',
                    attributes: ['id', 'userId', 'accountBalance'],
                    include: [
                        {
                            model: userModel,
                            as: 'user',
                            attributes: ['userId', 'name', 'email']
                        }
                    ]
                }
            ]
        });

        if (!productRequest) {
            return res.status(404).json({ message: 'Product request not found' });
        }

        // Check if supplier can only view their own requests
        if (req.supplier && req.supplier.id !== productRequest.supplierId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        return res.status(200).json({
            message: 'Product request retrieved successfully',
            productRequest
        });
    } catch (error) {
        console.error('Error getting product request:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Update product request status (Accept/Decline)
 * @route   PATCH /api/product-requests/:requestId/status
 * @access  Admin
 */
export const updateProductRequestStatus = async (req, res) => {
    try {
        // Validate request ID
        const idValidation = validateRequestId.validate(req.params);
        if (idValidation.error) {
            return res.status(400).json({ message: idValidation.error.details[0].message });
        }

        // Validate status update
        const { error } = updateRequestStatusSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const { status, adminNote } = req.body;

        // Find the product request
        const productRequest = await requestProductModel.findByPk(req.params.requestId);
        if (!productRequest) {
            return res.status(404).json({ message: 'Product request not found' });
        }

        // Check if already processed
        if (productRequest.status !== 'Pending') {
            return res.status(400).json({ message: 'This request has already been processed' });
        }

        // Update status
        await productRequest.update({
            status,
            adminNote: adminNote || null
        });

        // If accepted, create the product
        if (status === 'Accepted') {
            // Create product with quantity 0 (as per requirement)
            const newProduct = await productModel.create({
                name: productRequest.name,
                costPrice: productRequest.costPrice,
                sellPrice: productRequest.sellPrice,
                quantity: 0, // Default quantity as per requirement
                categoryId: productRequest.categoryId,
                status: 'Active',
                barcode: productRequest.barcode,
                warranty: productRequest.warranty,
                prodDate: productRequest.prodDate,
                expDate: productRequest.expDate,
                description: productRequest.description,
                image: productRequest.image
            });

            // Create product-supplier association with priceSupplier set to costPrice
            await productSupplierModel.create({
                productId: newProduct.productId,
                supplierId: productRequest.supplierId,
                priceSupplier: newProduct.costPrice, // Set priceSupplier equal to costPrice
                status: 'Active' // Set default status to Active
            });
        }

        // Get updated request with associations
        const updatedRequest = await requestProductModel.findByPk(productRequest.id, {
            include: [
                {
                    model: categoryModel,
                    as: 'category',
                    attributes: ['categoryID', 'categoryName']
                },
                {
                    model: supplierModel,
                    as: 'supplier',
                    attributes: ['id', 'userId', 'accountBalance'],
                    include: [
                        {
                            model: userModel,
                            as: 'user',
                            attributes: ['userId', 'name', 'email']
                        }
                    ]
                }
            ]
        });

        return res.status(200).json({
            message: `Product request ${status.toLowerCase()} successfully`,
            productRequest: updatedRequest
        });
    } catch (error) {
        console.error('Error updating product request status:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Delete product request
 * @route   DELETE /api/product-requests/:requestId
 * @access  Admin/Supplier (only pending requests)
 */
export const deleteProductRequest = async (req, res) => {
    try {
        const { error } = validateRequestId.validate(req.params);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const productRequest = await requestProductModel.findByPk(req.params.requestId);
        if (!productRequest) {
            return res.status(404).json({ message: 'Product request not found' });
        }

        // Only allow deletion of pending requests
        if (productRequest.status !== 'Pending') {
            return res.status(400).json({ message: 'Only pending requests can be deleted' });
        }

        // If supplier, can only delete their own requests
        if (req.supplier && req.supplier.id !== productRequest.supplierId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Delete image from cloudinary if exists
        if (productRequest.image) {
            const publicId = productRequest.image.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`warehouse/productRequestImages/${publicId}`);
        }

        await productRequest.destroy();

        return res.status(200).json({
            message: 'Product request deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting product request:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get all product requests for a specific supplier
 * @route   GET /api/product-requests/supplier/:supplierId
 * @access  Admin/Supplier (own requests only)
 */
export const getSupplierProductRequests = async (req, res) => {
    try {
        const { supplierId } = req.params;

        // Validate supplier ID
        if (!supplierId || isNaN(supplierId)) {
            return res.status(400).json({ message: 'Invalid supplier ID' });
        }

        // Check if supplier exists
        const supplier = await supplierModel.findByPk(supplierId, {
            include: [{
                model: userModel,
                as: 'user',
                attributes: ['userId', 'name']
            }]
        });

        if (!supplier) {
            return res.status(404).json({ message: 'Supplier not found' });
        }

        // Check if supplier is requesting their own requests
        if (req.supplier && req.supplier.id !== parseInt(supplierId)) {
            return res.status(403).json({ message: 'Access denied. Suppliers can only view their own requests' });
        }

        // Get all product requests for this supplier
        const productRequests = await requestProductModel.findAll({
            where: { supplierId },
            include: [
                {
                    model: categoryModel,
                    as: 'category',
                    attributes: ['categoryName']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Format the response to include only the specified fields
        const formattedRequests = productRequests.map(request => {
            const plainRequest = request.get({ plain: true });

            return {
                id: plainRequest.id,
                name: plainRequest.name,
                image: plainRequest.image,
                categoryName: plainRequest.category ? plainRequest.category.categoryName : null,
                status: plainRequest.status,
                costPrice: plainRequest.costPrice,
                createdAt: plainRequest.createdAt,
                adminNote: plainRequest.adminNote

            };
        });

        return res.status(200).json({
            message: 'Supplier product requests retrieved successfully',
            supplier: {
                id: supplier.id,
                name: supplier.user.name
            },
            productRequests: formattedRequests
        });
    } catch (error) {
        console.error('Error fetching supplier product requests:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};