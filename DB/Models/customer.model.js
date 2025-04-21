import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js'; // Ensure this file exists for DB connection

const customerModel = sequelize.define('Customer', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,  // Automatically generate unique ID
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'user', // The name of the referenced model, ensure it matches your users table
            key: 'userId',
        },
        onDelete: 'CASCADE',  // Delete the customer record if the referenced user is deleted
    },
    accountBalance: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,  // Default balance when creating a customer
    },
    address: {
        type: DataTypes.STRING(255),
        allowNull: true,  // Allow address to be null
    }
}, {
    tableName: 'customers', // Ensure this matches the actual table name in the DB
    timestamps: false,       // Enable timestamps if you want `createdAt` and `updatedAt`
});

export default customerModel;
