import productModel from "../../../DB/Models/product.model.js";
import categoryModel from "../../../DB/Models/category.model.js";
import cloudinary from "../../utils/cloudinary.js";
import { Op } from "sequelize";
import { createProductSchema, updateProductSchema, validateProductId, fileValidation } from "./product.validation.js";

/**
 * @desc    Create a new product
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
            warranty, prodDate, expDate, description
        } = req.body;

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

        // Upload image to cloudinary if provided
        if (req.file) {
            const { secure_url } = await cloudinary.uploader.upload(req.file.path, {
                folder: 'warehouse/productImages'
            });

            // Update product with image URL
            await newProduct.update({ image: secure_url });
        }

        // Get the created product with category information
        const createdProduct = await productModel.findByPk(newProduct.productId, {
            include: [{
                model: categoryModel,
                as: 'category',
                attributes: ['categoryID', 'categoryName']
            }]
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

        // Get products with category information
        const products = await productModel.findAll({
            where: filter,
            include: [{
                model: categoryModel,
                as: 'category',
                attributes: ['categoryID', 'categoryName']
            }]
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

        // Get product with category information
        const product = await productModel.findByPk(productId, {
            include: [{
                model: categoryModel,
                as: 'category',
                attributes: ['categoryID', 'categoryName']
            }]
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
            warranty, prodDate, expDate, description
        } = req.body;

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

        // Upload image to cloudinary if provided
        if (req.file) {
            const { secure_url } = await cloudinary.uploader.upload(req.file.path, {
                folder: 'warehouse/productImages'
            });

            // Update product with image URL
            await product.update({ image: secure_url });
        }

        // Get updated product with category information
        const updatedProduct = await productModel.findByPk(productId, {
            include: [{
                model: categoryModel,
                as: 'category',
                attributes: ['categoryID', 'categoryName']
            }]
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

        // TODO: Check if product is in any orders before deleting
        // If needed, add check here

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
            include: [{
                model: categoryModel,
                as: 'category',
                attributes: ['categoryID', 'categoryName']
            }],
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