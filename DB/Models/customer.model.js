import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js'; // Your connection file
import userModel from './user.model.js'; // Import user model 

const customerModel = sequelize.define('Customer', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users', // Assuming your users table is named 'users'
            key: 'id'
        }
    },
    address: {
        type: DataTypes.STRING,
        allowNull: false
    },
    latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
    },
    longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
    },
    accountBalance: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.00
    }
}, {
    tableName: 'customers',
    timestamps: false
});

// Define association between customers and users
customerModel.belongsTo(userModel, {
    foreignKey: 'userId',
    as: 'user'
});

export default customerModel;