const { Buy } = require('../Models/Modals');
const { log } = console;
const { generateUID } = require('../MiddleWare/Sequence'); // Import generateUID
const moment = require('moment-timezone');
const logger = require('../utils/logger');

// Modified to handle array of items
const createBuy = async (req, res) => {
    try {
        const { data } = req.body; // This will be our array of items
        
        if (!Array.isArray(data)) {
            throw new Error('Input must be an array of items');
        }

        const savedItems = [];
        
        // Process each item in the array
        for (const item of data) {
            const uid = await generateUID(Buy);
            
            const buy = new Buy({
                itemNameAndQuantity: item.itemNameAndQuantity,
                purchasePrice: item.purchasePrice,
                sellingPrice: item.sellingPrice,
                uid,
                date: moment().tz('Asia/Kolkata').startOf('day').toDate() // Set IST date without time
            });

            const savedItem = await buy.save();
            savedItems.push(savedItem);
        }

        log("All buy entries saved:", savedItems);
        return { success: true, data: savedItems };
    } catch (error) {
        console.error("Error in createBuy:", error);
        return { success: false, error: error.message };
    }
};

// Get all purchases
const getAllPurchases = async (req, res) => {
    try {
        const purchases = await Buy.find().sort({ date: -1 });
        res.status(200).json({ success: true, data: purchases });
    } catch (error) {
        log('Error in getAllPurchases:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get purchase by UID
const getPurchaseByUid = async (req, res) => {
    try {
        const { uid } = req.params;
        const purchase = await Buy.findOne({ uid });
        
        if (!purchase) {
            return res.status(404).json({ 
                success: false, 
                error: 'Purchase record not found' 
            });
        }
        
        res.status(200).json({ success: true, data: purchase });
        
    } catch (error) {
        log('Error in getPurchaseByUid:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get purchases by date range
const getPurchasesByDateRange = async (dateStr) => {
    try {
        if (!dateStr || typeof dateStr !== 'string') {
            return {
                success: false,
                error: 'Invalid date format. Please use DD.MM.YY'
            };
        }

        logger.checkpoint('Processing date query:', { dateStr });

        // Handle date range query (e.g., "27.2.25-1.3.25")
        if (dateStr.includes('-')) {
            const [startDateStr, endDateStr] = dateStr.split('-');
            
            // Parse start date
            const [startDay, startMonth, startYear] = startDateStr.trim().split('.');
            const startDate = moment.tz(`20${startYear}-${startMonth}-${startDay}`, 'YYYY-MM-DD', 'Asia/Kolkata').startOf('day');
            
            // Parse end date
            const [endDay, endMonth, endYear] = endDateStr.trim().split('.');
            const endDate = moment.tz(`20${endYear}-${endMonth}-${endDay}`, 'YYYY-MM-DD', 'Asia/Kolkata').endOf('day');

            logger.checkpoint('Date range query:', {
                start: startDate.format('YYYY-MM-DD HH:mm:ss'),
                end: endDate.format('YYYY-MM-DD HH:mm:ss')
            });

            const purchases = await Buy.find({
                date: {
                    $gte: startDate.toDate(),
                    $lte: endDate.toDate()
                }
            }).sort({ date: 1 });

            return processPurchases(purchases, `${startDateStr} to ${endDateStr}`);
        }

        // Handle single date query (e.g., "1.3.25")
        const [day, month, year] = dateStr.trim().split('.');
        const queryDate = moment.tz(`20${year}-${month}-${day}`, 'YYYY-MM-DD', 'Asia/Kolkata');
        const startOfDay = queryDate.clone().startOf('day');
        const endOfDay = queryDate.clone().endOf('day');

        logger.checkpoint('Single date query:', {
            date: queryDate.format('YYYY-MM-DD'),
            start: startOfDay.format('YYYY-MM-DD HH:mm:ss'),
            end: endOfDay.format('YYYY-MM-DD HH:mm:ss')
        });

        const purchases = await Buy.find({
            date: {
                $gte: startOfDay.toDate(),
                $lte: endOfDay.toDate()
            }
        }).sort({ date: 1 });

        return processPurchases(purchases, dateStr);

    } catch (error) {
        logger.error('Error in getPurchasesByDateRange:', error);
        return {
            success: false,
            error: 'Error retrieving purchase data'
        };
    }
};

// Helper function to process purchases
const processPurchases = (purchases, dateStr) => {
    if (purchases.length === 0) {
        return {
            success: false,
            error: `No purchases found for ${dateStr}`
        };
    }

    const totalPurchaseAmount = purchases.reduce((sum, p) => sum + p.purchasePrice, 0);
    const totalSellingAmount = purchases.reduce((sum, p) => sum + p.sellingPrice, 0);

    return {
        success: true,
        data: {
            purchases,
            totalPurchaseAmount,
            totalSellingAmount
        }
    };
};

// Update purchase record
const updatePurchase = async (req, res) => {
    try {
        const { uid } = req.params;
        const updates = req.body;
        
        const purchase = await Buy.findOneAndUpdate(
            { uid },
            updates,
            { new: true, runValidators: true }
        );

        if (!purchase) {
            return res.status(404).json({ 
                success: false, 
                error: 'Purchase record not found' 
            });
        }

        res.status(200).json({ success: true, data: purchase });
    } catch (error) {
        log('Error in updatePurchase:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete purchase record
const deletePurchase = async (req, res) => {
    try {
        const { uid } = req.params;
        const purchase = await Buy.findOneAndDelete({ uid });

        if (!purchase) {
            return res.status(404).json({ 
                success: false, 
                error: 'Purchase record not found' 
            });
        }

        res.status(200).json({ success: true, data: purchase });
    } catch (error) {
        log('Error in deletePurchase:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get purchase summary
const getPurchaseSummary = async (req, res) => {
    try {
        const { period } = req.query; // 'daily', 'weekly', 'monthly'
        const now = new Date();
        let startDate;

        switch (period) {
            case 'weekly':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'monthly':
                startDate = new Date(now.setMonth(now.getMonth() - 1));
                break;
            default: // daily
                startDate = new Date(now.setHours(0, 0, 0, 0));
        }

        const purchases = await Buy.find({
            date: { $gte: startDate }
        }).sort({ date: 1 });

        const summary = {
            period,
            totalAmount: purchases.reduce((sum, purchase) => sum + purchase.amount, 0),
            numberOfPurchases: purchases.length,
            items: purchases.map(p => ({
                item: p.itemNameQuantity,
                amount: p.amount,
                date: p.date
            }))
        };

        res.status(200).json({ success: true, data: summary });
    } catch (error) {
        log('Error in getPurchaseSummary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    createBuy,
    getAllPurchases,
    getPurchaseByUid,
    getPurchasesByDateRange,
    updatePurchase,
    deletePurchase,
    getPurchaseSummary
};
