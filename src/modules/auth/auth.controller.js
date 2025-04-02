import userModel from "../../../DB/Models/user.model.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';


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

        // 1️⃣ Validate input
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }

        // 2️⃣ Check if user exists in DB
        const user = await userModel.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        // 3️⃣ Check if user is active
        if (user.isActive !== 'Active') {
            return res.status(403).json({ message: "Account is not active. Contact admin." });
        }

        // 4️⃣ Compare password with hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        // 5️⃣ Generate JWT token
        const token = jwt.sign(
            { userId: user.userId, email: user.email, roleName: user.roleName },
            process.env.JWT_SECRET || 'shaheen');

        // 6️⃣ Return success response with token
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