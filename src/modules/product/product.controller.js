import productModel from "../../../DB/Models/product.model.js"; // Import the product model
import categoryModel from "../../../DB/Models/category.model.js"; // Import the product model


export const getAllProducts = async (req, res) => {
    try {
        // Fetch all products from the database
        const products = await productModel.findAll();

        // If no products found, return a message
        if (products.length === 0) {
            return res.status(404).json({ message: 'No products found' });
        }

        // Send the list of products as a response
        return res.status(200).json({ products });
    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({ message: 'An error occurred while fetching products' });
    }
};

export const getProduct = async (req, res) => {
    const { productId } = req.params;  // Get productId from the URL params

    try {
        // Fetch product details along with the category name using Sequelize
        const product = await productModel.findOne({
            where: { productId },

        });

        // If product not found, return a 404 error
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Send the product and category name as a response
        return res.status(200).json({
            productId: product.productId,
            name: product.name,
            costPrice: product.costPrice,
            sellPrice: product.sellPrice,
            quantity: product.quantity,
            purchaseDate: product.purchaseDate,
            availability: product.availability,
        });
    } catch (error) {
        console.error('Error fetching product and category:', error);
        return res.status(500).json({ message: 'An error occurred while fetching product details' });
    }
};