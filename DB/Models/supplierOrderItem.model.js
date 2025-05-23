import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js';
import supplierOrderModel from './supplierOrder.model.js';
import productModel from './product.model.js';

const supplierOrderItemModel = sequelize.define('SupplierorderItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'supplierorders',
            key: 'id'
        }
    },
    productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'product',
            key: 'productId'
        }
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1
        }
    },
    costPrice: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('Accepted', 'Declined'),
        defaultValue: null,
        allowNull: true
    },
    // Add to your supplierOrderItemModel.js file
    receivedQuantity: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    prodDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    expDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    originalCostPrice: {
        type: DataTypes.FLOAT,
        allowNull: false,
        comment: 'Original cost price for reference'
    },
    subtotal: {
        type: DataTypes.FLOAT,
        allowNull: false
    }
}, {
    tableName: 'supplierorderItems',
    timestamps: true
});

// Define associations
supplierOrderItemModel.belongsTo(supplierOrderModel, {
    foreignKey: 'orderId',
    as: 'order'
});

supplierOrderItemModel.belongsTo(productModel, {
    foreignKey: 'productId',
    as: 'product'
});

// Include these if you want to access items from order or product model
supplierOrderModel.hasMany(supplierOrderItemModel, {
    foreignKey: 'orderId',
    as: 'items'
});

productModel.hasMany(supplierOrderItemModel, {
    foreignKey: 'productId',
    as: 'orderItems'
});

export default supplierOrderItemModel;