import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js'; // Ensure this file exists for DB connection

const categoryModel = sequelize.define('Category', {
    categoryID: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    categoryName: {
        type: DataTypes.STRING(255),
        allowNull: false,  // Category name is required
    },
    slug: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true, // Slug must be unique
    },
    status: {
        type: DataTypes.ENUM('Active', 'NotActive'),
        allowNull: false,
        defaultValue: 'Active', // Default status is 'Active'
    },
}, {
    tableName: 'category', // Explicitly define the table name
    timestamps: false,  // Disable createdAt & updatedAt if not needed
});

export default categoryModel;
