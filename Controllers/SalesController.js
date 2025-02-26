const { Sales } = require('../Modals');
const { log } = console;
const { generateUID } = require('../MiddleWare/Sequence'); // Import generateUID

// Create a new sales record
const createSales = async (req, res) => {
    try {
        const { onlineSales, offlineSales } = req.body;
        
        const uid = await generateUID(Sales); // Generate unique UID
        const sales = new Sales({
            onlineSales: onlineSales || 0,
            offlineSales: offlineSales || 0,
            totalSales: (onlineSales || 0) + (offlineSales || 0),
            uid
        });

        await sales.save();
        res.status(201).json({ success: true, data: sales });
    } catch (error) {
        log('Error in createSales:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get sales by date range
const getSalesByDateRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const query = {
            date: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        };

        const sales = await Sales.find(query).sort({ date: 1 });
        
        // Calculate totals
        const totals = sales.reduce((acc, sale) => {
            acc.totalOnline += sale.onlineSales;
            acc.totalOffline += sale.offlineSales;
            acc.grandTotal += sale.totalSales;
            return acc;
        }, { totalOnline: 0, totalOffline: 0, grandTotal: 0 });

        res.status(200).json({ 
            success: true, 
            data: { sales, totals } 
        });
    } catch (error) {
        log('Error in getSalesByDateRange:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get sales by specific date
const getSalesByDate = async (req, res) => {
    try {
        const { date } = req.params;
        const targetDate = new Date(date);
        
        // Set time to start of day
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(targetDate.getDate() + 1);

        const sales = await Sales.find({
            date: {
                $gte: targetDate,
                $lt: nextDay
            }
        });

        res.status(200).json({ success: true, data: sales });
    } catch (error) {
        log('Error in getSalesByDate:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update sales record
const updateSales = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Calculate total sales if online or offline sales are updated
        if (updates.onlineSales !== undefined || updates.offlineSales !== undefined) {
            const currentSales = await Sales.findById(id);
            updates.totalSales = 
                (updates.onlineSales ?? currentSales.onlineSales) +
                (updates.offlineSales ?? currentSales.offlineSales);
        }

        const sales = await Sales.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        );

        if (!sales) {
            return res.status(404).json({ 
                success: false, 
                error: 'Sales record not found' 
            });
        }

        res.status(200).json({ success: true, data: sales });
    } catch (error) {
        log('Error in updateSales:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete sales record
const deleteSales = async (req, res) => {
    try {
        const { id } = req.params;
        const sales = await Sales.findByIdAndDelete(id);

        if (!sales) {
            return res.status(404).json({ 
                success: false, 
                error: 'Sales record not found' 
            });
        }

        res.status(200).json({ success: true, data: sales });
    } catch (error) {
        log('Error in deleteSales:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get sales summary
const getSalesSummary = async (req, res) => {
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

        const sales = await Sales.find({
            date: { $gte: startDate }
        }).sort({ date: 1 });

        const summary = {
            period,
            totalSales: sales.reduce((sum, sale) => sum + sale.totalSales, 0),
            onlineSales: sales.reduce((sum, sale) => sum + sale.onlineSales, 0),
            offlineSales: sales.reduce((sum, sale) => sum + sale.offlineSales, 0),
            numberOfTransactions: sales.length
        };

        res.status(200).json({ success: true, data: summary });
    } catch (error) {
        log('Error in getSalesSummary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    createSales,
    getSalesByDateRange,
    getSalesByDate,
    updateSales,
    deleteSales,
    getSalesSummary
};
