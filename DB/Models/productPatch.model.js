import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js';
import productModel from './product.model.js';
import supplierModel from './supplier.model.js';
import supplierOrderModel from './supplierOrder.model.js';

const productBatchModel = sequelize.define('ProductBatch', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'product',
            key: 'productId'
        }
    },
    batchNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Batch/Lot number from supplier'
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0
        }
    },
    originalQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Original quantity received in this batch'
    },
    prodDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Production date for this batch'
    },
    expDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Expiry date for this batch'
    },
    receivedDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Date when this batch was received'
    },
    supplierId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'suppliers',
            key: 'id'
        },
        comment: 'Which supplier provided this batch'
    },
    supplierOrderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'supplierorders',
            key: 'id'
        },
        comment: 'Reference to the supplier order that brought this batch'
    },
    costPrice: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'Cost price for this specific batch'
    },
    status: {
        type: DataTypes.ENUM('Active', 'Expired', 'Depleted'),
        allowNull: false,
        defaultValue: 'Active'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional notes about this batch'
    }
}, {
    tableName: 'product_batches',
    timestamps: true,
    indexes: [
        {
            fields: ['productId', 'prodDate'], // For efficient FIFO queries
        },
        {
            fields: ['productId', 'expDate'], // For expiry tracking
        },
        {
            fields: ['expDate'], // For global expiry alerts
        },
        {
            fields: ['status', 'quantity'], // For active batch queries
        }
    ]
});

// Define associations
productBatchModel.belongsTo(productModel, {
    foreignKey: 'productId',
    as: 'product'
});

productBatchModel.belongsTo(supplierModel, {
    foreignKey: 'supplierId',
    as: 'supplier'
});

productBatchModel.belongsTo(supplierOrderModel, {
    foreignKey: 'supplierOrderId',
    as: 'supplierOrder'
});

// Reverse associations
productModel.hasMany(productBatchModel, {
    foreignKey: 'productId',
    as: 'batches'
});

supplierModel.hasMany(productBatchModel, {
    foreignKey: 'supplierId',
    as: 'batches'
});

supplierOrderModel.hasMany(productBatchModel, {
    foreignKey: 'supplierOrderId',
    as: 'batches'
});

export default productBatchModel;