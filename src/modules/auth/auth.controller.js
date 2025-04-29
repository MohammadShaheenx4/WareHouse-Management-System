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


export const register = async (req, res, next) => {
    try {
        const { name, email, phoneNumber, isActive, roleName, address } = req.body;

        // Ensure the required fields are provided
        if (!email || !roleName) {
            return res.status(400).json({ message: "Email and roleName are required." });
        }

        // Check if the user already exists
        const existingUser = await userModel.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "Email already exists. Please log in." });
        }

        // Generate a random password using nanoid (You can adjust the length as needed)
        const randomPassword = nanoid(16); // Generates a 16-character random password

        // Hash the password before saving it to the database
        const salt = await bcrypt.genSalt(8);
        const hashedPassword = await bcrypt.hash(randomPassword, salt);

        // Create the user in the users table
        const newUser = await userModel.create({
            name,
            email,
            password: hashedPassword,
            phoneNumber: phoneNumber || null, // Optional
            isActive: isActive || "Active",  // Default to 'Active' if not provided
            roleName
        });


        if (roleName === 'Supplier') {
            await supplierModel.create({
                userId: newUser.userId,  // Link supplier to the new user via userId
                accountBalance: 0.00,     // Set initial balance to 0
            });
        }

        // If the role is Customer, insert into the customers table
        if (roleName === 'Customer') {
            await customerModel.create({
                userId: newUser.userId,   // Link customer to the new user via userId
                accountBalance: 0.00,      // Set initial balance to 0
                address: address || null,  // Address provided in the request
            });
        }
        // Send the generated password to the user's email
        await sendEmail({
            userEmail: newUser.email,
            subject: 'Your Account Details',
            text: `Hello ${newUser.name},\n\nYour account has been successfully created. Below are your login details:\n\nEmail: ${newUser.email}\nPassword: ${randomPassword}\n\nPlease login and change your password after the first login.`,
            html: `<b>Hello ${newUser.name},</b><br><br>Your account has been successfully created. Below are your login details:<br><br><b>Email:</b> ${newUser.email}<br><b>Password:</b> ${randomPassword}<br><br>Please login and change your password after the first login.`
        });

        return res.status(201).json({
            message: "User registered successfully!",
            user: { id: newUser.userId, email: newUser.email, roleName: newUser.roleName }
        });

    } catch (error) {
        console.error("Error registering user:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
/////////////////////////////////////LLLLLLLLLLLOOOOGGGGGGGGGGGG INNNNNNNNNNNNNNNNNN//////////////////////////////////////////////////////////

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }

        const user = await userModel.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        if (user.isActive !== "Active") {
            return res.status(403).json({ message: "Account is not active. Contact admin." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        const token = jwt.sign(
            { userId: user.userId, email: user.email, roleName: user.roleName },
            process.env.JWT_SECRET || 'shaheen');

        // Prepare response object
        const responseObj = {
            message: "Login successful!",
            token,
            user: {
                userId: user.userId,
                email: user.email,
                roleName: user.roleName,
                profilePicture: user.profilePicture,
                name: user.name
            }
        };

        // If user is a supplier, get and include supplier ID
        if (user.roleName === "Supplier") {
            const supplier = await supplierModel.findOne({
                where: { userId: user.userId }
            });

            if (supplier) {
                responseObj.user.supplierId = supplier.id;
            }
        }

        return res.status(200).json(responseObj);
    } catch (error) {
        console.error("Error during login:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};




export const resetPassword = async (req, res) => {
    const { email, code, newPassword } = req.body;

    try {

        if (email && !code && !newPassword) {

            const generatedCode = customAlphabet('1234567890', 5)();


            const [updated] = await userModel.update(
                { sendCode: generatedCode },
                { where: { email: email } }
            );

            if (updated === 0) {
                return res.status(404).json({ message: "User not found" });
            }


            await sendEmail({
                userEmail: email,  // The recipient's email address
                subject: 'Password Reset Code',  // The subject of the email
                text: `Your password reset code is: ${generatedCode}`,  // Plain text body
                html: `<b>Your password reset code is: ${generatedCode}</b>`,  // HTML body
            });


            return res.status(200).json({ message: "Code sent to your email" });
        }


        if (email && code && !newPassword) {

            const user = await userModel.findOne({ where: { email } });

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }


            if (user.sendCode !== code) {
                return res.status(400).json({ message: "Invalid or expired code" });
            }

            return res.status(200).json({ message: "Code verified successfully" });
        }


        if (email && code && newPassword) {

            const user = await userModel.findOne({ where: { email } });

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }


            if (user.sendCode !== code) {
                return res.status(400).json({ message: "Invalid or expired code" });
            }

            // Hash the new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update the password in the database
            await userModel.update(
                { password: hashedPassword },
                { where: { email } }
            );


            await userModel.update(
                { sendCode: null }, // Clear the code after successful password reset
                { where: { email } }
            );

            return res.status(200).json({ message: "Password reset successfully" });
        }


        return res.status(400).json({ message: "Invalid request" });
    } catch (error) {
        console.error("Error in reset password flow:", error);
        return res.status(500).json({ message: "Something went wrong" });
    }
};


export const getAllUsers = async (req, res) => {
    try {
        // Fetch all users from the database
        const users = await userModel.findAll();

        // If no users found, return a message
        if (users.length === 0) {
            return res.status(404).json({ message: 'No users found' });
        }

        // Explicitly set the content type to application/json
        res.set('Content-Type', 'application/json');

        // Send the list of users as a response
        return res.status(200).json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);

        // Explicitly set the content type to application/json in case of error
        res.set('Content-Type', 'application/json');

        // Send the error message in JSON format
        return res.status(500).json({ message: 'An error occurred while fetching users' });
    }
};

export const updateUser = async (req, res) => {
    const { userId } = req.params; // Get userId from route params
    const { email, password, phoneNumber, isActive, roleName, sendCode, name } = req.body; // Get data from the request body

    try {
        // Step 1: Find user by userId
        const user = await userModel.findOne({ where: { userId } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Step 2: Update fields if provided in the request body
        user.email = email || user.email;
        user.password = password || user.password;
        user.phoneNumber = phoneNumber || user.phoneNumber;
        user.isActive = isActive || user.isActive;
        user.roleName = roleName || user.roleName;
        user.sendCode = sendCode || user.sendCode;
        user.name = name || user.name;

        if (req.file) {
            const { secure_url } = await cloudinary.uploader.upload(req.file.path
                , { folder: 'warehouse/usersImages' }
            );
            user.profilePicture = secure_url;

        };
        // Step 3: Save the updated user
        await user.save();

        // Step 4: Return success response
        return res.status(200).json({ message: 'User updated successfully', user });
    } catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({ message: 'An error occurred while updating the user' });
    }
};

export const deleteUser = async (req, res) => {
    const { userId } = req.params; // Get userId from route params

    try {
        // Step 1: Find user by userId
        const user = await userModel.findOne({ where: { userId } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Step 2: Delete the user from the database
        await user.destroy();

        // Step 3: Return success response
        return res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ message: 'An error occurred while deleting the user' });
    }
};
