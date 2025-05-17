// File: DB/Models/warehouseEmployee.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js';
import userModel from './user.model.js';

const warehouseEmployeeModel = sequelize.define('WarehouseEmployee', {
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
        },
        unique: true
    }
}, {
    tableName: 'warehouseemployee',
    timestamps: true
});

// Define association between warehouseEmployees and users
warehouseEmployeeModel.belongsTo(userModel, {
    foreignKey: 'userId',
    as: 'user'
});

export default warehouseEmployeeModel;