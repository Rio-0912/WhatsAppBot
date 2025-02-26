const { Buy } = require('../Models/Modals');
const { log } = console;
const { generateUID } = require('../MiddleWare/Sequence'); // Import generateUID

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
                date: new Date(),
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
const getPurchasesByDateRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const purchases = await Buy.find({
            date: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        }).sort({ date: -1 });

        // Calculate total amount
        const totalAmount = purchases.reduce((sum, purchase) => sum + purchase.amount, 0);

        res.status(200).json({ 
            success: true, 
            data: { purchases, totalAmount } 
        });
    } catch (error) {
        log('Error in getPurchasesByDateRange:', error);
        res.status(500).json({ success: false, error: error.message });
    }
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
