import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js'; // Ensure this file exists for DB connection

const userModel = sequelize.define('User', {
    userId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true, // Ensures valid email format
        },
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    phoneNumber: {
        type: DataTypes.STRING(20), // Use STRING to avoid number formatting issues
        allowNull: true,
    },
    isActive: {
        type: DataTypes.ENUM('Active', 'NotActive'),
        allowNull: false,
        defaultValue: 'Active',
    },
    roleName: {
        type: DataTypes.ENUM('Admin', 'Customer', 'Supplier', 'DeliveryEmployee', 'WareHouseEmployee', 'HighLevelEmployee'),
        allowNull: false,
    },
}, {
    tableName: 'user', // Explicitly define the table name
    timestamps: false, // Disable createdAt & updatedAt if not needed
});

export default userModel;
