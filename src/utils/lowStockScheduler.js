import cron from 'node-cron';
import { checkLowStockAlerts } from '../modules/lowstock/lowStock.controller.js';
import { generateLowStockOrders } from '../modules/lowstock/lowStock.controller.js';
import productModel from '../../DB/Models/product.model.js';
import supplierOrderModel from '../../DB/Models/supplier.model.js';
import { Op } from 'sequelize';
import sequelize from '../../DB/Connection.js';

// Configuration for low stock monitoring
const LOW_STOCK_CONFIG = {
    // Check for low stock every hour during business hours (9 AM - 6 PM)
    alertSchedule: '0 9-18 * * 1-6', // Every hour from 9-18, Monday to Saturday

    // Auto-generate orders once daily at 8 AM on weekdays
    autoOrderSchedule: '0 8 * * 1-5', // 8 AM, Monday to Friday

    // Check for critical stock (quantity = 0) every 30 minutes during business hours
    criticalStockSchedule: '*/30 9-18 * * 1-6', // Every 30 minutes from 9-18, Monday to Saturday

    // Enable/disable automatic order generation
    autoGenerateOrders: true,

    // Only auto-generate if there are no pending draft orders for the same products
    preventDuplicateOrders: true
};

// Enhanced low stock alert checker with email/notification support
const checkAndNotifyLowStock = async () => {
    try {
        console.log('🔍 Running scheduled low stock check...');

        const alertResult = await checkLowStockAlerts();

        if (alertResult.error) {
            console.error('❌ Error during low stock check:', alertResult.error);
            return;
        }

        if (alertResult.alertCount > 0) {
            console.log(`🚨 LOW STOCK ALERT: ${alertResult.alertCount} products need attention`);

            // Here you can add notification services:
            // await sendEmailAlert(alertResult.products);
            // await sendSlackNotification(alertResult.products);
            // await updateDashboardAlerts(alertResult.products);

            // Log critical items (quantity = 0)
            const criticalItems = alertResult.products.filter(p => p.quantity === 0);
            if (criticalItems.length > 0) {
                console.log(`🔴 CRITICAL: ${criticalItems.length} products are completely out of stock:`);
                criticalItems.forEach(item => {
                    console.log(`   - ${item.name}: OUT OF STOCK`);
                });
            }
        } else {
            console.log('✅ No low stock items found');
        }

        return alertResult;
    } catch (error) {
        console.error('❌ Error in scheduled low stock check:', error);
    }
};

// Auto-generate orders for low stock items (if enabled)
const autoGenerateOrdersIfNeeded = async () => {
    try {
        if (!LOW_STOCK_CONFIG.autoGenerateOrders) {
            console.log('⏭️ Auto order generation is disabled');
            return;
        }

        console.log('🔄 Checking if automatic order generation is needed...');

        // Check for low stock items
        const lowStockProducts = await productModel.findAll({
            where: {
                [Op.and]: [
                    sequelize.where(
                        sequelize.col('quantity'),
                        Op.lte,
                        sequelize.col('lowStock')
                    ),
                    { status: 'Active' }
                ]
            },
            attributes: ['productId', 'name', 'quantity', 'lowStock']
        });

        if (lowStockProducts.length === 0) {
            console.log('✅ No low stock items found for auto-order generation');
            return;
        }

        // Check if there are existing draft orders for these products
        if (LOW_STOCK_CONFIG.preventDuplicateOrders) {
            const existingDraftOrders = await supplierOrderModel.findAll({
                where: { status: 'Draft' },
                include: [
                    {
                        model: supplierOrderItemModel,
                        as: 'items',
                        where: {
                            productId: {
                                [Op.in]: lowStockProducts.map(p => p.productId)
                            }
                        }
                    }
                ]
            });

            if (existingDraftOrders.length > 0) {
                console.log(`⏸️ Skipping auto-generation: ${existingDraftOrders.length} draft orders already exist for low stock products`);
                return;
            }
        }

        console.log(`🛒 Auto-generating orders for ${lowStockProducts.length} low stock items...`);

        // Create a mock request/response for the controller
        const mockReq = { body: {} };
        let orderResult = null;
        const mockRes = {
            status: (code) => ({
                json: (data) => {
                    orderResult = { statusCode: code, data };
                    return mockRes;
                }
            })
        };

        // Import and call the generateLowStockOrders controller
        const { generateLowStockOrders } = await import('../modules/lowstock/lowStock.controller.js');
        await generateLowStockOrders(mockReq, mockRes);

        if (orderResult && orderResult.statusCode === 201) {
            console.log(`✅ Successfully generated ${orderResult.data.count} draft orders`);
            console.log('📋 Orders created and awaiting admin confirmation');
        } else {
            console.log('⚠️ Auto-order generation completed with warnings');
        }

    } catch (error) {
        console.error('❌ Error in automatic order generation:', error);
    }
};

// Check for critical stock items (more frequent)
const checkCriticalStock = async () => {
    try {
        const criticalItems = await productModel.findAll({
            where: {
                quantity: 0,
                status: 'Active'
            },
            attributes: ['productId', 'name', 'quantity', 'lowStock']
        });

        if (criticalItems.length > 0) {
            console.log(`🔴 CRITICAL STOCK ALERT: ${criticalItems.length} products are out of stock!`);
            criticalItems.forEach(item => {
                console.log(`   - ${item.name}: OUT OF STOCK`);
            });

            // Here you could implement immediate notification for critical stock:
            // await sendUrgentAlert(criticalItems);
            // await notifyManagers(criticalItems);
        }
    } catch (error) {
        console.error('❌ Error checking critical stock:', error);
    }
};

// Initialize the scheduler
const initializeLowStockScheduler = () => {
    console.log('🚀 Initializing Low Stock Monitoring Scheduler...');
    console.log(`📅 Alert Schedule: ${LOW_STOCK_CONFIG.alertSchedule}`);
    console.log(`📅 Auto-Order Schedule: ${LOW_STOCK_CONFIG.autoOrderSchedule}`);
    console.log(`📅 Critical Stock Schedule: ${LOW_STOCK_CONFIG.criticalStockSchedule}`);

    // Schedule regular low stock alerts
    cron.schedule(LOW_STOCK_CONFIG.alertSchedule, async () => {
        console.log('\n⏰ Scheduled Low Stock Check Started');
        await checkAndNotifyLowStock();
    }, {
        timezone: "UTC", // Adjust to your timezone
        scheduled: true
    });

    // Schedule automatic order generation
    cron.schedule(LOW_STOCK_CONFIG.autoOrderSchedule, async () => {
        console.log('\n⏰ Scheduled Auto-Order Generation Started');
        await autoGenerateOrdersIfNeeded();
    }, {
        timezone: "UTC", // Adjust to your timezone
        scheduled: true
    });

    // Schedule critical stock checks
    cron.schedule(LOW_STOCK_CONFIG.criticalStockSchedule, async () => {
        await checkCriticalStock();
    }, {
        timezone: "UTC", // Adjust to your timezone
        scheduled: true
    });

    console.log('✅ Low Stock Monitoring Scheduler initialized successfully');
};

// Manual functions for testing or one-time execution
const runManualLowStockCheck = async () => {
    console.log('🔧 Running manual low stock check...');
    return await checkAndNotifyLowStock();
};

const runManualOrderGeneration = async () => {
    console.log('🔧 Running manual order generation...');
    return await autoGenerateOrdersIfNeeded();
};

// Get scheduler status and statistics
const getSchedulerStatus = async () => {
    try {
        const lowStockCount = await productModel.count({
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
        });

        const criticalStockCount = await productModel.count({
            where: {
                quantity: 0,
                status: 'Active'
            }
        });

        const draftOrdersCount = await supplierOrderModel.count({
            where: { status: 'Draft' }
        });

        return {
            isActive: true,
            config: LOW_STOCK_CONFIG,
            currentStats: {
                lowStockItems: lowStockCount,
                criticalStockItems: criticalStockCount,
                pendingDraftOrders: draftOrdersCount
            },
            lastChecked: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error getting scheduler status:', error);
        return {
            isActive: false,
            error: error.message
        };
    }
};

export {
    initializeLowStockScheduler,
    runManualLowStockCheck,
    runManualOrderGeneration,
    getSchedulerStatus,
    LOW_STOCK_CONFIG
};