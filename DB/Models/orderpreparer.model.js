import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js';
import customerOrderModel from './ordercustomer.model.js';
import warehouseEmployeeModel from './WareHouseEmployee.model.js';
import userModel from './user.model.js';

const orderPreparerModel = sequelize.define('OrderPreparer', {
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
    warehouseEmployeeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'warehouseemployee',
            key: 'id'
        }
    },
    startedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('working', 'completed'),
        allowNull: false,
        defaultValue: 'working'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'order_preparers',
    timestamps: true
});

// Define all associations here to avoid circular dependencies

// Order Preparer -> Customer Order (Many-to-One)
orderPreparerModel.belongsTo(customerOrderModel, {
    foreignKey: 'orderId',
    as: 'order'
});

// Customer Order -> Order Preparers (One-to-Many)
customerOrderModel.hasMany(orderPreparerModel, {
    foreignKey: 'orderId',
    as: 'preparers'
});

// Order Preparer -> Warehouse Employee (Many-to-One)
orderPreparerModel.belongsTo(warehouseEmployeeModel, {
    foreignKey: 'warehouseEmployeeId',
    as: 'warehouseEmployee'
});

// Warehouse Employee -> Order Preparers (One-to-Many)
warehouseEmployeeModel.hasMany(orderPreparerModel, {
    foreignKey: 'warehouseEmployeeId',
    as: 'preparingOrders'
});

export default orderPreparerModel;