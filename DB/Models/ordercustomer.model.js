import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js';
import customerModel from './customer.model.js';
import deliveryEmployeeModel from './deliveryEmployee.model.js';
import warehouseEmployeeModel from './WareHouseEmployee.model.js';
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
        allowNull: true,
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
    // NEW: Multiple warehouse employees can prepare the same order
    preparationStartedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp when order preparation started'
    },
    preparationCompletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp when order preparation was completed'
    },
    // NEW: JSON field to store batch allocation details
    batchAllocation: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON string storing batch allocation details for preparation'
    },
    // NEW: Preparation method - automatically determined based on request
    preparationMethod: {
        type: DataTypes.ENUM('auto_fifo', 'manual_batches'),
        allowNull: true,
        comment: 'Method used for preparation - automatically determined'
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
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
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

customerModel.hasMany(customerOrderModel, {
    foreignKey: 'customerId',
    as: 'orders'
});

// Delivery employee associations
customerOrderModel.belongsTo(deliveryEmployeeModel, {
    foreignKey: 'deliveryEmployeeId',
    as: 'deliveryEmployee'
});

deliveryEmployeeModel.hasMany(customerOrderModel, {
    foreignKey: 'deliveryEmployeeId',
    as: 'assignedOrders'
});

export default customerOrderModel;