import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js';
import customerModel from './customer.model.js';
import deliveryEmployeeModel from './deliveryEmployee.model.js';
import warehouseEmployeeModel from './WareHouseEmployee.model.js'; // NEW: Add this import
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
    // NEW: Warehouse preparation tracking fields
    preparedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'warehouseemployee',
            key: 'id'
        },
        comment: 'Warehouse employee who prepared the order'
    },
    preparedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp when order preparation started'
    },
    // Delivery tracking fields
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
    signatureConfiremed: {
        type: DataTypes.STRING(500),  // Changed from BOOLEAN to STRING
        allowNull: true,              // Changed to allow null
        defaultValue: null,           // Changed default to null
        comment: 'Cloudinary URL of customer signature image for delivery confirmation'
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

// NEW: Warehouse employee association for preparation tracking
customerOrderModel.belongsTo(warehouseEmployeeModel, {
    foreignKey: 'preparedBy',
    as: 'preparer'
});

warehouseEmployeeModel.hasMany(customerOrderModel, {
    foreignKey: 'preparedBy',
    as: 'preparedOrders'
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