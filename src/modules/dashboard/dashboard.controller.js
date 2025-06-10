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

/**
 * @desc    Get top customers with order statistics and percentages
 * @route   GET /api/dashboard/top-customers
 * @access  Admin
 */
export const getTopCustomers = async (req, res) => {
    try {
        // Get pagination and sorting parameters
        const {
            page = 1,
            limit = 10,
            sortBy = 'orderCount', // orderCount, totalSpent, avgOrderValue
            minOrders = 1 // Minimum orders to be included
        } = req.query;

        const offset = (page - 1) * limit;

        // Get total statistics for percentage calculations
        const [totalCustomers, totalOrdersResult] = await Promise.all([
            customerModel.count(),
            customerOrderModel.findOne({
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'totalOrders'],
                    [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalRevenue']
                ],
                raw: true
            })
        ]);

        const totalOrders = parseInt(totalOrdersResult.totalOrders) || 0;
        const totalRevenue = parseFloat(totalOrdersResult.totalRevenue) || 0;

        // Build the query to get customers with their order statistics
        const customerStatsQuery = `
            SELECT 
                c.id as customerId,
                c.address,
                c.accountBalance,
                u.userId,
                u.name,
                u.email,
                u.phoneNumber,
                COUNT(co.id) as orderCount,
                COALESCE(SUM(co.totalCost), 0) as totalSpent,
                COALESCE(AVG(co.totalCost), 0) as avgOrderValue,
                MAX(co.createdAt) as lastOrderDate,
                MIN(co.createdAt) as firstOrderDate
            FROM customers c
            INNER JOIN user u ON c.userId = u.userId
            LEFT JOIN customerorders co ON c.id = co.customerId
            GROUP BY c.id, c.address, c.accountBalance, u.userId, u.name, u.email, u.phoneNumber
            HAVING COUNT(co.id) >= :minOrders
            ORDER BY ${sortBy === 'totalSpent' ? 'totalSpent' :
                sortBy === 'avgOrderValue' ? 'avgOrderValue' :
                    'orderCount'} DESC
            LIMIT :limit OFFSET :offset
        `;

        // Execute the query
        const rawCustomers = await sequelize.query(customerStatsQuery, {
            replacements: {
                minOrders: parseInt(minOrders),
                limit: parseInt(limit),
                offset: parseInt(offset)
            },
            type: sequelize.QueryTypes.SELECT
        });

        // Get count of customers with at least minOrders orders for pagination
        const totalActiveCustomersQuery = `
            SELECT COUNT(*) as count
            FROM (
                SELECT c.id
                FROM customers c
                LEFT JOIN customerorders co ON c.id = co.customerId
                GROUP BY c.id
                HAVING COUNT(co.id) >= :minOrders
            ) as activeCustomers
        `;

        const totalActiveCustomersResult = await sequelize.query(totalActiveCustomersQuery, {
            replacements: { minOrders: parseInt(minOrders) },
            type: sequelize.QueryTypes.SELECT
        });

        const totalActiveCustomers = parseInt(totalActiveCustomersResult[0].count) || 0;

        // Format and calculate percentages
        const formattedCustomers = rawCustomers.map((customer, index) => {
            const orderCount = parseInt(customer.orderCount) || 0;
            const totalSpent = parseFloat(customer.totalSpent) || 0;
            const avgOrderValue = parseFloat(customer.avgOrderValue) || 0;

            // Calculate percentages
            const orderPercentage = totalOrders > 0 ? ((orderCount / totalOrders) * 100) : 0;
            const revenuePercentage = totalRevenue > 0 ? ((totalSpent / totalRevenue) * 100) : 0;

            // Calculate days since last order
            const daysSinceLastOrder = customer.lastOrderDate
                ? Math.floor((new Date() - new Date(customer.lastOrderDate)) / (1000 * 60 * 60 * 24))
                : null;

            // Calculate customer lifetime (days since first order)
            const customerLifetimeDays = customer.firstOrderDate
                ? Math.floor((new Date() - new Date(customer.firstOrderDate)) / (1000 * 60 * 60 * 24))
                : null;

            return {
                rank: offset + index + 1,
                customerId: customer.customerId,
                name: customer.name || 'Unknown',
                email: customer.email || '',
                phoneNumber: customer.phoneNumber || '',
                address: customer.address || '',
                accountBalance: parseFloat(customer.accountBalance) || 0,
                orderCount: orderCount,
                totalSpent: Math.round(totalSpent * 100) / 100, // Round to 2 decimal places
                avgOrderValue: Math.round(avgOrderValue * 100) / 100,
                orderPercentage: Math.round(orderPercentage * 100) / 100,
                revenuePercentage: Math.round(revenuePercentage * 100) / 100,
                lastOrderDate: customer.lastOrderDate,
                firstOrderDate: customer.firstOrderDate,
                daysSinceLastOrder: daysSinceLastOrder,
                customerLifetimeDays: customerLifetimeDays,
                // Customer segments based on behavior
                segment: getCustomerSegment(orderCount, totalSpent, daysSinceLastOrder)
            };
        });

        return res.status(200).json({
            message: 'Top customers retrieved successfully',
            summary: {
                totalCustomers: totalCustomers,
                totalActiveCustomers: totalActiveCustomers,
                totalOrders: totalOrders,
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                avgOrdersPerCustomer: totalActiveCustomers > 0 ? Math.round((totalOrders / totalActiveCustomers) * 100) / 100 : 0,
                avgRevenuePerCustomer: totalActiveCustomers > 0 ? Math.round((totalRevenue / totalActiveCustomers) * 100) / 100 : 0
            },
            customers: formattedCustomers,
            pagination: {
                currentPage: parseInt(page),
                limit: parseInt(limit),
                totalItems: totalActiveCustomers,
                totalPages: Math.ceil(totalActiveCustomers / limit),
                hasNextPage: page * limit < totalActiveCustomers,
                hasPreviousPage: page > 1
            },
            filters: {
                sortBy: sortBy,
                minOrders: parseInt(minOrders)
            }
        });
    } catch (error) {
        console.error('Error getting top customers:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Helper function to determine customer segment based on behavior
 */
const getCustomerSegment = (orderCount, totalSpent, daysSinceLastOrder) => {
    // High-value customers
    if (totalSpent > 1000 && orderCount > 10) {
        return daysSinceLastOrder < 30 ? 'VIP Active' : 'VIP Inactive';
    }

    // Regular customers
    if (orderCount > 5 && totalSpent > 300) {
        return daysSinceLastOrder < 60 ? 'Regular Active' : 'Regular Inactive';
    }

    // New customers
    if (orderCount <= 3) {
        return daysSinceLastOrder < 90 ? 'New' : 'New Inactive';
    }

    // Low-value customers
    return daysSinceLastOrder < 90 ? 'Occasional' : 'Dormant';
};