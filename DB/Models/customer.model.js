import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js'; // Ensure this file exists for DB connection

const customerModel = sequelize.define('Customer', {
    userId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
            model: 'user', // References the user table
            key: 'userId',
        },
        onDelete: 'CASCADE',  // Delete customer when user is deleted
    },
    accountBalance: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,  // Initial account balance set to 0 for a new customer
    },
    address: {
        type: DataTypes.STRING(255),  // Customer's address
        allowNull: true,  // Address is optional, can be null if not provided
    }
}, {
    tableName: 'customers', // Make sure this matches your actual table name
    timestamps: false,      // Disable timestamps if you don't need createdAt and updatedAt
});

export default customerModel;
