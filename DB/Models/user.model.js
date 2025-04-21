import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js';

const userModel = sequelize.define('User', {
    userId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
        },
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    phoneNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    isActive: {
        type: DataTypes.ENUM('Active', 'NotActive'),  // ENUM field with 'Active' and 'NotActive'
        allowNull: false,
        defaultValue: 'Active',
    },
    roleName: {
        type: DataTypes.ENUM('Admin', 'Customer', 'Supplier', 'DeliveryEmployee', 'WareHouseEmployee', 'HighLevelEmployee'),
        allowNull: false,
    },
    sendCode: {
        type: DataTypes.STRING,
        defaultValue: null,
    },
    registrationDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    profilePicture: {
        type: DataTypes.STRING, // Stores file path or URL
        allowNull: true,
        defaultValue: null
    }
}, {
    tableName: 'user',
    timestamps: false,
});

export default userModel;