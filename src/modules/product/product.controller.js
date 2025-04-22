import productModel from "../../../DB/Models/product.model.js";
import categoryModel from "../../../DB/Models/category.model.js";
import cloudinary from "../../utils/cloudinary.js";
import { Op } from "sequelize";
import { createProductSchema, updateProductSchema, validateProductId, fileValidation } from "./product.validation.js";
import productSupplierModel from "../../../DB/Models/productSupplier.model.js";
import supplierModel from "../../../DB/Models/supplier.model.js";
import userModel from "../../../DB/Models/user.model.js";

/**
 * @desc    Create a new product with suppliers
 * @route   POST /api/products
 * @access  Admin
 */
export const createProduct = async (req, res) => {
    try {
        // Validate request body
        const { error } = createProductSchema.validate(req.body);
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

        let {
            name, costPrice, sellPrice, quantity,
            categoryId, categoryName, status = 'Active', barcode,
            warranty, prodDate, expDate, description,
            supplierIds, supplierNames
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
                return res.status(404).json({ message: `Category '${categoryName}' not found` });
            }

            categoryId = category.categoryID;
        }

        // Double check if category exists
        const category = await categoryModel.findByPk(categoryId);
        if (!category) {
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
            categoryId,
            status,
            barcode: barcode || null,
            warranty: warranty || null,
            prodDate: prodDate || null,
            expDate: expDate || null,
            description: description || null
        });

        // Associate suppliers with the product
        if (finalSupplierIds.length > 0) {
            const productSupplierEntries = finalSupplierIds.map(supplierId => ({
                productId: newProduct.productId,
                supplierId
            }));

            await productSupplierModel.bulkCreate(productSupplierEntries);
        }

        // Upload image to cloudinary if provided
        if (req.file) {
            const { secure_url } = await cloudinary.uploader.upload(req.file.path, {
                folder: 'warehouse/productImages'
            });

            // Update product with image URL
            await newProduct.update({ image: secure_url });
        }

        // Get the created product with category and supplier information
        const createdProduct = await productModel.findByPk(newProduct.productId, {
            include: [
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
            ]
        });

        return res.status(201).json({
            message: 'Product created successfully',
            product: createdProduct
        });
    } catch (error) {
        console.error('Error creating product:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get all products
 * @route   GET /api/products
 * @access  Public
 */
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
            inStock
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

        // Handle supplier filtering
        if (supplier) {
            let productIds = [];

            // Check if supplier parameter is a number (ID) or string (name)
            if (!isNaN(supplier)) {
                // It's an ID, find products directly from junction table
                const productSuppliers = await productSupplierModel.findAll({
                    where: { supplierId: parseInt(supplier) },
                    attributes: ['productId']
                });

                if (productSuppliers.length === 0) {
                    // No products with this supplier, return empty result
                    return res.status(200).json({
                        message: 'Products retrieved successfully',
                        count: 0,
                        products: []
                    });
                }

                productIds = productSuppliers.map(ps => ps.productId);
            } else {
                // It's a name, find the users with this name first
                const users = await userModel.findAll({
                    where: { name: { [Op.like]: `%${supplier}%` } }
                });

                if (users.length === 0) {
                    // No users with this name, return empty result
                    return res.status(200).json({
                        message: 'Products retrieved successfully',
                        count: 0,
                        products: []
                    });
                }

                // Find suppliers with these user IDs
                const suppliers = await supplierModel.findAll({
                    where: { userId: { [Op.in]: users.map(user => user.userId) } }
                });

                if (suppliers.length === 0) {
                    // No suppliers for these users, return empty result
                    return res.status(200).json({
                        message: 'Products retrieved successfully',
                        count: 0,
                        products: []
                    });
                }

                // Find products for these suppliers
                const productSuppliers = await productSupplierModel.findAll({
                    where: { supplierId: { [Op.in]: suppliers.map(s => s.id) } },
                    attributes: ['productId']
                });

                if (productSuppliers.length === 0) {
                    // No products with these suppliers, return empty result
                    return res.status(200).json({
                        message: 'Products retrieved successfully',
                        count: 0,
                        products: []
                    });
                }

                productIds = productSuppliers.map(ps => ps.productId);
            }

            // Add product IDs to filter
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

        // Get products with category and supplier information
        const products = await productModel.findAll({
            where: filter,
            include: includeOptions
        });

        return res.status(200).json({
            message: 'Products retrieved successfully',
            count: products.length,
            products
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get product by ID
 * @route   GET /api/products/:id
 * @access  Public
 */
export const getProductById = async (req, res) => {
    try {
        // Validate ID parameter
        const { error } = validateProductId.validate({ id: req.params.id });
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const productId = req.params.id;

        // Get product with category and supplier information
        const product = await productModel.findByPk(productId, {
            include: [
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
            ]
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        return res.status(200).json({
            message: 'Product retrieved successfully',
            product
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Update product
 * @route   PUT /api/products/:id
 * @access  Admin
 */
export const updateProduct = async (req, res) => {
    try {
        // Validate ID parameter
        const idValidation = validateProductId.validate({ id: req.params.id });
        if (idValidation.error) {
            return res.status(400).json({ message: idValidation.error.details[0].message });
        }

        // Validate request body
        const { error } = updateProductSchema.validate(req.body);
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

        const productId = req.params.id;
        const product = await productModel.findByPk(productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        let {
            name, costPrice, sellPrice, quantity,
            categoryId, categoryName, status, barcode,
            warranty, prodDate, expDate, description,
            supplierIds, supplierNames
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
                return res.status(404).json({ message: `Category '${categoryName}' not found` });
            }

            categoryId = category.categoryID;
        }

        // If updating category, check if it exists
        if (categoryId) {
            const category = await categoryModel.findByPk(categoryId);
            if (!category) {
                return res.status(404).json({ message: 'Category not found' });
            }
        }

        // Update with provided fields
        const updateData = {
            ...(name !== undefined && { name }),
            ...(costPrice !== undefined && { costPrice }),
            ...(sellPrice !== undefined && { sellPrice }),
            ...(quantity !== undefined && { quantity }),
            ...(categoryId !== undefined && { categoryId }),
            ...(status !== undefined && { status }),
            ...(barcode !== undefined && { barcode }),
            ...(warranty !== undefined && { warranty }),
            ...(prodDate !== undefined && { prodDate }),
            ...(expDate !== undefined && { expDate }),
            ...(description !== undefined && { description })
        };

        await product.update(updateData);

        // Process supplier information if provided
        if ((supplierIds && Array.isArray(supplierIds)) || (supplierNames && Array.isArray(supplierNames))) {
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
                    return res.status(404).json({
                        message: `No users found with names: ${supplierNames.join(', ')}`
                    });
                }

                // Now find suppliers that have userIds matching these users
                const userIds = users.map(user => user.id);
                const suppliersByName = await supplierModel.findAll({
                    where: {
                        userId: {
                            [Op.in]: userIds
                        }
                    },
                    include: [{
                        model: userModel,
                        as: 'user',
                        attributes: ['id', 'name']
                    }]
                });

                // Get IDs from found suppliers
                const foundSupplierIds = suppliersByName.map(supplier => supplier.id);

                // Check if at least one supplier was found
                if (foundSupplierIds.length === 0) {
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

                    return res.status(404).json({
                        message: `The following supplier IDs were not found: ${notFoundIds.join(', ')}`
                    });
                }

                // Add to finalSupplierIds, avoiding duplicates
                finalSupplierIds = [...new Set([...finalSupplierIds, ...numericSupplierIds])];
            }

            // Remove all existing product-supplier associations
            await productSupplierModel.destroy({
                where: { productId }
            });

            // Create new product-supplier associations
            if (finalSupplierIds.length > 0) {
                const productSupplierEntries = finalSupplierIds.map(supplierId => ({
                    productId,
                    supplierId
                }));

                await productSupplierModel.bulkCreate(productSupplierEntries);
            }
        }

        // Upload image to cloudinary if provided
        if (req.file) {
            const { secure_url } = await cloudinary.uploader.upload(req.file.path, {
                folder: 'warehouse/productImages'
            });

            // Update product with image URL
            await product.update({ image: secure_url });
        }

        // Get updated product with category and supplier information
        const updatedProduct = await productModel.findByPk(productId, {
            include: [
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
                            attributes: ['id', 'name', 'email', 'phone']
                        }
                    ]
                }
            ]
        });

        return res.status(200).json({
            message: 'Product updated successfully',
            product: updatedProduct
        });
    } catch (error) {
        console.error('Error updating product:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Delete product
 * @route   DELETE /api/products/:id
 * @access  Admin
 */
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

        // Delete the product (this will also delete related product-supplier entries due to CASCADE)
        await product.destroy();

        return res.status(200).json({
            message: 'Product deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting product:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get low stock products
 * @route   GET /api/products/low-stock
 * @access  Admin
 */
export const getLowStockProducts = async (req, res) => {
    try {
        // Default threshold is 10, can be changed via query parameter
        const threshold = req.query.threshold ? parseInt(req.query.threshold) : 10;

        const products = await productModel.findAll({
            where: {
                quantity: { [Op.lt]: threshold },
                status: 'Active'
            },
            include: [
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
                            attributes: ['id', 'name', 'email', 'phone']
                        }
                    ]
                }
            ],
            order: [['quantity', 'ASC']]
        });

        return res.status(200).json({
            message: 'Low stock products retrieved successfully',
            count: products.length,
            products
        });
    } catch (error) {
        console.error('Error fetching low stock products:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};