import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js'; // Your connection file
import userModel from './user.model.js'; // Import user model 

const supplierModel = sequelize.define('Supplier', {
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
    accountBalance: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.00
    }
}, {
    tableName: 'suppliers',
    timestamps: false
});

// Define association between suppliers and users
supplierModel.belongsTo(userModel, {
    foreignKey: 'userId',
    as: 'user'
});

export default supplierModel;