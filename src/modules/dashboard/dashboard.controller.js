// ========================================
// NEW DASHBOARD CONTROLLER
// File: src/modules/dashboard/dashboard.controller.js
// ========================================

import productModel from "../../../DB/Models/product.model.js";
import customerOrderModel from "../../../DB/Models/ordercustomer.model.js";
import userModel from "../../../DB/Models/user.model.js";
import customerModel from "../../../DB/Models/customer.model.js";
import supplierOrderModel from "../../../DB/Models/supplierOrder.model.js";
import { Op } from "sequelize";
import sequelize from "../../../DB/Connection.js";

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/dashboard/stats
 * @access  Admin
 */
export const getDashboardStats = async (req, res) => {
    try {
        // Get current date and calculate date ranges
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        // Run all queries in parallel for better performance
        const [
            // Current totals
            totalProducts,
            totalPaidOrders,
            totalUsers,
            totalCustomers,

            // Current month data for growth calculation
            currentMonthProducts,
            currentMonthPaidOrders,
            currentMonthUsers,
            currentMonthCustomers,

            // Previous month data for growth calculation
            previousMonthProducts,
            previousMonthPaidOrders,
            previousMonthUsers,
            previousMonthCustomers,

            // Additional stats
            totalRevenue,
            lowStockItems,
            pendingOrders
        ] = await Promise.all([
            // ========================================
            // CURRENT TOTALS
            // ========================================

            // Total Products
            productModel.count({
                where: { status: 'Active' }
            }),

            // Total Paid Orders (Shipped orders)
            customerOrderModel.count({
                where: {
                    status: 'Shipped',
                    paymentMethod: { [Op.in]: ['cash', 'partial'] }
                }
            }),

            // Total Users
            userModel.count({
                where: { isActive: 'Active' }
            }),

            // Total Customers
            customerModel.count(),

            // ========================================
            // CURRENT MONTH DATA
            // ========================================

            // Products added this month
            productModel.count({
                where: {
                    status: 'Active',
                    createdAt: { [Op.gte]: currentMonthStart }
                }
            }),

            // Paid orders this month
            customerOrderModel.count({
                where: {
                    status: 'Shipped',
                    paymentMethod: { [Op.in]: ['cash', 'partial'] },
                    deliveryEndTime: { [Op.gte]: currentMonthStart }
                }
            }),

            // Users registered this month
            userModel.count({
                where: {
                    isActive: 'Active',
                    registrationDate: { [Op.gte]: currentMonthStart }
                }
            }),

            // Customers added this month
            customerModel.count({
                where: {
                    createdAt: { [Op.gte]: currentMonthStart }
                }
            }),

            // ========================================
            // PREVIOUS MONTH DATA
            // ========================================

            // Products added last month
            productModel.count({
                where: {
                    status: 'Active',
                    createdAt: {
                        [Op.gte]: previousMonthStart,
                        [Op.lte]: previousMonthEnd
                    }
                }
            }),

            // Paid orders last month
            customerOrderModel.count({
                where: {
                    status: 'Shipped',
                    paymentMethod: { [Op.in]: ['cash', 'partial'] },
                    deliveryEndTime: {
                        [Op.gte]: previousMonthStart,
                        [Op.lte]: previousMonthEnd
                    }
                }
            }),

            // Users registered last month
            userModel.count({
                where: {
                    isActive: 'Active',
                    registrationDate: {
                        [Op.gte]: previousMonthStart,
                        [Op.lte]: previousMonthEnd
                    }
                }
            }),

            // Customers added last month
            customerModel.count({
                where: {
                    createdAt: {
                        [Op.gte]: previousMonthStart,
                        [Op.lte]: previousMonthEnd
                    }
                }
            }),

            // ========================================
            // ADDITIONAL STATS
            // ========================================

            // Total Revenue (sum of all shipped orders)
            customerOrderModel.sum('amountPaid', {
                where: { status: 'Shipped' }
            }),

            // Low Stock Items
            productModel.count({
                where: {
                    [Op.and]: [
                        sequelize.where(
                            sequelize.col('quantity'),
                            Op.lte,
                            sequelize.col('lowStock')
                        ),
                        { status: 'Active' }
                    ]
                }
            }),

            // Pending Orders
            customerOrderModel.count({
                where: { status: { [Op.in]: ['Pending', 'Accepted', 'Preparing'] } }
            })
        ]);

        // ========================================
        // CALCULATE GROWTH PERCENTAGES
        // ========================================

        const calculateGrowth = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Math.round(((current - previous) / previous) * 100);
        };

        const productGrowth = calculateGrowth(currentMonthProducts, previousMonthProducts);
        const orderGrowth = calculateGrowth(currentMonthPaidOrders, previousMonthPaidOrders);
        const userGrowth = calculateGrowth(currentMonthUsers, previousMonthUsers);
        const customerGrowth = calculateGrowth(currentMonthCustomers, previousMonthCustomers);

        // ========================================
        // RESPONSE DATA
        // ========================================

        return res.status(200).json({
            message: 'Dashboard statistics retrieved successfully',
            stats: {
                totalProducts: {
                    value: totalProducts,
                    growth: productGrowth,
                    isPositive: productGrowth >= 0,
                    currentMonth: currentMonthProducts,
                    previousMonth: previousMonthProducts
                },
                totalPaidOrders: {
                    value: totalPaidOrders,
                    growth: orderGrowth,
                    isPositive: orderGrowth >= 0,
                    currentMonth: currentMonthPaidOrders,
                    previousMonth: previousMonthPaidOrders
                },
                totalUsers: {
                    value: totalUsers,
                    growth: userGrowth,
                    isPositive: userGrowth >= 0,
                    currentMonth: currentMonthUsers,
                    previousMonth: previousMonthUsers
                },
                totalCustomers: {
                    value: totalCustomers,
                    growth: customerGrowth,
                    isPositive: customerGrowth >= 0,
                    currentMonth: currentMonthCustomers,
                    previousMonth: previousMonthCustomers
                }
            },
            additionalStats: {
                totalRevenue: parseFloat(totalRevenue) || 0,
                lowStockItems,
                pendingOrders,
                period: {
                    currentMonth: currentMonthStart.toISOString().slice(0, 7), // YYYY-MM format
                    previousMonth: previousMonthStart.toISOString().slice(0, 7)
                }
            },
            metadata: {
                generatedAt: new Date().toISOString(),
                currency: 'USD' // Adjust as needed
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard statistics:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get simplified dashboard stats (for cards only)
 * @route   GET /api/dashboard/cards
 * @access  Admin
 */
export const getDashboardCards = async (req, res) => {
    try {
        // Get current date and calculate date ranges
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        // Get current totals and growth data
        const [
            // Products (with timestamps after your update)
            totalProducts, currentMonthProducts, previousMonthProducts,

            // Orders
            totalPaidOrders, currentMonthPaidOrders, previousMonthPaidOrders,

            // Users
            totalUsers, currentMonthUsers, previousMonthUsers,

            // Customers (using user registrationDate)
            totalCustomers, currentMonthCustomers, previousMonthCustomers
        ] = await Promise.all([
            // ========================================
            // PRODUCTS (with timestamps)
            // ========================================
            productModel.count({ where: { status: 'Active' } }),
            productModel.count({ where: { status: 'Active', createdAt: { [Op.gte]: currentMonthStart } } }),
            productModel.count({ where: { status: 'Active', createdAt: { [Op.gte]: previousMonthStart, [Op.lte]: previousMonthEnd } } }),

            // ========================================
            // ORDERS
            // ========================================
            customerOrderModel.count({ where: { status: 'Shipped', paymentMethod: { [Op.in]: ['cash', 'partial'] } } }),
            customerOrderModel.count({ where: { status: 'Shipped', paymentMethod: { [Op.in]: ['cash', 'partial'] }, deliveryEndTime: { [Op.gte]: currentMonthStart } } }),
            customerOrderModel.count({ where: { status: 'Shipped', paymentMethod: { [Op.in]: ['cash', 'partial'] }, deliveryEndTime: { [Op.gte]: previousMonthStart, [Op.lte]: previousMonthEnd } } }),

            // ========================================
            // USERS
            // ========================================
            userModel.count({ where: { isActive: 'Active' } }),
            userModel.count({ where: { isActive: 'Active', registrationDate: { [Op.gte]: currentMonthStart } } }),
            userModel.count({ where: { isActive: 'Active', registrationDate: { [Op.gte]: previousMonthStart, [Op.lte]: previousMonthEnd } } }),

            // ========================================
            // CUSTOMERS (✅ FIXED: Using user registrationDate)
            // ========================================

            // Total customers
            customerModel.count({
                include: [{
                    model: userModel,
                    as: 'user',
                    where: { isActive: 'Active' }
                }]
            }),

            // Customers registered this month (via user registrationDate)
            customerModel.count({
                include: [{
                    model: userModel,
                    as: 'user',
                    where: {
                        isActive: 'Active',
                        registrationDate: { [Op.gte]: currentMonthStart }
                    }
                }]
            }),

            // Customers registered last month (via user registrationDate)
            customerModel.count({
                include: [{
                    model: userModel,
                    as: 'user',
                    where: {
                        isActive: 'Active',
                        registrationDate: {
                            [Op.gte]: previousMonthStart,
                            [Op.lte]: previousMonthEnd
                        }
                    }
                }]
            })
        ]);

        // Calculate growth percentages
        const calculateGrowth = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Math.round(((current - previous) / previous) * 100);
        };

        const productGrowth = calculateGrowth(currentMonthProducts, previousMonthProducts);
        const orderGrowth = calculateGrowth(currentMonthPaidOrders, previousMonthPaidOrders);
        const userGrowth = calculateGrowth(currentMonthUsers, previousMonthUsers);
        const customerGrowth = calculateGrowth(currentMonthCustomers, previousMonthCustomers);

        return res.status(200).json({
            cards: [
                {
                    title: "Total Products",
                    value: totalProducts.toLocaleString(),
                    growth: `${productGrowth}%`,
                    isPositive: productGrowth >= 0,
                    icon: "📦"
                },
                {
                    title: "Total Paid Orders",
                    value: totalPaidOrders.toLocaleString(),
                    growth: `${orderGrowth}%`,
                    isPositive: orderGrowth >= 0,
                    icon: "📋"
                },
                {
                    title: "Total Users",
                    value: totalUsers >= 1000 ? `${(totalUsers / 1000).toFixed(1)}k` : totalUsers.toLocaleString(),
                    growth: `${userGrowth}%`,
                    isPositive: userGrowth >= 0,
                    icon: "👥"
                },
                {
                    title: "Total Customers",
                    value: totalCustomers.toLocaleString(),
                    growth: `${customerGrowth}%`,
                    isPositive: customerGrowth >= 0,
                    icon: "🛒"
                }
            ],
            debug: {
                // Debug info to help verify the calculations
                currentMonth: currentMonthStart.toISOString().slice(0, 7),
                previousMonth: previousMonthStart.toISOString().slice(0, 7),
                counts: {
                    products: { total: totalProducts, current: currentMonthProducts, previous: previousMonthProducts },
                    orders: { total: totalPaidOrders, current: currentMonthPaidOrders, previous: previousMonthPaidOrders },
                    users: { total: totalUsers, current: currentMonthUsers, previous: previousMonthUsers },
                    customers: { total: totalCustomers, current: currentMonthCustomers, previous: previousMonthCustomers }
                }
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard cards:', error);
        return res.status(500).json({
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
        });
    }
};

