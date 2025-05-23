import jwt from 'jsonwebtoken';
import userModel from '../../DB/Models/user.model.js';
import supplierModel from '../../DB/Models/supplier.model.js';

class Auth {
    // Verify user is authenticated
    static async isAuthenticated(req, res, next) {
        try {
            // Get token from Authorization header (standard approach)
            const authHeader = req.headers.authorization;

            // Also check custom token header for backward compatibility
            const customToken = req.headers.token;

            let token = null;

            // Debug what we received
            console.log('Auth headers received:', {
                authorization: authHeader,
                token: customToken
            });

            // Extract token from Authorization header if present
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
                console.log('Extracted token from Authorization header');
            }
            // Try custom token header as fallback
            else if (customToken) {
                token = customToken;
                console.log('Using token from custom header');
            }

            // Check if token exists
            if (!token) {
                console.log('No token found in request');
                return res.status(401).json({ message: 'Access denied. No token provided' });
            }

            console.log('Verifying token...');

            // Verify token (using your secret key)
            const decoded = jwt.verify(token, 'shaheen');
            console.log('Token decoded successfully:', decoded);

            // Find user by ID
            const user = await userModel.findByPk(decoded.userId);

            // Check if user exists
            if (!user) {
                console.log('User not found for decoded token');
                return res.status(401).json({ message: 'Invalid token. User not found' });
            }

            // Set user in request object
            req.user = user;
            console.log('User authenticated:', user.roleName);
            next();
        } catch (error) {
            console.error('Auth Error:', error.message);
            return res.status(401).json({ message: 'Invalid token: ' + error.message });
        }
    }

    // Verify user is admin
    static async isAdmin(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.user) {
                return res.status(401).json({ message: 'Not authenticated' });
            }

            console.log('Checking admin status for user:', req.user.roleName);

            // Check if user is admin
            if (req.user.roleName !== 'Admin') {
                return res.status(403).json({ message: 'Access denied. Admin role required' });
            }

            console.log('Admin access granted');
            next();
        } catch (error) {
            console.error('Admin Auth Error:', error);
            return res.status(500).json({ message: 'Server error' });
        }
    }

    // Verify user is supplier
    static async isSupplier(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.user) {
                return res.status(401).json({ message: 'Not authenticated' });
            }

            console.log('Checking supplier status for user:', req.user.roleName);

            // Check if user has a supplier record
            const supplier = await supplierModel.findOne({
                where: { userId: req.user.userId }
            });

            if (!supplier) {
                return res.status(403).json({ message: 'Access denied. Supplier role required' });
            }

            // Add supplier info to request object for convenience
            req.supplier = supplier;
            console.log('Supplier access granted');
            next();
        } catch (error) {
            console.error('Supplier Auth Error:', error);
            return res.status(500).json({ message: 'Server error' });
        }
    }

    // Verify user is either admin or supplier
    static async isAdminOrSupplier(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.user) {
                return res.status(401).json({ message: 'Not authenticated' });
            }

            // Check if user is admin
            if (req.user.roleName === 'Admin') {
                console.log('Admin access granted');
                return next();
            }

            // Check if user has a supplier record
            const supplier = await supplierModel.findOne({
                where: { userId: req.user.userId }
            });

            if (supplier) {
                req.supplier = supplier;
                console.log('Supplier access granted');
                return next();
            }

            return res.status(403).json({ message: 'Access denied. Admin or Supplier role required' });
        } catch (error) {
            console.error('Admin/Supplier Auth Error:', error);
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

    // Combined middleware for routes that require supplier access
    static async supplierOnly(req, res, next) {
        try {
            // First authenticate the user
            await Auth.isAuthenticated(req, res, async () => {
                // Then check if user is supplier
                await Auth.isSupplier(req, res, next);
            });
        } catch (error) {
            console.error('Supplier Auth Error:', error);
            return res.status(500).json({ message: 'Server error' });
        }
    }

    // Combined middleware for routes that require admin or supplier access
    static async adminOrSupplier(req, res, next) {
        try {
            // First authenticate the user
            await Auth.isAuthenticated(req, res, async () => {
                // Then check if user is admin or supplier
                await Auth.isAdminOrSupplier(req, res, next);
            });
        } catch (error) {
            console.error('Admin/Supplier Auth Error:', error);
            return res.status(500).json({ message: 'Server error' });
        }
    }
}

export default Auth;