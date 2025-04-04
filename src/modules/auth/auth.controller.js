import userModel from "../../../DB/Models/user.model.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid, customAlphabet } from 'nanoid'
import { json } from "sequelize";
import { sendEmail } from "../../utils/sendEmail.js";
import { DataTypes } from 'sequelize';


export const register = async (req, res, next) => {
    try {
        const { email, password, phoneNumber, isActive, roleName } = req.body;

        if (!email || !password || !roleName) {
            return res.status(400).json({ message: "Email, password, and roleName are required." });
        }

        const existingUser = await userModel.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "Email already exists. Please log in." });
        }

        const salt = await bcrypt.genSalt(8);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await userModel.create({
            email,
            password: hashedPassword,
            phoneNumber: phoneNumber || null, // Optional
            isActive: isActive || 'Active', // Default to 'Active' if not provided
            roleName
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

        sendEmail();

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }


        const user = await userModel.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password." });
        }


        if (user.isActive !== 'Active') {
            return res.status(403).json({ message: "Account is not active. Contact admin." });
        }


        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password." });
        }


        const token = jwt.sign(
            { userId: user.userId, email: user.email, roleName: user.roleName },
            process.env.JWT_SECRET || 'shaheen');


        return res.status(200).json({
            message: "Login successful!",
            token,
            user: {
                userId: user.userId,
                email: user.email,
                roleName: user.roleName
            }
        });



    } catch (error) {
        console.error("Error during login:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};





export const resetPassword = async (req, res) => {
    const { email, code, newPassword } = req.body;

    try {

        if (email && !code && !newPassword) {

            const generatedCode = customAlphabet('1234567890abcdefABCDEF', 5)();


            const [updated] = await userModel.update(
                { sendCode: generatedCode },
                { where: { email: email } }
            );

            if (updated === 0) {
                return res.status(404).json({ message: "User not found" });
            }


            await sendEmail(email, generatedCode);

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