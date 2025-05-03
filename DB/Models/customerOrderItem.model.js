import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js';
import customerOrderModel from './ordercustomer.model.js';
import productModel from './product.model.js';

const customerOrderItemModel = sequelize.define('CustomerorderItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'customerorders',
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
    Price: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    subtotal: {
        type: DataTypes.FLOAT,
        allowNull: false
    }
}, {
    tableName: 'customerorderItems',
    timestamps: true
});

// Define associations
customerOrderItemModel.belongsTo(customerOrderModel, {
    foreignKey: 'orderId',
    as: 'order'
});

customerOrderItemModel.belongsTo(productModel, {
    foreignKey: 'productId',
    as: 'product'
});

// Include these if you want to access items from order or product model
customerOrderModel.hasMany(customerOrderItemModel, {
    foreignKey: 'orderId',
    as: 'items'
});

// Change the alias here from 'orderItems' to 'customerOrderItems'
productModel.hasMany(customerOrderItemModel, {
    foreignKey: 'productId',
    as: 'customerOrderItems'  // Changed from 'orderItems' to 'customerOrderItems'
});

export default customerOrderItemModel;