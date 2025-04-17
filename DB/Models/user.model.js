import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js'; // Ensure this file exists for DB connection

const userModel = sequelize.define('User', {
    userId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,  // Ensure the user's name is required
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
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true  // Default value is true
    },
    roleName: {
        type: DataTypes.ENUM('Admin', 'Customer', 'Supplier', 'DeliveryEmployee', 'WareHouseEmployee', 'HighLevelEmployee'),
        allowNull: false,
    },
    sendCode: {
        type: DataTypes.STRING,  // Corrected to DataTypes.STRING (for Sequelize)
        defaultValue: null,
    },
    registrationDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW, // Automatically sets the current date and time
    }
}, {
    tableName: 'user', // Explicitly define the table name
    timestamps: false,  // Disable createdAt & updatedAt if not needed
});

export default userModel;
