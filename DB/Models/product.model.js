import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js'; // Your connection file
import categoryModel from './category.model.js'; // Import category model for association

const productModel = sequelize.define('Product', {
    productId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    costPrice: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    sellPrice: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    categoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'category', // Table name
            key: 'categoryID'
        }
    },
    status: {
        type: DataTypes.ENUM('Active', 'NotActive'),
        allowNull: false,
        defaultValue: 'Active',
    },
    barcode: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
    },
    warranty: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
    },
    prodDate: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
    },
    expDate: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
    },
    image: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
    }
}, {
    tableName: 'product', // Explicitly define the table name
    timestamps: false, // Disable createdAt & updatedAt
});

// Define association with category
productModel.belongsTo(categoryModel, {
    foreignKey: 'categoryId',
    as: 'category'
});

// Define reverse association (one-to-many)
categoryModel.hasMany(productModel, {
    foreignKey: 'categoryId',
    as: 'products'
});

export default productModel;