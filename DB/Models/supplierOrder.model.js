import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js';
import supplierModel from './supplier.model.js';
import warehouseEmployeeModel from './WareHouseEmployee.model.js';
import userModel from './user.model.js';

const supplierOrderModel = sequelize.define('Supplierorder', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
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
        type: DataTypes.ENUM('Pending', 'PartiallyAccepted', 'Accepted', 'Declined', 'Delivered'),
        defaultValue: 'Pending',
        allowNull: false
    },
    note: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    },
    totalCost: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    receivedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'warehouseemployee',
            key: 'id'
        }
    },
    receivedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'supplierorders',
    timestamps: true
});

// Define associations
supplierOrderModel.belongsTo(supplierModel, {
    foreignKey: 'supplierId',
    as: 'supplier'
});

// Add association to warehouseEmployee
supplierOrderModel.belongsTo(warehouseEmployeeModel, {
    foreignKey: 'receivedBy',
    as: 'receiver'
});

// Include this if you want to access orders from supplier model
supplierModel.hasMany(supplierOrderModel, {
    foreignKey: 'supplierId',
    as: 'orders'
});

export default supplierOrderModel;
