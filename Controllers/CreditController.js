const { Credit, Hisab } = require('../Models/Modals');
const { log } = console;
const { generateUID } = require('../MiddleWare/Sequence');

// Create a new credit entry
const createCredit = async (req, res = null) => {
    try {
        const { data } = req.body;
        
        if (!Array.isArray(data)) {
            const error = { success: false, error: 'Data must be an array' };
            return res ? res.status(400).json(error) : error;
        }

        const savedCredits = [];
        
        for (const item of data) {
            const uid = await generateUID(Credit);
            const credit = new Credit({
                username: item.username,
                itemNameAndQuantity: item.itemNameAndQuantity,
                amount: item.amount,
                // date: item.date || new Date(),  // Ensure date is set
                uid
            });

            const savedCredit = await credit.save();
            savedCredits.push(savedCredit);
        }

        const result = { success: true, data: savedCredits };
        return res ? res.status(201).json(result) : result;

    } catch (error) {
        log('Error in createCredit:', error);
        const errorResponse = { success: false, error: error.message };
        return res ? res.status(500).json(errorResponse) : errorResponse;
    }
};

// Get all credits for a user
const getCreditsByUser = async (req, res = null) => {
    try {
        const { username } = req.params;

        // First, get the latest hisab entry for this user
        const latestHisab = await Hisab.findOne({ username })
            .sort({ date: -1 });

        // Get credits after the latest hisab date
        const query = latestHisab 
            ? { 
                username,
                date: { $gt: latestHisab.date }
              }
            : { username };

        const credits = await Credit.find(query).sort({ date: -1 });
        const result = { 
            success: true, 
            data: credits,
            latestHisab // Include latest hisab info in response
        };
        return res ? res.status(200).json(result) : result;
    } catch (error) {
        log('Error in getCreditsByUser:', error);
        const errorResponse = { success: false, error: error.message };
        return res ? res.status(500).json(errorResponse) : errorResponse;
    }
};

// Get a specific credit by UID
const getCreditByUid = async (req, res = null) => {
    try {
        const { uid } = req.params;
        const credit = await Credit.findOne({ uid });
        
        if (!credit) {
            const error = { success: false, error: 'Credit not found' };
            return res ? res.status(404).json(error) : error;
        }
        
        const result = { success: true, data: credit };
        return res ? res.status(200).json(result) : result;
    } catch (error) {
        log('Error in getCreditByUid:', error);
        const errorResponse = { success: false, error: error.message };
        return res ? res.status(500).json(errorResponse) : errorResponse;
    }
};

// Update a credit entry
const updateCredit = async (req, res = null) => {
    try {
        const { uid } = req.params;
        const updates = req.body;
        
        const credit = await Credit.findOneAndUpdate(
            { uid },
            updates,
            { new: true, runValidators: true }
        );

        if (!credit) {
            const error = { success: false, error: 'Credit not found' };
            return res ? res.status(404).json(error) : error;
        }

        const result = { success: true, data: credit };
        return res ? res.status(200).json(result) : result;
    } catch (error) {
        log('Error in updateCredit:', error);
        const errorResponse = { success: false, error: error.message };
        return res ? res.status(500).json(errorResponse) : errorResponse;
    }
};

// Delete a credit entry
const deleteCredit = async (req, res = null) => {
    try {
        const { uid } = req.params;
        const credit = await Credit.findOneAndDelete({ uid });

        if (!credit) {
            const error = { success: false, error: 'Credit not found' };
            return res ? res.status(404).json(error) : error;
        }

        const result = { success: true, data: credit };
        return res ? res.status(200).json(result) : result;
    } catch (error) {
        log('Error in deleteCredit:', error);
        const errorResponse = { success: false, error: error.message };
        return res ? res.status(500).json(errorResponse) : errorResponse;
    }
};

module.exports = {
    createCredit,
    getCreditsByUser,
    getCreditByUid,
    updateCredit,
    deleteCredit
};
