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
    // Received quantity set by warehouse worker
    receivedQuantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Actual quantity received (set by warehouse worker)'
    },
    // Production and expiry dates provided by supplier
    prodDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Production date provided by supplier (optional)'
    },
    expDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Expiry date provided by supplier (optional)'
    },
    // Batch management fields
    batchNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Batch/Lot number from supplier (optional)'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional notes about this item from supplier or warehouse'
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
    timestamps: true,
    indexes: [
        {
            fields: ['orderId'] // For efficient order lookups
        },
        {
            fields: ['productId'] // For efficient product lookups
        },
        {
            fields: ['status'] // For filtering by status
        },
        {
            fields: ['expDate'] // For tracking expiry dates
        },
        {
            fields: ['prodDate'] // For FIFO processing
        }
    ]
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