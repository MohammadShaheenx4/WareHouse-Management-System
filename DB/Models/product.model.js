import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js'; // Ensure this file exists for DB connection

const productModel = sequelize.define('Product', {
    productId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true, // Auto-increment for productId
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,  // Product name is required
    },
    costPrice: {
        type: DataTypes.FLOAT,
        allowNull: false, // Cost price is required
    },
    sellPrice: {
        type: DataTypes.FLOAT,
        allowNull: false, // Sell price is required
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false, // Quantity is required
    },
    purchaseDate: {
        type: DataTypes.DATE,
        allowNull: true, // Purchase date is optional
    },
    categoryId: {
        type: DataTypes.INTEGER,
        allowNull: false, // Category ID is required
        references: {
            model: 'Category',  // Refers to the Category table
            key: 'categoryID',  // Foreign key referencing categoryID in Category table
        }
    },
    availability: {
        type: DataTypes.BOOLEAN,
        allowNull: false, // Availability is required
        defaultValue: true, // Default value is TRUE
    },
}, {
    tableName: 'product', // Explicitly define the table name
    timestamps: false,  // Disable createdAt & updatedAt if not needed
});

export default productModel;
