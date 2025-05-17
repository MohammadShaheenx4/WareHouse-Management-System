import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js';
import customerModel from './customer.model.js';
import userModel from './user.model.js';

const customerOrderModel = sequelize.define('Customerorder', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'customers',
            key: 'id'
        }
    },
    status: {
        type: DataTypes.ENUM('Pending', 'Accepted', 'Rejected', 'Preparing', 'Prepared', 'on_theway', 'Shipped'),
        defaultValue: 'Pending',
        allowNull: false
    },
    // In customerOrder.model.js
    paymentMethod: {
        type: DataTypes.ENUM('cash', 'debt', 'partial', null),
        allowNull: true,  // Allow null for initial order creation
        defaultValue: null
    },
    totalCost: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    discount: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: 0
    },
    amountPaid: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    note: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    }
}, {
    tableName: 'customerorders',
    timestamps: true
});

// Define associations
customerOrderModel.belongsTo(customerModel, {
    foreignKey: 'customerId',
    as: 'customer'
});

// Include this if you want to access orders from customer model
customerModel.hasMany(customerOrderModel, {
    foreignKey: 'customerId',
    as: 'orders'
});

export default customerOrderModel;