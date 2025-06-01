import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js';
import deliveryEmployeeModel from './deliveryEmployee.model.js';
import customerOrderModel from './ordercustomer.model.js';
import customerModel from './customer.model.js';

const deliveryHistoryModel = sequelize.define('DeliveryHistory', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    deliveryEmployeeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'delivery_employees',
            key: 'id'
        }
    },
    orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'customerorders',
            key: 'id'
        }
    },
    customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'customers',
            key: 'id'
        }
    },
    startTime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    endTime: {
        type: DataTypes.DATE,
        allowNull: true  // Changed to true - null when delivery starts, set when completed
    },
    estimatedTime: {
        type: DataTypes.INTEGER, // in minutes
        allowNull: false
    },
    actualTime: {
        type: DataTypes.INTEGER, // in minutes
        allowNull: false
    },
    paymentMethod: {
        type: DataTypes.ENUM('cash', 'debt', 'partial'),
        allowNull: true  // Changed to true - null when delivery starts, set when completed
    },
    totalAmount: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    amountPaid: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    debtAmount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    deliveryNotes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    customerLatitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
    },
    customerLongitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
    }
}, {
    tableName: 'delivery_history',
    timestamps: true
});

// Define associations
deliveryHistoryModel.belongsTo(deliveryEmployeeModel, {
    foreignKey: 'deliveryEmployeeId',
    as: 'deliveryEmployee'
});

deliveryHistoryModel.belongsTo(customerOrderModel, {
    foreignKey: 'orderId',
    as: 'order'
});

deliveryHistoryModel.belongsTo(customerModel, {
    foreignKey: 'customerId',
    as: 'customer'
});

export default deliveryHistoryModel;