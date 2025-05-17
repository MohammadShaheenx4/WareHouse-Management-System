// File: DB/Models/orderActivityLog.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js';
import userModel from './user.model.js';

const orderActivityLogModel = sequelize.define('OrderActivityLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'userId'
        }
    },
    orderType: {
        type: DataTypes.ENUM('customer', 'supplier'),
        allowNull: false
    },
    orderId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    action: {
        type: DataTypes.STRING,
        allowNull: false
    },
    previousStatus: {
        type: DataTypes.STRING,
        allowNull: true
    },
    newStatus: {
        type: DataTypes.STRING,
        allowNull: true
    },
    note: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'orderactivitylogs',
    timestamps: true
});

// Define association between activityLogs and users
orderActivityLogModel.belongsTo(userModel, {
    foreignKey: 'userId',
    as: 'user'
});

export default orderActivityLogModel;