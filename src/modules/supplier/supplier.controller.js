import userModel from "../../../DB/Models/user.model.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid, customAlphabet } from 'nanoid'
import { json } from "sequelize";
import { sendEmail } from "../../utils/sendEmail.js";
import { DataTypes } from 'sequelize';
import supplierModel from '../../../DB/Models/supplier.model.js'; // Import the supplier model
import customerModel from '../../../DB/Models/customer.model.js'; // Import the supplier model
import cloudinary from "../../utils/cloudinary.js";


export const getAllSuppliers = async (req, res) => {
    try {
        // Step 1: Find all users with roleName 'Supplier'
        const supplierUsers = await userModel.findAll({
            where: { roleName: 'Supplier' },
            attributes: ['userId', 'name']
        });

        // If no suppliers found, return a message
        if (supplierUsers.length === 0) {
            return res.status(404).json({ message: 'No suppliers found' });
        }

        // Step 2: Get all user IDs
        const userIds = supplierUsers.map(user => user.userId);

        // Step 3: Find corresponding supplier records
        const supplierRecords = await supplierModel.findAll({
            where: { userId: userIds },
            attributes: ['id', 'userId']
        });

        // Step 4: Create a map of userId to supplierId for quick lookup
        const supplierMap = {};
        supplierRecords.forEach(supplier => {
            supplierMap[supplier.userId] = supplier.id;
        });

        // Step 5: Format the response data
        const formattedSuppliers = supplierUsers.map(user => ({
            id: supplierMap[user.userId] || user.userId,
            name: user.name
        }));

        // Send the simplified list of suppliers
        return res.status(200).json({
            message: 'Suppliers retrieved successfully',
            suppliers: formattedSuppliers
        });
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        return res.status(500).json({ message: 'An error occurred while fetching suppliers' });
    }
};