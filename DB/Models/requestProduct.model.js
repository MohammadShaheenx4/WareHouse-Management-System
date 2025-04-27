import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js';
import supplierModel from './supplier.model.js';
import categoryModel from './category.model.js';

const requestProductModel = sequelize.define('RequestProduct', {
    id: {
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
    categoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'category',
            key: 'categoryID'
        }
    },
    supplierId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'suppliers',
            key: 'id'
        }
    },
    status: {
        type: DataTypes.ENUM('Pending', 'Accepted', 'Declined'),
        allowNull: false,
        defaultValue: 'Pending',
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
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
    },
    adminNote: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
    },
    image: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    }
}, {
    tableName: 'requestProducts',
    timestamps: true,
});

// Define associations
requestProductModel.belongsTo(supplierModel, {
    foreignKey: 'supplierId',
    as: 'supplier'
});

requestProductModel.belongsTo(categoryModel, {
    foreignKey: 'categoryId',
    as: 'category'
});

// Define reverse associations
supplierModel.hasMany(requestProductModel, {
    foreignKey: 'supplierId',
    as: 'productRequests'
});

export default requestProductModel;