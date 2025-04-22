import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js'; // Your connection file
import productModel from './product.model.js';
import supplierModel from './supplier.model.js';

const productSupplierModel = sequelize.define('ProductSupplier', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'product',
            key: 'productId'
        }
    },
    supplierId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'suppliers',
            key: 'id' // Changed from supplierId to id
        }
    }
}, {
    tableName: 'productsupplier',
    timestamps: true,
    createdAt: true,
    updatedAt: false
});

// Define associations
productModel.belongsToMany(supplierModel, {
    through: productSupplierModel,
    foreignKey: 'productId',
    otherKey: 'supplierId',
    as: 'suppliers'
});

supplierModel.belongsToMany(productModel, {
    through: productSupplierModel,
    foreignKey: 'supplierId',
    otherKey: 'productId',
    as: 'products'
});

export default productSupplierModel;