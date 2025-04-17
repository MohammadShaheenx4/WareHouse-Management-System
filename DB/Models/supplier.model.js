import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js'; // Ensure this file exists for DB connection

const supplierModel = sequelize.define('Supplier', {
    userId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
            model: 'user', // This should match the name of your users table
            key: 'userId',
        },
        onDelete: 'CASCADE',  // Delete the supplier when the user is deleted
    },
    accountBalance: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,  // Default account balance for a new supplier
    }
}, {
    tableName: 'suppliers',  // Make sure the table name matches your actual suppliers table
    timestamps: false,
});

export default supplierModel;
