import productModel from "../../../DB/Models/product.model.js";
import categoryModel from "../../../DB/Models/category.model.js";
import productBatchModel from "../../../DB/Models/productPatch.model.js";
import cloudinary from "../../utils/cloudinary.js";
import { Op } from "sequelize";
import sequelize from "../../../DB/Connection.js";
import { createProductSchema, updateProductSchema, validateProductId, fileValidation } from "./product.validation.js";
import productSupplierModel from "../../../DB/Models/productSupplier.model.js";
import supplierModel from "../../../DB/Models/supplier.model.js";
import userModel from "../../../DB/Models/user.model.js";
import { checkExistingBatches, createProductBatch, generateBatchNumber } from "../../utils/batchManagement.js";
import cors from 'cors'

/**
 * @desc    Create a new product with automatic batch creation
 * @route   POST /api/products
 * @access  Admin
 */
export const createProduct = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        // Validate request body
        const { error } = createProductSchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({ message: error.details[0].message });
        }

        // Validate file if exists
        if (req.file) {
            const fileValidationResult = fileValidation.validate(req.file);
            if (fileValidationResult.error) {
                await transaction.rollback();
                return res.status(400).json({ message: fileValidationResult.error.details[0].message });
            }
        }

        let {
            name, costPrice, sellPrice, quantity,
            categoryId, categoryName, status = 'Active', barcode,
            warranty, prodDate, expDate, description,
            supplierIds, supplierNames, lowStock = 10, unit,
            supplierOrderId // Optional supplier order reference
        } = req.body;

        // Check for duplicate barcode if provided
        if (barcode) {
            const existingProduct = await productModel.findOne({
                where: { barcode }
            });

            if (existingProduct) {
                await transaction.rollback();
                return res.status(400).json({
                    message: `Barcode ${barcode} already exists in the system. Please use a unique barcode.`
                });
            }
        }

        // Convert supplierNames to array if it's not
        if (supplierNames && !Array.isArray(supplierNames)) {
            supplierNames = [supplierNames];
        }

        // Convert supplierIds to array if it's not
        if (supplierIds && !Array.isArray(supplierIds)) {
            supplierIds = [supplierIds];
        }

        // If categoryName is provided, find the corresponding categoryId
        if (categoryName && !categoryId) {
            const category = await categoryModel.findOne({
                where: { categoryName: categoryName }
            });

            if (!category) {
                await transaction.rollback();
                return res.status(404).json({ message: `Category '${categoryName}' not found` });
            }

            categoryId = category.categoryID;
        }

        // Double check if category exists
        const category = await categoryModel.findByPk(categoryId);
        if (!category) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Category not found' });
        }

        let finalSupplierIds = [];

        // If supplierNames is provided, convert them to supplier IDs by looking up users first
        if (supplierNames && Array.isArray(supplierNames) && supplierNames.length > 0) {
            // First find the users by name
            const users = await userModel.findAll({
                where: {
                    name: {
                        [Op.in]: supplierNames
                    }
                }
            });

            if (users.length === 0) {
                await transaction.rollback();
                return res.status(404).json({
                    message: `No users found with names: ${supplierNames.join(', ')}`
                });
            }

            // Now find suppliers that have userIds matching these users
            const userIds = users.map(user => user.userId);
            const suppliersByName = await supplierModel.findAll({
                where: {
                    userId: {
                        [Op.in]: userIds
                    }
                },
                include: [{
                    model: userModel,
                    as: 'user',
                    attributes: ['userId', 'name']
                }]
            });

            // Get IDs from found suppliers
            const foundSupplierIds = suppliersByName.map(supplier => supplier.id);

            // Check if at least one supplier was found
            if (foundSupplierIds.length === 0) {
                await transaction.rollback();
                return res.status(404).json({
                    message: `No suppliers found with names: ${supplierNames.join(', ')}`
                });
            }

            // Check if all supplier names were found
            const foundNames = suppliersByName.map(supplier => supplier.user.name);
            const notFoundNames = supplierNames.filter(name =>
                !foundNames.includes(name)
            );

            if (notFoundNames.length > 0) {
                await transaction.rollback();
                return res.status(404).json({
                    message: `The following suppliers were not found: ${notFoundNames.join(', ')}`
                });
            }

            finalSupplierIds = [...foundSupplierIds];
        }

        // If supplierIds is provided, verify they exist and add to finalSupplierIds
        if (supplierIds && Array.isArray(supplierIds) && supplierIds.length > 0) {
            // Convert string IDs to numbers if needed
            const numericSupplierIds = supplierIds.map(id =>
                typeof id === 'string' ? parseInt(id) : id
            );

            const suppliers = await supplierModel.findAll({
                where: {
                    id: {
                        [Op.in]: numericSupplierIds
                    }
                }
            });

            // Check if all supplier IDs were found
            if (suppliers.length !== numericSupplierIds.length) {
                const foundIds = suppliers.map(supplier => supplier.id);
                const notFoundIds = numericSupplierIds.filter(id => !foundIds.includes(id));

                await transaction.rollback();
                return res.status(404).json({
                    message: `The following supplier IDs were not found: ${notFoundIds.join(', ')}`
                });
            }

            // Add to finalSupplierIds, avoiding duplicates
            finalSupplierIds = [...new Set([...finalSupplierIds, ...numericSupplierIds])];
        }

        // Create product without image initially
        const newProduct = await productModel.create({
            name,
            costPrice,
            sellPrice,
            quantity,
            lowStock: lowStock || 10, // Include lowStock field
            unit: unit || null, // Include unit field
            categoryId,
            status,
            barcode: barcode || null,
            warranty: warranty || null,
            prodDate: prodDate || null,
            expDate: expDate || null,
            description: description || null
        }, { transaction });

        // NEW: Create batch if product has quantity > 0
        let batchCreated = false;
        if (quantity > 0) {
            // Determine which supplier provided this initial stock
            const primarySupplierId = finalSupplierIds.length > 0 ? finalSupplierIds[0] : null;

            // Auto-generate batch number
            const batchNumber = await generateBatchNumber(newProduct.productId, prodDate);

            const batchData = {
                productId: newProduct.productId,
                quantity: quantity,
                prodDate: prodDate || null,
                expDate: expDate || null,
                supplierId: primarySupplierId,
                supplierOrderId: supplierOrderId || null,
                costPrice: costPrice,
                batchNumber: batchNumber,
                notes: `Initial stock batch created with product`
            };

            await createProductBatch(batchData, transaction);
            batchCreated = true;
        }

        // Associate suppliers with the product
        if (finalSupplierIds.length > 0) {
            const productSupplierEntries = finalSupplierIds.map(supplierId => ({
                productId: newProduct.productId,
                supplierId,
                priceSupplier: newProduct.costPrice, // Set priceSupplier equal to costPrice
                status: 'Active' // Set default status to Active
            }));

            await productSupplierModel.bulkCreate(productSupplierEntries, { transaction });
        }

        // Upload image to cloudinary if provided
        if (req.file) {
            const { secure_url } = await cloudinary.uploader.upload(req.file.path, {
                folder: 'warehouse/productImages'
            });

            // Update product with image URL
            await newProduct.update({ image: secure_url }, { transaction });
        }

        // Commit transaction
        await transaction.commit();

        // Get the created product with category and supplier information including batches
        const createdProduct = await productModel.findByPk(newProduct.productId, {
            include: [
                {
                    model: categoryModel,
                    as: 'category',
                    attributes: ['categoryID', 'categoryName']
                },
                {
                    model: productBatchModel,
                    as: 'batches',
                    where: { status: 'Active' },
                    required: false
                },
                {
                    model: supplierModel,
                    as: 'suppliers',
                    attributes: ['id', 'userId', 'accountBalance'],
                    through: { attributes: [] }, // Don't include join table attributes
                    include: [
                        {
                            model: userModel,
                            as: 'user',
                            attributes: ['userId', 'name', 'email', 'phoneNumber']
                        }
                    ]
                }
            ]
        });

        // Check if the created product is already low stock and trigger alert
        const lowStockAlert = newProduct.quantity <= newProduct.lowStock ? {
            message: `Product is below low stock threshold (${newProduct.quantity}/${newProduct.lowStock})`,
            isLowStock: true
        } : { isLowStock: false };

        if (lowStockAlert.isLowStock) {
            console.warn(`ALERT: Product "${newProduct.name}" is below low stock threshold (${newProduct.quantity}/${newProduct.lowStock})`);
        }

        return res.status(201).json({
            message: 'Product created successfully with batch tracking',
            product: createdProduct,
            lowStockAlert,
            batchInfo: {
                created: batchCreated,
                quantity: quantity,
                dates: {
                    prodDate: prodDate || null,
                    expDate: expDate || null
                }
            }
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error creating product:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Update product with batch conflict checking
 * @route   PUT /api/products/:id
 * @access  Admin
 */
// Add this middleware before your route
const handleFileUploadErrors = (uploadMiddleware) => {
    return (req, res, next) => {
        uploadMiddleware(req, res, (err) => {
            if (err) {
                // Store the error in req object instead of throwing
                req.fileUploadError = err;
            }
            next(); // Always continue to the next middleware
        });
    };
};

// Update your route to use this middleware:
// router.put('/:id', Auth.adminOnly, handleFileUploadErrors(fileUpload(fileValidation.image).single('image')), controller.updateProduct);

export const updateProduct = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        // Handle multer errors gracefully for optional file uploads
        if (req.fileUploadError) {
            console.log('File upload error handled:', req.fileUploadError);
            // For missing field name errors, continue without file
            if (req.fileUploadError.message === 'Field name missing' ||
                req.fileUploadError.code === 'LIMIT_UNEXPECTED_FILE') {
                req.file = null; // Set file to null and continue
            } else {
                await transaction.rollback();
                return res.status(400).json({
                    message: `File upload error: ${req.fileUploadError.message}`
                });
            }
        }

        // Validate ID parameter
        const idValidation = validateProductId.validate({ id: req.params.id });
        if (idValidation.error) {
            await transaction.rollback();
            return res.status(400).json({ message: idValidation.error.details[0].message });
        }

        // Check if this is an image-only update
        const hasBodyFields = Object.keys(req.body).length > 0;
        const hasImageFile = req.file !== null && req.file !== undefined;

        // If there's no body data and no image, return error
        if (!hasBodyFields && !hasImageFile) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Please provide at least one field to update or an image file'
            });
        }

        // Only validate request body if there are fields to validate
        if (hasBodyFields) {
            const { error } = updateProductSchema.validate(req.body);
            if (error) {
                await transaction.rollback();
                return res.status(400).json({ message: error.details[0].message });
            }
        }

        // Validate file if exists (only validate if file is present)
        if (req.file) {
            const fileValidationResult = fileValidation.validate(req.file);
            if (fileValidationResult.error) {
                await transaction.rollback();
                return res.status(400).json({ message: fileValidationResult.error.details[0].message });
            }
        }

        const productId = req.params.id;
        const product = await productModel.findByPk(productId);

        if (!product) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Product not found' });
        }

        let {
            name, costPrice, sellPrice, quantity,
            categoryId, categoryName, status, barcode,
            warranty, prodDate, expDate, description,
            supplierIds, supplierNames, lowStock, unit
        } = req.body;

        // Convert supplierNames to array if it's not
        if (supplierNames && !Array.isArray(supplierNames)) {
            supplierNames = [supplierNames];
        }

        // Convert supplierIds to array if it's not
        if (supplierIds && !Array.isArray(supplierIds)) {
            supplierIds = [supplierIds];
        }

        // If categoryName is provided, find the corresponding categoryId
        if (categoryName && !categoryId) {
            const category = await categoryModel.findOne({
                where: { categoryName: categoryName }
            });

            if (!category) {
                await transaction.rollback();
                return res.status(404).json({ message: `Category '${categoryName}' not found` });
            }

            categoryId = category.categoryID;
        }

        // If updating category, check if it exists
        if (categoryId) {
            const category = await categoryModel.findByPk(categoryId);
            if (!category) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Category not found' });
            }
        }

        // Process supplier information first (same logic as before)
        let finalSupplierIds = [];
        if ((supplierIds && Array.isArray(supplierIds)) || (supplierNames && Array.isArray(supplierNames))) {
            // If supplierNames is provided, convert them to supplier IDs
            if (supplierNames && Array.isArray(supplierNames) && supplierNames.length > 0) {
                const users = await userModel.findAll({
                    where: { name: { [Op.in]: supplierNames } }
                });

                if (users.length === 0) {
                    await transaction.rollback();
                    return res.status(404).json({
                        message: `No users found with names: ${supplierNames.join(', ')}`
                    });
                }

                const userIds = users.map(user => user.userId);
                const suppliersByName = await supplierModel.findAll({
                    where: { userId: { [Op.in]: userIds } },
                    include: [{
                        model: userModel,
                        as: 'user',
                        attributes: ['userId', 'name']
                    }]
                });

                const foundSupplierIds = suppliersByName.map(supplier => supplier.id);
                if (foundSupplierIds.length === 0) {
                    await transaction.rollback();
                    return res.status(404).json({
                        message: `No suppliers found with names: ${supplierNames.join(', ')}`
                    });
                }

                finalSupplierIds = [...foundSupplierIds];
            }

            // If supplierIds is provided, verify they exist
            if (supplierIds && Array.isArray(supplierIds) && supplierIds.length > 0) {
                const numericSupplierIds = supplierIds.map(id =>
                    typeof id === 'string' ? parseInt(id) : id
                );

                const suppliers = await supplierModel.findAll({
                    where: { id: { [Op.in]: numericSupplierIds } }
                });

                if (suppliers.length !== numericSupplierIds.length) {
                    const foundIds = suppliers.map(supplier => supplier.id);
                    const notFoundIds = numericSupplierIds.filter(id => !foundIds.includes(id));

                    await transaction.rollback();
                    return res.status(404).json({
                        message: `The following supplier IDs were not found: ${notFoundIds.join(', ')}`
                    });
                }

                finalSupplierIds = [...new Set([...finalSupplierIds, ...numericSupplierIds])];
            }
        }

        // Update product fields (only if there are body fields to update)
        if (hasBodyFields) {
            const updateData = {
                ...(name !== undefined && { name }),
                ...(costPrice !== undefined && { costPrice }),
                ...(sellPrice !== undefined && { sellPrice }),
                ...(quantity !== undefined && { quantity }),
                ...(lowStock !== undefined && { lowStock }),
                ...(unit !== undefined && { unit }),
                ...(categoryId !== undefined && { categoryId }),
                ...(status !== undefined && { status }),
                ...(barcode !== undefined && { barcode }),
                ...(warranty !== undefined && { warranty }),
                ...(prodDate !== undefined && { prodDate }),
                ...(expDate !== undefined && { expDate }),
                ...(description !== undefined && { description })
            };

            // Only update if there are actual fields to update
            if (Object.keys(updateData).length > 0) {
                await product.update(updateData, { transaction });
            }
        }

        // Handle supplier updates if provided
        if ((supplierIds && Array.isArray(supplierIds)) || (supplierNames && Array.isArray(supplierNames))) {
            // Remove all existing product-supplier associations
            await productSupplierModel.destroy({
                where: { productId }
            });

            // Create new product-supplier associations
            if (finalSupplierIds.length > 0) {
                const productSupplierEntries = finalSupplierIds.map(supplierId => ({
                    productId,
                    supplierId,
                    priceSupplier: costPrice || product.costPrice,
                    status: 'Active'
                }));

                await productSupplierModel.bulkCreate(productSupplierEntries, { transaction });
            }
        }

        // Upload image to cloudinary if provided (only if file exists)
        if (req.file) {
            try {
                const { secure_url } = await cloudinary.uploader.upload(req.file.path, {
                    folder: 'warehouse/productImages'
                });

                // Update product with image URL
                await product.update({ image: secure_url }, { transaction });
            } catch (uploadError) {
                console.error('Cloudinary upload error:', uploadError);
                await transaction.rollback();
                return res.status(500).json({ message: 'Failed to upload image' });
            }
        }

        await transaction.commit();

        // Get updated product with batches and other associations
        const updatedProduct = await productModel.findByPk(productId, {
            include: [
                {
                    model: categoryModel,
                    as: 'category',
                    attributes: ['categoryID', 'categoryName']
                },
                {
                    model: productBatchModel,
                    as: 'batches',
                    where: { status: 'Active' },
                    required: false,
                    order: [['prodDate', 'ASC'], ['receivedDate', 'ASC']]
                },
                {
                    model: supplierModel,
                    as: 'suppliers',
                    attributes: ['id', 'userId', 'accountBalance'],
                    through: { attributes: [] }, // Don't include join table attributes
                    include: [
                        {
                            model: userModel,
                            as: 'user',
                            attributes: ['userId', 'name', 'email', 'phoneNumber']
                        }
                    ]
                }
            ]
        });

        // Check if the updated product is now low stock and trigger alert
        const finalQuantity = updatedProduct.quantity;
        const finalLowStock = updatedProduct.lowStock;

        let lowStockAlert = { isLowStock: false };
        if (finalQuantity <= finalLowStock) {
            lowStockAlert = {
                message: `Product is below low stock threshold (${finalQuantity}/${finalLowStock})`,
                isLowStock: true
            };
            console.warn(`ALERT: Product "${updatedProduct.name}" is below low stock threshold (${finalQuantity}/${finalLowStock})`);
        }

        return res.status(200).json({
            message: 'Product updated successfully',
            product: updatedProduct,
            lowStockAlert,
            updateType: hasBodyFields && hasImageFile ? 'fields_and_image' :
                hasImageFile ? 'image_only' : 'fields_only'
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error updating product:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
// Updated methods to include batch information
export const getAllProducts = async (req, res) => {
    try {
        // Get query parameters for filtering
        const {
            name,
            minPrice,
            maxPrice,
            category, // This can be either category name or ID
            supplier, // This can be either supplier name or ID
            status,
            inStock,
            includeBatches // NEW: Option to include batch info
        } = req.query;

        // Build filter object
        const filter = {};

        if (name) {
            filter.name = { [Op.like]: `%${name}%` };
        }

        if (minPrice || maxPrice) {
            filter.sellPrice = {};
            if (minPrice) filter.sellPrice[Op.gte] = minPrice;
            if (maxPrice) filter.sellPrice[Op.lte] = maxPrice;
        }

        // Handle category filtering by name or ID
        if (category) {
            // Check if category is a number (ID) or string (name)
            if (!isNaN(category)) {
                // If it's a number, filter by categoryId
                filter.categoryId = category;
            } else {
                // If it's a string, find the category by name first
                const categoryObj = await categoryModel.findOne({
                    where: { categoryName: category }
                });

                if (categoryObj) {
                    filter.categoryId = categoryObj.categoryID;
                } else {
                    // If category name doesn't exist, return empty result
                    return res.status(200).json({
                        message: 'Products retrieved successfully',
                        count: 0,
                        products: []
                    });
                }
            }
        }

        if (status) {
            filter.status = status;
        }

        if (inStock === 'true') {
            filter.quantity = { [Op.gt]: 0 };
        }

        // Handle supplier filtering (same logic as before)
        if (supplier) {
            let productIds = [];

            if (!isNaN(supplier)) {
                const productSuppliers = await productSupplierModel.findAll({
                    where: { supplierId: parseInt(supplier) },
                    attributes: ['productId']
                });

                if (productSuppliers.length === 0) {
                    return res.status(200).json({
                        message: 'Products retrieved successfully',
                        count: 0,
                        products: []
                    });
                }

                productIds = productSuppliers.map(ps => ps.productId);
            } else {
                const users = await userModel.findAll({
                    where: { name: { [Op.like]: `%${supplier}%` } }
                });

                if (users.length === 0) {
                    return res.status(200).json({
                        message: 'Products retrieved successfully',
                        count: 0,
                        products: []
                    });
                }

                const suppliers = await supplierModel.findAll({
                    where: { userId: { [Op.in]: users.map(user => user.userId) } }
                });

                if (suppliers.length === 0) {
                    return res.status(200).json({
                        message: 'Products retrieved successfully',
                        count: 0,
                        products: []
                    });
                }

                const productSuppliers = await productSupplierModel.findAll({
                    where: { supplierId: { [Op.in]: suppliers.map(s => s.id) } },
                    attributes: ['productId']
                });

                if (productSuppliers.length === 0) {
                    return res.status(200).json({
                        message: 'Products retrieved successfully',
                        count: 0,
                        products: []
                    });
                }

                productIds = productSuppliers.map(ps => ps.productId);
            }

            filter.productId = { [Op.in]: productIds };
        }

        // Prepare include options for associations
        const includeOptions = [
            {
                model: categoryModel,
                as: 'category',
                attributes: ['categoryID', 'categoryName']
            },
            {
                model: supplierModel,
                as: 'suppliers',
                attributes: ['id', 'userId', 'accountBalance'],
                through: { attributes: [] }, // Don't include join table attributes
                include: [
                    {
                        model: userModel,
                        as: 'user',
                        attributes: ['userId', 'name', 'email', 'phoneNumber']
                    }
                ]
            }
        ];

        // NEW: Optionally include batch information
        if (includeBatches === 'true') {
            includeOptions.push({
                model: productBatchModel,
                as: 'batches',
                where: { status: 'Active', quantity: { [Op.gt]: 0 } },
                required: false,
                order: [['prodDate', 'ASC'], ['receivedDate', 'ASC']]
            });
        }

        // Get products with category and supplier information
        const products = await productModel.findAll({
            where: filter,
            include: includeOptions,
            order: [['createdAt', 'DESC']]
        });

        return res.status(200).json({
            message: 'Products retrieved successfully',
            count: products.length,
            products,
            includedBatches: includeBatches === 'true'
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const getProductById = async (req, res) => {
    try {
        // Validate ID parameter
        const { error } = validateProductId.validate({ id: req.params.id });
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const productId = req.params.id;
        const { includeBatches } = req.query;

        // Prepare include options
        const includeOptions = [
            {
                model: categoryModel,
                as: 'category',
                attributes: ['categoryID', 'categoryName']
            },
            {
                model: supplierModel,
                as: 'suppliers',
                attributes: ['id', 'userId', 'accountBalance'],
                through: { attributes: [] }, // Don't include join table attributes
                include: [
                    {
                        model: userModel,
                        as: 'user',
                        attributes: ['userId', 'name', 'email', 'phoneNumber']
                    }
                ]
            }
        ];

        // NEW: Include batch information by default or when requested
        if (includeBatches !== 'false') {
            includeOptions.push({
                model: productBatchModel,
                as: 'batches',
                order: [['prodDate', 'ASC'], ['receivedDate', 'ASC']]
            });
        }

        // Get product with category and supplier information
        const product = await productModel.findByPk(productId, {
            include: includeOptions
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        return res.status(200).json({
            message: 'Product retrieved successfully',
            product,
            includedBatches: includeBatches !== 'false'
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        // Validate ID parameter
        const { error } = validateProductId.validate({ id: req.params.id });
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const productId = req.params.id;
        const product = await productModel.findByPk(productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Delete the product (this will also delete related batches and product-supplier entries due to CASCADE)
        await product.destroy();

        return res.status(200).json({
            message: 'Product deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting product:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const getLowStockProducts = async (req, res) => {
    try {
        // Default threshold is based on product's lowStock setting, can be overridden
        const threshold = req.query.threshold ? parseInt(req.query.threshold) : null;
        const { includeBatches } = req.query;

        // Build where condition for low stock
        const whereCondition = {
            status: 'Active',
            [Op.or]: [
                // Use product's own lowStock threshold
                sequelize.where(
                    sequelize.col('quantity'),
                    Op.lte,
                    sequelize.col('lowStock')
                )
            ]
        };

        // Add global threshold if provided
        if (threshold) {
            whereCondition[Op.or].push({
                quantity: { [Op.lt]: threshold }
            });
        }

        const includeOptions = [
            {
                model: categoryModel,
                as: 'category',
                attributes: ['categoryID', 'categoryName']
            },
            {
                model: supplierModel,
                as: 'suppliers',
                attributes: ['id', 'userId', 'accountBalance'],
                through: { attributes: [] },
                include: [
                    {
                        model: userModel,
                        as: 'user',
                        attributes: ['userId', 'name', 'email', 'phoneNumber']
                    }
                ]
            }
        ];

        // Include batch information if requested
        if (includeBatches === 'true') {
            includeOptions.push({
                model: productBatchModel,
                as: 'batches',
                where: { status: 'Active', quantity: { [Op.gt]: 0 } },
                required: false,
                order: [['expDate', 'ASC']]
            });
        }

        const products = await productModel.findAll({
            where: whereCondition,
            include: includeOptions,
            order: [['quantity', 'ASC']]
        });

        return res.status(200).json({
            message: 'Low stock products retrieved successfully',
            count: products.length,
            products,
            thresholdUsed: threshold || 'Product-specific lowStock values',
            includedBatches: includeBatches === 'true'
        });
    } catch (error) {
        console.error('Error fetching low stock products:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const getDashboardStats = async (req, res) => {
    try {
        // Run all queries in parallel for better performance
        const [
            totalProducts,
            activeProducts,
            inactiveProducts,
            totalCategories,
            lowStockProducts,
            expiringBatches,
            totalBatches
        ] = await Promise.all([
            // Get total number of products
            productModel.count(),

            // Get number of active products
            productModel.count({
                where: { status: 'Active' }
            }),

            // Get number of inactive products
            productModel.count({
                where: { status: 'NotActive' }
            }),

            // Get total number of categories
            categoryModel.count(),

            // NEW: Get low stock products count
            productModel.count({
                where: {
                    status: 'Active',
                    [Op.or]: [
                        sequelize.where(
                            sequelize.col('quantity'),
                            Op.lte,
                            sequelize.col('lowStock')
                        )
                    ]
                }
            }),

            // NEW: Get expiring batches count (next 30 days)
            productBatchModel.count({
                where: {
                    status: 'Active',
                    quantity: { [Op.gt]: 0 },
                    expDate: {
                        [Op.between]: [new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]
                    }
                }
            }),

            // NEW: Get total batches count
            productBatchModel.count({
                where: { status: 'Active' }
            })
        ]);

        return res.status(200).json({
            message: 'Dashboard statistics retrieved successfully',
            stats: {
                totalProducts,
                activeProducts,
                inactiveProducts,
                totalCategories,
                lowStockProducts,
                expiringBatches,
                totalBatches
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard statistics:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};