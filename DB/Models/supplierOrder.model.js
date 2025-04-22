import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js';
import supplierModel from './supplier.model.js';
import userModel from './user.model.js';

const supplierOrderModel = sequelize.define('SupplierOrder', {
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
        type: DataTypes.ENUM('Pending', 'Accepted', 'Declined', 'Delivered'),
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
    }
}, {
    tableName: 'supplierOrders',
    timestamps: true
});

// Define associations
supplierOrderModel.belongsTo(supplierModel, {
    foreignKey: 'supplierId',
    as: 'supplier'
});

// Include this if you want to access orders from supplier model
supplierModel.hasMany(supplierOrderModel, {
    foreignKey: 'supplierId',
    as: 'orders'
});

export default supplierOrderModel;