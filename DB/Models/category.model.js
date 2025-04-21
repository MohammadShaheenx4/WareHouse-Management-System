import { DataTypes } from 'sequelize';
import sequelize from '../Connection.js'; // Using your connection file
import slugify from 'slugify';

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
    description: {
        type: DataTypes.STRING(500),
        allowNull: true,   // Description is optional
    },
    status: {
        type: DataTypes.ENUM('Active', 'NotActive'),
        allowNull: false,
        defaultValue: 'Active', // Default status is 'Active'
    },
    image: {
        type: DataTypes.STRING, // Stores file path or URL
        allowNull: false,
        defaultValue: null//
    }
}, {
    tableName: 'category', // Explicitly define the table name
    timestamps: false,  // Disable createdAt & updatedAt
    hooks: {
        beforeCreate: (category) => {
            category.slug = slugify(category.categoryName, { lower: true });
        },
        beforeUpdate: (category) => {
            if (category.changed('categoryName')) {
                category.slug = slugify(category.categoryName, { lower: true });
            }
        }
    }
});

export default categoryModel;