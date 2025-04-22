import categoryModel from "../../../DB/Models/category.model.js";
import slugify from 'slugify';
import productModel from "../../../DB/Models/product.model.js";
import cloudinary from "../../utils/cloudinary.js";
import { Op } from "sequelize"; // Import Sequelize operators
import { createCategorySchema, updateCategorySchema, validateCategoryId, fileValidation } from "./category.validation.js";

/**
 * @desc    Create a new category
 * @route   POST /api/categories
 * @access  Admin
 */
export const createCategory = async (req, res) => {
    try {
        // Validate request body
        const { error } = createCategorySchema.validate(req.body);
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

        const { categoryName, description, status = 'Active' } = req.body;

        // Check if category already exists
        const existingCategory = await categoryModel.findOne({ where: { categoryName } });
        if (existingCategory) {
            return res.status(409).json({ message: 'Category already exists' });
        }


        let secure_url = null; // Define outside with default value

        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'warehouse/categoryImages'
            });
            secure_url = result.secure_url;
        }

        const newCategory = await categoryModel.create({
            categoryName,
            status,
            description, // Include description
            slug: slugify(categoryName, { lower: true }),
            image: secure_url
        });


        return res.status(201).json({
            message: 'Category created successfully',
            category: newCategory
        });
    } catch (error) {
        console.error('Error creating category:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get all categories
 * @route   GET /api/categories
 * @access  Public
 */
export const getAllCategories = async (req, res) => {
    try {
        const categories = await categoryModel.findAll();
        return res.status(200).json({
            message: 'Categories retrieved successfully',
            categories
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get category by ID
 * @route   GET /api/categories/:id
 * @access  Public
 */
export const getCategoryById = async (req, res) => {
    try {
        // Validate ID parameter
        const { error } = validateCategoryId.validate({ id: req.params.id });
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const categoryId = req.params.id;
        const category = await categoryModel.findByPk(categoryId);

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        return res.status(200).json({
            message: 'Category retrieved successfully',
            category
        });
    } catch (error) {
        console.error('Error fetching category:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Update category
 * @route   PUT /api/categories/:id
 * @access  Admin
 */
export const updateCategory = async (req, res) => {
    try {
        // Validate ID parameter
        const idValidation = validateCategoryId.validate({ id: req.params.id });
        if (idValidation.error) {
            return res.status(400).json({ message: idValidation.error.details[0].message });
        }

        // Validate request body
        const { error } = updateCategorySchema.validate(req.body);
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

        const categoryId = req.params.id;
        const category = await categoryModel.findByPk(categoryId);

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        // Update category
        const { categoryName, status, description } = req.body;
        if (categoryName) {
            // Check if updated name already exists in another category
            const existingCategory = await categoryModel.findOne({
                where: {
                    categoryName,
                    categoryID: { [Op.ne]: categoryId } // not equal to current category
                }
            });

            if (existingCategory) {
                return res.status(409).json({ message: 'Category name already exists' });
            }
        }

        // Update with provided fields
        const updateData = {
            ...(categoryName && {
                categoryName,
                slug: slugify(categoryName, { lower: true }) // Update slug if name changes
            }),
            ...(description !== undefined && { description }),
            ...(status && { status })
        };

        await category.update(updateData);

        // Upload image to cloudinary if provided
        if (req.file) {
            const { secure_url } = await cloudinary.uploader.upload(req.file.path, {
                folder: 'warehouse/categoryImages'
            });

            // Update category with image URL
            await category.update({ image: secure_url });
        }

        return res.status(200).json({
            message: 'Category updated successfully',
            category
        });
    } catch (error) {
        console.error('Error updating category:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Delete category
 * @route   DELETE /api/categories/:id
 * @access  Admin
 */
export const deleteCategory = async (req, res) => {
    try {
        // Validate ID parameter
        const { error } = validateCategoryId.validate({ id: req.params.id });
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const categoryId = req.params.id;
        const category = await categoryModel.findByPk(categoryId);

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        // Check if there are products using this category
        const productsCount = await productModel.count({ where: { categoryID: categoryId } });
        if (productsCount > 0) {
            return res.status(400).json({
                message: 'Cannot delete category because it has associated products',
                productsCount
            });
        }

        await category.destroy();

        return res.status(200).json({
            message: 'Category deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting category:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get all products by category ID
 * @route   GET /api/categories/:id/products
 * @access  Public
 */
export const getProductsByCategory = async (req, res) => {
    try {
        // Validate ID parameter
        const { error } = validateCategoryId.validate({ id: req.params.id });
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const categoryId = req.params.id;

        // Check if category exists
        const category = await categoryModel.findByPk(categoryId);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        // Get all products in this category
        const products = await productModel.findAll({
            where: { categoryId: categoryId }
        });

        return res.status(200).json({
            message: 'Products retrieved successfully',
            category: category.categoryName,
            productsCount: products.length,
            products
        });
    } catch (error) {
        console.error('Error fetching products by category:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

