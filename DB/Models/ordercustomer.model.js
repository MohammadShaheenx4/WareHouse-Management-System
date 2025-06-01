import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js';
import customerModel from './customer.model.js';
import deliveryEmployeeModel from './deliveryEmployee.model.js';
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
        type: DataTypes.ENUM('Pending', 'Accepted', 'Rejected', 'Preparing', 'Prepared', 'Assigned', 'on_theway', 'Shipped'),
        defaultValue: 'Pending',
        allowNull: false
    },
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
    },
    deliveryEmployeeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'delivery_employees',
            key: 'id'
        }
    },
    estimatedDeliveryTime: {
        type: DataTypes.INTEGER, // in minutes
        allowNull: true
    },
    deliveryStartTime: {
        type: DataTypes.DATE,
        allowNull: true
    },
    deliveryEndTime: {
        type: DataTypes.DATE,
        allowNull: true
    },
    assignedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp when order was assigned to delivery employee'
    },
    deliveryDelayReason: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    deliveryNotes: {
        type: DataTypes.TEXT,
        allowNull: true
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

// Delivery employee associations - updated for multi-order support
customerOrderModel.belongsTo(deliveryEmployeeModel, {
    foreignKey: 'deliveryEmployeeId',
    as: 'deliveryEmployee'
});

// Allow delivery employee to have multiple assigned orders
deliveryEmployeeModel.hasMany(customerOrderModel, {
    foreignKey: 'deliveryEmployeeId',
    as: 'assignedOrders'
});

export default customerOrderModel;