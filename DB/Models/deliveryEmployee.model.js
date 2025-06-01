import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js';
import userModel from './user.model.js';

const deliveryEmployeeModel = sequelize.define('DeliveryEmployee', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'user',
            key: 'userId'
        }
    },
    currentLatitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
        defaultValue: null
    },
    currentLongitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
        defaultValue: null
    },
    isAvailable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    lastLocationUpdate: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    }
}, {
    tableName: 'delivery_employees',
    timestamps: true
});

// Define association
deliveryEmployeeModel.belongsTo(userModel, {
    foreignKey: 'userId',
    as: 'user'
});

export default deliveryEmployeeModel;