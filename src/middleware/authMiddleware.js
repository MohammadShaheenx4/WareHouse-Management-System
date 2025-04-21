import jwt from 'jsonwebtoken';
import userModel from '../../DB/Models/user.model.js'; // Adjust the path as needed
import dotenv from 'dotenv';


class Auth {
    // Verify user is authenticated
    static async isAuthenticated(req, res, next) {
        try {
            // Get token from header
            const { token } = req.headers;

            // Check if token exists
            if (!token) {
                return res.status(401).json({ message: 'Access denied. No token provided' });
            }

            // Verify token
            const decoded = jwt.verify(token, 'shaheen');
            // Find user by ID (adjust based on your user model)
            const user = await userModel.findByPk(decoded.userId);
            // Check if user exists
            if (!user) {
                return res.status(401).json({ message: 'Invalid token. User not found' });
            }

            // Set user in request object
            req.user = user;
            next();
        } catch (error) {
            console.error('Auth Error:', error);
            return res.status(401).json({ message: 'Invalid token' });
        }
    }

    // Verify user is admin
    static async isAdmin(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.user) {
                return res.status(401).json({ message: 'Not authenticated' });
            }
            // Check if user is admin (adjust based on your user role field)
            if (req.user.roleName !== 'Admin') {
                return res.status(403).json({ message: 'Access denied. Admin role required' });
            }

            next();
        } catch (error) {
            console.error('Admin Auth Error:', error);
            return res.status(500).json({ message: 'Server error' });
        }
    }

    // Combined middleware for routes that require admin access
    static async adminOnly(req, res, next) {
        try {
            // First authenticate the user
            await Auth.isAuthenticated(req, res, async () => {
                // Then check if user is admin
                await Auth.isAdmin(req, res, next);
            });
        } catch (error) {
            console.error('Admin Auth Error:', error);
            return res.status(500).json({ message: 'Server error' });
        }
    }
}

export default Auth;