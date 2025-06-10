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
// ========================================
// ADD THESE METHODS TO YOUR EXISTING dashboard.controller.js
// ========================================

/**
 * @desc    Get orders overview with time series data
 * @route   GET /api/dashboard/orders-overview
 * @access  Admin
 */
export const getOrdersOverview = async (req, res) => {
    try {
        const {
            period = 'weekly', // daily, weekly, monthly, yearly
            startDate,
            endDate,
            metric = 'revenue' // revenue, orders, avgOrderValue
        } = req.query;

        // Calculate date ranges based on period
        const dateRanges = calculateDateRanges(period, startDate, endDate);

        // Get time series data based on the period
        let timeSeriesData = [];
        let comparisonData = null;
        let summary = {};

        switch (period) {
            case 'daily':
                timeSeriesData = await getDailyData(dateRanges.current, metric);
                comparisonData = await getDailyData(dateRanges.previous, metric);
                break;
            case 'weekly':
                timeSeriesData = await getWeeklyData(dateRanges.current, metric);
                comparisonData = await getWeeklyData(dateRanges.previous, metric);
                break;
            case 'monthly':
                timeSeriesData = await getMonthlyData(dateRanges.current, metric);
                comparisonData = await getMonthlyData(dateRanges.previous, metric);
                break;
            case 'yearly':
                timeSeriesData = await getYearlyData(dateRanges.current, metric);
                comparisonData = await getYearlyData(dateRanges.previous, metric);
                break;
            default:
                return res.status(400).json({ message: 'Invalid period specified' });
        }

        // Calculate summary statistics
        summary = calculateSummary(timeSeriesData, comparisonData, metric);

        return res.status(200).json({
            message: 'Orders overview retrieved successfully',
            period: period,
            metric: metric,
            dateRange: {
                start: dateRanges.current.start,
                end: dateRanges.current.end
            },
            summary: summary,
            data: timeSeriesData,
            comparison: comparisonData,
            insights: generateInsights(timeSeriesData, summary)
        });

    } catch (error) {
        console.error('Error getting orders overview:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get orders overview by day of week (for weekly patterns)
 * @route   GET /api/dashboard/orders-overview/weekly-pattern
 * @access  Admin
 */
export const getWeeklyPattern = async (req, res) => {
    try {
        const { weeks = 4, metric = 'revenue' } = req.query;

        // Get data for the last N weeks
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (weeks * 7 * 24 * 60 * 60 * 1000));

        const query = `
            SELECT 
                DAYOFWEEK(createdAt) as dayOfWeek,
                DAYNAME(createdAt) as dayName,
                COUNT(*) as orderCount,
                COALESCE(SUM(totalCost), 0) as totalRevenue,
                COALESCE(AVG(totalCost), 0) as avgOrderValue
            FROM customerorders 
            WHERE createdAt >= :startDate 
                AND createdAt <= :endDate
                AND status NOT IN ('Rejected')
            GROUP BY DAYOFWEEK(createdAt), DAYNAME(createdAt)
            ORDER BY DAYOFWEEK(createdAt)
        `;

        const results = await sequelize.query(query, {
            replacements: { startDate, endDate },
            type: sequelize.QueryTypes.SELECT
        });

        const weeklyPattern = results.map(row => ({
            dayOfWeek: row.dayOfWeek,
            dayName: row.dayName,
            orderCount: parseInt(row.orderCount),
            revenue: Math.round(parseFloat(row.totalRevenue) * 100) / 100,
            avgOrderValue: Math.round(parseFloat(row.avgOrderValue) * 100) / 100,
            value: getMetricValue(row, metric)
        }));

        // Find best and worst days
        const bestDay = weeklyPattern.reduce((max, day) => day.value > max.value ? day : max);
        const worstDay = weeklyPattern.reduce((min, day) => day.value < min.value ? day : min);

        return res.status(200).json({
            message: 'Weekly pattern retrieved successfully',
            period: `Last ${weeks} weeks`,
            metric: metric,
            data: weeklyPattern,
            insights: {
                bestDay: bestDay.dayName,
                worstDay: worstDay.dayName,
                weekendPerformance: calculateWeekendPerformance(weeklyPattern),
                recommendations: generateWeeklyRecommendations(weeklyPattern)
            }
        });

    } catch (error) {
        console.error('Error getting weekly pattern:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// ========================================
// HELPER FUNCTIONS (ADD THESE TOO)
// ========================================

/**
 * Calculate date ranges for current and previous periods
 */
const calculateDateRanges = (period, startDate, endDate) => {
    const now = new Date();
    let current = { start: null, end: null };
    let previous = { start: null, end: null };

    if (startDate && endDate) {
        // Custom date range
        current.start = new Date(startDate);
        current.end = new Date(endDate);

        const diff = current.end.getTime() - current.start.getTime();
        previous.end = new Date(current.start.getTime() - 1);
        previous.start = new Date(previous.end.getTime() - diff);
    } else {
        // Predefined periods
        switch (period) {
            case 'daily':
                // Last 7 days
                current.end = new Date(now);
                current.start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
                previous.end = new Date(current.start.getTime() - 1);
                previous.start = new Date(previous.end.getTime() - 6 * 24 * 60 * 60 * 1000);
                break;

            case 'weekly':
                // Last 7 days (current week)
                current.end = new Date(now);
                current.start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
                previous.end = new Date(current.start.getTime() - 1);
                previous.start = new Date(previous.end.getTime() - 6 * 24 * 60 * 60 * 1000);
                break;

            case 'monthly':
                // Last 30 days
                current.end = new Date(now);
                current.start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
                previous.end = new Date(current.start.getTime() - 1);
                previous.start = new Date(previous.end.getTime() - 29 * 24 * 60 * 60 * 1000);
                break;

            case 'yearly':
                // Last 12 months
                current.end = new Date(now);
                current.start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
                previous.end = new Date(current.start.getTime() - 1);
                previous.start = new Date(previous.end.getFullYear(), previous.end.getMonth() - 11, 1);
                break;
        }
    }

    return { current, previous };
};

/**
 * Get daily data aggregated by day
 */
const getDailyData = async (dateRange, metric) => {
    const query = `
        SELECT 
            DATE(createdAt) as date,
            DAYNAME(createdAt) as dayName,
            COUNT(*) as orderCount,
            COALESCE(SUM(totalCost), 0) as totalRevenue,
            COALESCE(AVG(totalCost), 0) as avgOrderValue
        FROM customerorders 
        WHERE createdAt >= :startDate 
            AND createdAt <= :endDate
            AND status NOT IN ('Rejected')
        GROUP BY DATE(createdAt), DAYNAME(createdAt)
        ORDER BY DATE(createdAt)
    `;

    const results = await sequelize.query(query, {
        replacements: {
            startDate: dateRange.start,
            endDate: dateRange.end
        },
        type: sequelize.QueryTypes.SELECT
    });

    return results.map(row => ({
        date: row.date,
        label: row.dayName,
        orderCount: parseInt(row.orderCount),
        revenue: Math.round(parseFloat(row.totalRevenue) * 100) / 100,
        avgOrderValue: Math.round(parseFloat(row.avgOrderValue) * 100) / 100,
        value: getMetricValue(row, metric)
    }));
};

/**
 * Get weekly data (same as daily for weekly view)
 */
const getWeeklyData = async (dateRange, metric) => {
    return await getDailyData(dateRange, metric);
};

/**
 * Get monthly data aggregated by month
 */
const getMonthlyData = async (dateRange, metric) => {
    const query = `
        SELECT 
            DATE_FORMAT(createdAt, '%Y-%m') as month,
            DATE_FORMAT(createdAt, '%M %Y') as monthName,
            COUNT(*) as orderCount,
            COALESCE(SUM(totalCost), 0) as totalRevenue,
            COALESCE(AVG(totalCost), 0) as avgOrderValue
        FROM customerorders 
        WHERE createdAt >= :startDate 
            AND createdAt <= :endDate
            AND status NOT IN ('Rejected')
        GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
        ORDER BY month
    `;

    const results = await sequelize.query(query, {
        replacements: {
            startDate: dateRange.start,
            endDate: dateRange.end
        },
        type: sequelize.QueryTypes.SELECT
    });

    return results.map(row => ({
        date: row.month,
        label: row.monthName,
        orderCount: parseInt(row.orderCount),
        revenue: Math.round(parseFloat(row.totalRevenue) * 100) / 100,
        avgOrderValue: Math.round(parseFloat(row.avgOrderValue) * 100) / 100,
        value: getMetricValue(row, metric)
    }));
};

/**
 * Get yearly data aggregated by year
 */
const getYearlyData = async (dateRange, metric) => {
    const query = `
        SELECT 
            YEAR(createdAt) as year,
            COUNT(*) as orderCount,
            COALESCE(SUM(totalCost), 0) as totalRevenue,
            COALESCE(AVG(totalCost), 0) as avgOrderValue
        FROM customerorders 
        WHERE createdAt >= :startDate 
            AND createdAt <= :endDate
            AND status NOT IN ('Rejected')
        GROUP BY YEAR(createdAt)
        ORDER BY year
    `;

    const results = await sequelize.query(query, {
        replacements: {
            startDate: dateRange.start,
            endDate: dateRange.end
        },
        type: sequelize.QueryTypes.SELECT
    });

    return results.map(row => ({
        date: row.year.toString(),
        label: row.year.toString(),
        orderCount: parseInt(row.orderCount),
        revenue: Math.round(parseFloat(row.totalRevenue) * 100) / 100,
        avgOrderValue: Math.round(parseFloat(row.avgOrderValue) * 100) / 100,
        value: getMetricValue(row, metric)
    }));
};

/**
 * Get the value based on selected metric
 */
const getMetricValue = (row, metric) => {
    switch (metric) {
        case 'orders':
            return parseInt(row.orderCount);
        case 'avgOrderValue':
            return Math.round(parseFloat(row.avgOrderValue) * 100) / 100;
        case 'revenue':
        default:
            return Math.round(parseFloat(row.totalRevenue) * 100) / 100;
    }
};

/**
 * Calculate summary statistics and comparisons
 */
const calculateSummary = (currentData, previousData, metric) => {
    // Current period totals
    const currentTotal = currentData.reduce((sum, item) => {
        switch (metric) {
            case 'orders':
                return sum + item.orderCount;
            case 'avgOrderValue':
                return sum + item.avgOrderValue;
            case 'revenue':
            default:
                return sum + item.revenue;
        }
    }, 0);

    const currentOrders = currentData.reduce((sum, item) => sum + item.orderCount, 0);
    const currentRevenue = currentData.reduce((sum, item) => sum + item.revenue, 0);

    // Previous period totals
    const previousTotal = previousData ? previousData.reduce((sum, item) => {
        switch (metric) {
            case 'orders':
                return sum + item.orderCount;
            case 'avgOrderValue':
                return sum + item.avgOrderValue;
            case 'revenue':
            default:
                return sum + item.revenue;
        }
    }, 0) : 0;

    const previousOrders = previousData ? previousData.reduce((sum, item) => sum + item.orderCount, 0) : 0;
    const previousRevenue = previousData ? previousData.reduce((sum, item) => sum + item.revenue, 0) : 0;

    // Calculate changes
    const calculateChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    };

    // Find peak day/period
    const peakData = currentData.reduce((max, item) =>
        item.value > max.value ? item : max,
        currentData[0] || { value: 0, label: 'N/A' }
    );

    // Find lowest day/period
    const lowData = currentData.reduce((min, item) =>
        item.value < min.value ? item : min,
        currentData[0] || { value: 0, label: 'N/A' }
    );

    return {
        current: {
            total: Math.round(currentTotal * 100) / 100,
            orders: currentOrders,
            revenue: Math.round(currentRevenue * 100) / 100,
            avgOrderValue: currentOrders > 0 ? Math.round((currentRevenue / currentOrders) * 100) / 100 : 0
        },
        previous: {
            total: Math.round(previousTotal * 100) / 100,
            orders: previousOrders,
            revenue: Math.round(previousRevenue * 100) / 100,
            avgOrderValue: previousOrders > 0 ? Math.round((previousRevenue / previousOrders) * 100) / 100 : 0
        },
        changes: {
            total: calculateChange(currentTotal, previousTotal),
            orders: calculateChange(currentOrders, previousOrders),
            revenue: calculateChange(currentRevenue, previousRevenue),
            avgOrderValue: calculateChange(
                currentOrders > 0 ? currentRevenue / currentOrders : 0,
                previousOrders > 0 ? previousRevenue / previousOrders : 0
            )
        },
        peak: {
            value: Math.round(peakData.value * 100) / 100,
            period: peakData.label,
            date: peakData.date
        },
        low: {
            value: Math.round(lowData.value * 100) / 100,
            period: lowData.label,
            date: lowData.date
        }
    };
};

/**
 * Generate insights based on the data
 */
const generateInsights = (data, summary) => {
    const insights = [];

    // Growth insights
    if (summary.changes.total > 10) {
        insights.push({
            type: 'positive',
            message: `Strong growth of ${summary.changes.total}% compared to previous period`
        });
    } else if (summary.changes.total < -10) {
        insights.push({
            type: 'negative',
            message: `Decline of ${Math.abs(summary.changes.total)}% compared to previous period`
        });
    }

    // Peak performance
    if (summary.peak.value > 0) {
        insights.push({
            type: 'info',
            message: `Peak performance on ${summary.peak.period} with ${summary.peak.value.toLocaleString()}`
        });
    }

    // Trend analysis
    if (data.length >= 3) {
        const trend = analyzeTrend(data);
        if (trend === 'upward') {
            insights.push({
                type: 'positive',
                message: 'Showing an upward trend over the period'
            });
        } else if (trend === 'downward') {
            insights.push({
                type: 'warning',
                message: 'Showing a downward trend - consider investigating'
            });
        }
    }

    return insights;
};

/**
 * Analyze trend direction
 */
const analyzeTrend = (data) => {
    if (data.length < 3) return 'insufficient';

    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));

    const firstAvg = firstHalf.reduce((sum, item) => sum + item.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, item) => sum + item.value, 0) / secondHalf.length;

    const difference = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (difference > 5) return 'upward';
    if (difference < -5) return 'downward';
    return 'stable';
};

/**
 * Calculate weekend vs weekday performance
 */
const calculateWeekendPerformance = (data) => {
    const weekend = data.filter(day => day.dayOfWeek === 1 || day.dayOfWeek === 7); // Sunday = 1, Saturday = 7
    const weekday = data.filter(day => day.dayOfWeek >= 2 && day.dayOfWeek <= 6);

    const weekendAvg = weekend.reduce((sum, day) => sum + day.value, 0) / weekend.length;
    const weekdayAvg = weekday.reduce((sum, day) => sum + day.value, 0) / weekday.length;

    return {
        weekendAverage: Math.round(weekendAvg * 100) / 100,
        weekdayAverage: Math.round(weekdayAvg * 100) / 100,
        difference: Math.round(((weekendAvg - weekdayAvg) / weekdayAvg) * 100)
    };
};

/**
 * Generate recommendations based on weekly patterns
 */
const generateWeeklyRecommendations = (data) => {
    const recommendations = [];

    const bestDay = data.reduce((max, day) => day.value > max.value ? day : max);
    const worstDay = data.reduce((min, day) => day.value < min.value ? day : min);

    recommendations.push(`Focus marketing efforts on ${worstDay.dayName} to boost performance`);
    recommendations.push(`Leverage ${bestDay.dayName}'s success patterns for other days`);

    return recommendations;
};
// ========================================
// ADD THIS METHOD TO YOUR dashboard.controller.js
// ========================================

/**
 * @desc    Get top products by total sales revenue (simplified for table)
 * @route   GET /api/dashboard/top-products
 * @access  Admin
 */
export const getTopProducts = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortBy = 'totalSold' // totalSold, orderCount, stock
        } = req.query;

        const offset = (page - 1) * limit;

        // Simplified query - group by product to avoid duplicates
        const topProductsQuery = `
            SELECT 
                p.productId,
                p.name,
                p.quantity as stock,
                
                -- Combine all suppliers for this product
                GROUP_CONCAT(DISTINCT u.name SEPARATOR ', ') as vendors,
                
                -- Sales statistics (grouped by product)
                COALESCE(SUM(coi.subtotal), 0) as totalSold,
                COALESCE(COUNT(DISTINCT coi.orderId), 0) as orderCount
                
            FROM product p
            
            -- Get ALL suppliers for this product
            LEFT JOIN productsupplier ps ON p.productId = ps.productId AND ps.status = 'Active'
            LEFT JOIN suppliers s ON ps.supplierId = s.id
            LEFT JOIN user u ON s.userId = u.userId
            
            -- Get sales data from shipped orders only
            LEFT JOIN customerorderItems coi ON p.productId = coi.productId
            LEFT JOIN customerorders co ON coi.orderId = co.id AND co.status = 'Shipped'
            
            WHERE p.status = 'Active'
            
            GROUP BY p.productId, p.name, p.quantity
                
            ORDER BY ${sortBy === 'orderCount' ? 'orderCount' :
                sortBy === 'stock' ? 'stock' :
                    'totalSold'} DESC
                      
            LIMIT :limit OFFSET :offset
        `;

        // Execute the query
        const rawProducts = await sequelize.query(topProductsQuery, {
            replacements: {
                limit: parseInt(limit),
                offset: parseInt(offset)
            },
            type: sequelize.QueryTypes.SELECT
        });

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(DISTINCT p.productId) as count
            FROM product p
            WHERE p.status = 'Active'
        `;

        const countResult = await sequelize.query(countQuery, {
            type: sequelize.QueryTypes.SELECT
        });

        const totalProducts = parseInt(countResult[0].count) || 0;

        // Format the response - ONLY table data
        const products = rawProducts.map(product => ({
            productId: product.productId,
            name: product.name || 'Unknown Product',
            vendor: product.vendors || 'No Vendor',
            totalSold: Math.round(parseFloat(product.totalSold || 0) * 100) / 100,
            stock: parseInt(product.stock || 0)
        }));

        return res.status(200).json({
            message: 'Top products retrieved successfully',
            products: products,
            pagination: {
                currentPage: parseInt(page),
                limit: parseInt(limit),
                totalItems: totalProducts,
                totalPages: Math.ceil(totalProducts / limit),
                hasNextPage: page * limit < totalProducts,
                hasPreviousPage: page > 1
            }
        });

    } catch (error) {
        console.error('Error getting top products:', error);
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
};
/**
 * @desc    Get order count by day of week
 * @route   GET /api/dashboard/order-count
 * @access  Admin
 */
export const getOrderCount = async (req, res) => {
    try {
        // Get current week data (last 7 days)
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);

        // Get previous week data for comparison
        const prevEndDate = new Date(startDate.getTime() - 1);
        const prevStartDate = new Date(prevEndDate.getTime() - 6 * 24 * 60 * 60 * 1000);

        // Query for current week
        const currentWeekQuery = `
            SELECT 
                DAYNAME(createdAt) as dayName,
                COUNT(*) as orderCount
            FROM customerorders 
            WHERE createdAt >= :startDate 
                AND createdAt <= :endDate
                AND status NOT IN ('Rejected')
            GROUP BY DAYNAME(createdAt), DAYOFWEEK(createdAt)
            ORDER BY DAYOFWEEK(createdAt)
        `;

        // Query for previous week
        const previousWeekQuery = `
            SELECT 
                COUNT(*) as totalOrders
            FROM customerorders 
            WHERE createdAt >= :prevStartDate 
                AND createdAt <= :prevEndDate
                AND status NOT IN ('Rejected')
        `;

        const [currentWeekResults, previousWeekResults] = await Promise.all([
            sequelize.query(currentWeekQuery, {
                replacements: { startDate, endDate },
                type: sequelize.QueryTypes.SELECT
            }),
            sequelize.query(previousWeekQuery, {
                replacements: { prevStartDate, prevEndDate },
                type: sequelize.QueryTypes.SELECT
            })
        ]);

        // Create day mapping to ensure all days are present
        const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayMap = {};

        // Initialize with 0 for all days
        dayOrder.forEach(day => {
            dayMap[day] = 0;
        });

        // Fill in actual data
        currentWeekResults.forEach(row => {
            dayMap[row.dayName] = parseInt(row.orderCount);
        });

        // Convert to array format for chart
        const chartData = [
            { day: 'SAT', count: dayMap['Saturday'] },
            { day: 'SUN', count: dayMap['Sunday'] },
            { day: 'MON', count: dayMap['Monday'] },
            { day: 'TUE', count: dayMap['Tuesday'] },
            { day: 'WED', count: dayMap['Wednesday'] },
            { day: 'THU', count: dayMap['Thursday'] },
            { day: 'FRI', count: dayMap['Friday'] }
        ];

        // Calculate totals and growth
        const currentWeekTotal = Object.values(dayMap).reduce((sum, count) => sum + count, 0);
        const previousWeekTotal = parseInt(previousWeekResults[0]?.totalOrders || 0);

        // Calculate growth percentage
        let growth = 0;
        if (previousWeekTotal > 0) {
            growth = Math.round(((currentWeekTotal - previousWeekTotal) / previousWeekTotal) * 100);
        } else if (currentWeekTotal > 0) {
            growth = 100;
        }

        return res.status(200).json({
            data: chartData,
            growth: growth,
            total: currentWeekTotal
        });

    } catch (error) {
        console.error('Error getting order count:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
export const getProfitData = async (req, res) => {
    try {
        // Get current week data (last 7 days)
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);

        // Get previous week data for comparison
        const prevEndDate = new Date(startDate.getTime() - 1);
        const prevStartDate = new Date(prevEndDate.getTime() - 6 * 24 * 60 * 60 * 1000);

        // Query for current week daily profit
        const currentWeekQuery = `
            SELECT 
                DATE(co.createdAt) as date,
                DAYNAME(co.createdAt) as dayName,
                DAYOFWEEK(co.createdAt) as dayOfWeek,
                COALESCE(SUM(co.amountPaid), 0) as revenue,
                COALESCE(SUM(coi.quantity * p.costPrice), 0) as costs,
                COALESCE(SUM(co.amountPaid) - SUM(coi.quantity * p.costPrice), 0) as profit
            FROM customerorders co
            INNER JOIN customerorderItems coi ON co.id = coi.orderId
            INNER JOIN product p ON coi.productId = p.productId
            WHERE co.createdAt >= :startDate 
                AND co.createdAt <= :endDate
                AND co.status = 'Shipped'
            GROUP BY DATE(co.createdAt), DAYNAME(co.createdAt), DAYOFWEEK(co.createdAt)
            ORDER BY DATE(co.createdAt)
        `;

        // Query for previous week total profit
        const previousWeekQuery = `
            SELECT 
                COALESCE(SUM(co.amountPaid) - SUM(coi.quantity * p.costPrice), 0) as totalProfit
            FROM customerorders co
            INNER JOIN customerorderItems coi ON co.id = coi.orderId
            INNER JOIN product p ON coi.productId = p.productId
            WHERE co.createdAt >= :prevStartDate 
                AND co.createdAt <= :prevEndDate
                AND co.status = 'Shipped'
        `;

        const [currentWeekResults, previousWeekResults] = await Promise.all([
            sequelize.query(currentWeekQuery, {
                replacements: { startDate, endDate },
                type: sequelize.QueryTypes.SELECT
            }),
            sequelize.query(previousWeekQuery, {
                replacements: { prevStartDate, prevEndDate },
                type: sequelize.QueryTypes.SELECT
            })
        ]);

        // Create day mapping to ensure all days are present
        const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayMap = {};

        // Initialize with 0 for all days
        dayOrder.forEach(day => {
            dayMap[day] = 0;
        });

        // Fill in actual data
        currentWeekResults.forEach(row => {
            dayMap[row.dayName] = parseFloat(row.profit) || 0;
        });

        // Convert to array format for chart (SAT to FRI as shown in image)
        const chartData = [
            dayMap['Saturday'],
            dayMap['Sunday'],
            dayMap['Monday'],
            dayMap['Tuesday'],
            dayMap['Wednesday'],
            dayMap['Thursday'],
            dayMap['Friday']
        ];

        // Calculate totals and growth
        const currentWeekTotal = Object.values(dayMap).reduce((sum, profit) => sum + profit, 0);
        const previousWeekTotal = parseFloat(previousWeekResults[0]?.totalProfit || 0);

        // Calculate growth percentage
        let growth = 0;
        if (previousWeekTotal > 0) {
            growth = Math.round(((currentWeekTotal - previousWeekTotal) / previousWeekTotal) * 100);
        } else if (currentWeekTotal > 0) {
            growth = 100;
        }

        return res.status(200).json({
            profit: Math.round(currentWeekTotal * 100) / 100, // Current week total profit
            growth: growth, // Growth percentage
            data: chartData // Array of 7 values for the chart
        });

    } catch (error) {
        console.error('Error getting profit data:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
export const getOrdersChart = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Default to current week if no dates provided
        let start, end;
        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
            // Set end date to end of day
            end.setHours(23, 59, 59, 999);
        } else {
            // Default to current week (last 7 days)
            end = new Date();
            start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
        }

        // Query to get revenue grouped by day of week within the date range
        const ordersQuery = `
            SELECT 
                DAYOFWEEK(createdAt) as dayOfWeek,
                DAYNAME(createdAt) as dayName,
                COALESCE(SUM(amountPaid), 0) as revenue,
                COUNT(*) as orderCount
            FROM customerorders 
            WHERE createdAt >= :startDate 
                AND createdAt <= :endDate
                AND status = 'Shipped'
            GROUP BY DAYOFWEEK(createdAt), DAYNAME(createdAt)
            ORDER BY DAYOFWEEK(createdAt)
        `;

        const results = await sequelize.query(ordersQuery, {
            replacements: {
                startDate: start,
                endDate: end
            },
            type: sequelize.QueryTypes.SELECT
        });

        // Create day mapping (MySQL DAYOFWEEK: 1=Sunday, 2=Monday, ..., 7=Saturday)
        const dayMap = {
            'Saturday': 0,   // dayOfWeek = 7
            'Sunday': 0,     // dayOfWeek = 1
            'Monday': 0,     // dayOfWeek = 2
            'Tuesday': 0,    // dayOfWeek = 3
            'Wednesday': 0,  // dayOfWeek = 4
            'Thursday': 0,   // dayOfWeek = 5
            'Friday': 0      // dayOfWeek = 6
        };

        // Fill in actual data
        results.forEach(row => {
            dayMap[row.dayName] = Math.round(parseFloat(row.revenue) * 100) / 100;
        });

        // Convert to array format for chart (SAT to FRI as shown in image)
        const chartData = [
            { day: 'SAT', value: dayMap['Saturday'] },
            { day: 'SUN', value: dayMap['Sunday'] },
            { day: 'MON', value: dayMap['Monday'] },
            { day: 'TUE', value: dayMap['Tuesday'] },
            { day: 'WED', value: dayMap['Wednesday'] },
            { day: 'THU', value: dayMap['Thursday'] },
            { day: 'FRI', value: dayMap['Friday'] }
        ];

        // Calculate total revenue and max value for scaling
        const totalRevenue = Object.values(dayMap).reduce((sum, value) => sum + value, 0);
        const maxValue = Math.max(...Object.values(dayMap));

        return res.status(200).json({
            data: chartData,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            maxValue: Math.round(maxValue * 100) / 100,
            dateRange: {
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0]
            }
        });

    } catch (error) {
        console.error('Error getting orders chart data:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get orders overview data for different time periods (alternative endpoint)
 * @route   GET /api/dashboard/orders-chart/period
 * @access  Admin
 * @query   period (daily, weekly, monthly), count (number of periods)
 */
export const getOrdersChartByPeriod = async (req, res) => {
    try {
        const {
            period = 'weekly', // daily, weekly, monthly
            count = 1 // number of periods to look back
        } = req.query;

        let startDate, endDate, groupBy, selectFormat;
        const now = new Date();

        switch (period) {
            case 'daily':
                // Last N days
                endDate = new Date(now);
                startDate = new Date(now.getTime() - ((parseInt(count) - 1) * 24 * 60 * 60 * 1000));
                groupBy = 'DATE(createdAt)';
                selectFormat = 'DATE_FORMAT(createdAt, "%a") as dayLabel, DATE(createdAt) as dateValue';
                break;

            case 'weekly':
                // Last N weeks (default)
                endDate = new Date(now);
                startDate = new Date(now.getTime() - ((parseInt(count) * 7 - 1) * 24 * 60 * 60 * 1000));
                groupBy = 'DAYOFWEEK(createdAt)';
                selectFormat = 'DAYNAME(createdAt) as dayLabel, DAYOFWEEK(createdAt) as dayOfWeek';
                break;

            case 'monthly':
                // Last N months
                endDate = new Date(now);
                startDate = new Date(now);
                startDate.setMonth(startDate.getMonth() - parseInt(count) + 1);
                startDate.setDate(1); // First day of the month
                groupBy = 'DATE_FORMAT(createdAt, "%Y-%m")';
                selectFormat = 'DATE_FORMAT(createdAt, "%b %Y") as dayLabel, DATE_FORMAT(createdAt, "%Y-%m") as monthValue';
                break;

            default:
                return res.status(400).json({ message: 'Invalid period. Use: daily, weekly, or monthly' });
        }

        const query = `
            SELECT 
                ${selectFormat},
                COALESCE(SUM(amountPaid), 0) as revenue,
                COUNT(*) as orderCount
            FROM customerorders 
            WHERE createdAt >= :startDate 
                AND createdAt <= :endDate
                AND status = 'Shipped'
            GROUP BY ${groupBy}
            ORDER BY ${period === 'weekly' ? 'DAYOFWEEK(createdAt)' : 'createdAt'}
        `;

        const results = await sequelize.query(query, {
            replacements: { startDate, endDate },
            type: sequelize.QueryTypes.SELECT
        });

        let chartData;

        if (period === 'weekly') {
            // For weekly, ensure all days are present
            const dayMap = {
                'Saturday': 0, 'Sunday': 0, 'Monday': 0, 'Tuesday': 0,
                'Wednesday': 0, 'Thursday': 0, 'Friday': 0
            };

            results.forEach(row => {
                dayMap[row.dayLabel] = Math.round(parseFloat(row.revenue) * 100) / 100;
            });

            chartData = [
                { day: 'SAT', value: dayMap['Saturday'] },
                { day: 'SUN', value: dayMap['Sunday'] },
                { day: 'MON', value: dayMap['Monday'] },
                { day: 'TUE', value: dayMap['Tuesday'] },
                { day: 'WED', value: dayMap['Wednesday'] },
                { day: 'THU', value: dayMap['Thursday'] },
                { day: 'FRI', value: dayMap['Friday'] }
            ];
        } else {
            // For daily/monthly, use results as-is
            chartData = results.map(row => ({
                day: row.dayLabel,
                value: Math.round(parseFloat(row.revenue) * 100) / 100
            }));
        }

        const totalRevenue = chartData.reduce((sum, item) => sum + item.value, 0);
        const maxValue = Math.max(...chartData.map(item => item.value));

        return res.status(200).json({
            data: chartData,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            maxValue: Math.round(maxValue * 100) / 100,
            period: period,
            dateRange: {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
            }
        });

    } catch (error) {
        console.error('Error getting orders chart data by period:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get profit data for chart by date range
 * @route   GET /api/dashboard/profit-chart
 * @access  Admin
 * @query   startDate, endDate (optional - defaults to current week)
 */
export const getProfitChart = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Default to current week if no dates provided
        let start, end;
        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
            // Set end date to end of day
            end.setHours(23, 59, 59, 999);
        } else if (startDate) {
            // If only start date provided, end date is today
            start = new Date(startDate);
            end = new Date();
            end.setHours(23, 59, 59, 999);
        } else {
            // Default to current week (last 7 days)
            end = new Date();
            start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
        }

        // Calculate previous period for growth comparison
        const periodLength = end.getTime() - start.getTime();
        const prevEnd = new Date(start.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - periodLength);

        // Query for current period daily profit grouped by day of week
        const currentPeriodQuery = `
            SELECT 
                DAYOFWEEK(co.createdAt) as dayOfWeek,
                DAYNAME(co.createdAt) as dayName,
                COALESCE(SUM(co.amountPaid), 0) as revenue,
                COALESCE(SUM(coi.quantity * p.costPrice), 0) as costs,
                COALESCE(SUM(co.amountPaid) - SUM(coi.quantity * p.costPrice), 0) as profit
            FROM customerorders co
            INNER JOIN customerorderItems coi ON co.id = coi.orderId
            INNER JOIN product p ON coi.productId = p.productId
            WHERE co.createdAt >= :startDate 
                AND co.createdAt <= :endDate
                AND co.status = 'Shipped'
            GROUP BY DAYOFWEEK(co.createdAt), DAYNAME(co.createdAt)
            ORDER BY DAYOFWEEK(co.createdAt)
        `;

        // Query for previous period total profit
        const previousPeriodQuery = `
            SELECT 
                COALESCE(SUM(co.amountPaid) - SUM(coi.quantity * p.costPrice), 0) as totalProfit
            FROM customerorders co
            INNER JOIN customerorderItems coi ON co.id = coi.orderId
            INNER JOIN product p ON coi.productId = p.productId
            WHERE co.createdAt >= :prevStartDate 
                AND co.createdAt <= :prevEndDate
                AND co.status = 'Shipped'
        `;

        const [currentResults, previousResults] = await Promise.all([
            sequelize.query(currentPeriodQuery, {
                replacements: {
                    startDate: start,
                    endDate: end
                },
                type: sequelize.QueryTypes.SELECT
            }),
            sequelize.query(previousPeriodQuery, {
                replacements: {
                    prevStartDate: prevStart,
                    prevEndDate: prevEnd
                },
                type: sequelize.QueryTypes.SELECT
            })
        ]);

        // Create day mapping (MySQL DAYOFWEEK: 1=Sunday, 2=Monday, ..., 7=Saturday)
        const dayMap = {
            'Saturday': 0,   // dayOfWeek = 7
            'Sunday': 0,     // dayOfWeek = 1
            'Monday': 0,     // dayOfWeek = 2
            'Tuesday': 0,    // dayOfWeek = 3
            'Wednesday': 0,  // dayOfWeek = 4
            'Thursday': 0,   // dayOfWeek = 5
            'Friday': 0      // dayOfWeek = 6
        };

        // Fill in actual data
        currentResults.forEach(row => {
            dayMap[row.dayName] = Math.round(parseFloat(row.profit) * 100) / 100;
        });

        // Convert to array format for chart (SAT to FRI)
        const chartData = [
            dayMap['Saturday'],
            dayMap['Sunday'],
            dayMap['Monday'],
            dayMap['Tuesday'],
            dayMap['Wednesday'],
            dayMap['Thursday'],
            dayMap['Friday']
        ];

        // Calculate totals and growth
        const currentPeriodTotal = Object.values(dayMap).reduce((sum, profit) => sum + profit, 0);
        const previousPeriodTotal = parseFloat(previousResults[0]?.totalProfit || 0);

        // Calculate growth percentage
        let growth = 0;
        if (previousPeriodTotal > 0) {
            growth = Math.round(((currentPeriodTotal - previousPeriodTotal) / previousPeriodTotal) * 100);
        } else if (currentPeriodTotal > 0) {
            growth = 100;
        }

        return res.status(200).json({
            profit: Math.round(currentPeriodTotal * 100) / 100,
            growth: growth,
            data: chartData,
            dateRange: {
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0]
            }
        });

    } catch (error) {
        console.error('Error getting profit chart data:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * @desc    Get profit data for different time periods
 * @route   GET /api/dashboard/profit-chart/period
 * @access  Admin
 * @query   period (daily, weekly, monthly), count (number of periods)
 */
export const getProfitChartByPeriod = async (req, res) => {
    try {
        const {
            period = 'weekly', // daily, weekly, monthly
            count = 1 // number of periods to look back
        } = req.query;

        let startDate, endDate;
        const now = new Date();

        switch (period) {
            case 'daily':
                // Last N days
                endDate = new Date(now);
                startDate = new Date(now.getTime() - ((parseInt(count) - 1) * 24 * 60 * 60 * 1000));
                break;

            case 'weekly':
                // Last N weeks (default)
                endDate = new Date(now);
                startDate = new Date(now.getTime() - ((parseInt(count) * 7 - 1) * 24 * 60 * 60 * 1000));
                break;

            case 'monthly':
                // Last N months
                endDate = new Date(now);
                startDate = new Date(now);
                startDate.setMonth(startDate.getMonth() - parseInt(count) + 1);
                startDate.setDate(1); // First day of the month
                break;

            default:
                return res.status(400).json({ message: 'Invalid period. Use: daily, weekly, or monthly' });
        }

        // Calculate previous period for comparison
        const periodLength = endDate.getTime() - startDate.getTime();
        const prevEndDate = new Date(startDate.getTime() - 1);
        const prevStartDate = new Date(prevEndDate.getTime() - periodLength);

        // Query for current period
        const currentQuery = `
            SELECT 
                DAYOFWEEK(co.createdAt) as dayOfWeek,
                DAYNAME(co.createdAt) as dayName,
                COALESCE(SUM(co.amountPaid) - SUM(coi.quantity * p.costPrice), 0) as profit
            FROM customerorders co
            INNER JOIN customerorderItems coi ON co.id = coi.orderId
            INNER JOIN product p ON coi.productId = p.productId
            WHERE co.createdAt >= :startDate 
                AND co.createdAt <= :endDate
                AND co.status = 'Shipped'
            GROUP BY DAYOFWEEK(co.createdAt), DAYNAME(co.createdAt)
            ORDER BY DAYOFWEEK(co.createdAt)
        `;

        // Query for previous period total
        const previousQuery = `
            SELECT 
                COALESCE(SUM(co.amountPaid) - SUM(coi.quantity * p.costPrice), 0) as totalProfit
            FROM customerorders co
            INNER JOIN customerorderItems coi ON co.id = coi.orderId
            INNER JOIN product p ON coi.productId = p.productId
            WHERE co.createdAt >= :prevStartDate 
                AND co.createdAt <= :prevEndDate
                AND co.status = 'Shipped'
        `;

        const [currentResults, previousResults] = await Promise.all([
            sequelize.query(currentQuery, {
                replacements: { startDate, endDate },
                type: sequelize.QueryTypes.SELECT
            }),
            sequelize.query(previousQuery, {
                replacements: {
                    prevStartDate,
                    prevEndDate
                },
                type: sequelize.QueryTypes.SELECT
            })
        ]);

        // For weekly view, ensure all days are present
        const dayMap = {
            'Saturday': 0, 'Sunday': 0, 'Monday': 0, 'Tuesday': 0,
            'Wednesday': 0, 'Thursday': 0, 'Friday': 0
        };

        currentResults.forEach(row => {
            dayMap[row.dayName] = Math.round(parseFloat(row.profit) * 100) / 100;
        });

        const chartData = [
            dayMap['Saturday'],
            dayMap['Sunday'],
            dayMap['Monday'],
            dayMap['Tuesday'],
            dayMap['Wednesday'],
            dayMap['Thursday'],
            dayMap['Friday']
        ];

        const currentTotal = Object.values(dayMap).reduce((sum, profit) => sum + profit, 0);
        const previousTotal = parseFloat(previousResults[0]?.totalProfit || 0);

        let growth = 0;
        if (previousTotal > 0) {
            growth = Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
        } else if (currentTotal > 0) {
            growth = 100;
        }

        return res.status(200).json({
            profit: Math.round(currentTotal * 100) / 100,
            growth: growth,
            data: chartData,
            period: period,
            dateRange: {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
            }
        });

    } catch (error) {
        console.error('Error getting profit chart data by period:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};