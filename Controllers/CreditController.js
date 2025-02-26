const { Credit } = require('../Models/Modals');
const { log } = console;
const { generateUID } = require('../MiddleWare/Sequence');

// Create a new credit entry
const createCredit = async (req, res) => {
    try {
        const { data } = req.body; // Expect array of items
        
        if (!Array.isArray(data)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Data must be an array' 
            });
        }

        const savedCredits = [];
        
        for (const item of data) {
            const uid = await generateUID(Credit);
            const credit = new Credit({
                username: item.username,
                itemNameAndQuantity: item.itemNameAndQuantity,
                amount: item.amount,
                uid
            });

            const savedCredit = await credit.save();
            savedCredits.push(savedCredit);
        }

        return res.status(201).json({ 
            success: true, 
            data: savedCredits 
        });
    } catch (error) {
        log('Error in createCredit:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

// Get all credits for a user
const getCreditsByUser = async (req, res) => {
    try {
        const { username } = req.params;
        const credits = await Credit.find({ username });
        res.status(200).json({ success: true, data: credits });
    } catch (error) {
        log('Error in getCreditsByUser:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get a specific credit by UID
const getCreditByUid = async (req, res) => {
    try {
        const { uid } = req.params;
        const credit = await Credit.findOne({ uid });
        
        if (!credit) {
            return res.status(404).json({ success: false, error: 'Credit not found' });
        }
        
        res.status(200).json({ success: true, data: credit });
    } catch (error) {
        log('Error in getCreditByUid:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update a credit entry
const updateCredit = async (req, res) => {
    try {
        const { uid } = req.params;
        const updates = req.body;
        
        const credit = await Credit.findOneAndUpdate(
            { uid },
            updates,
            { new: true, runValidators: true }
        );

        if (!credit) {
            return res.status(404).json({ success: false, error: 'Credit not found' });
        }

        res.status(200).json({ success: true, data: credit });
    } catch (error) {
        log('Error in updateCredit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete a credit entry
const deleteCredit = async (req, res) => {
    try {
        const { uid } = req.params;
        const credit = await Credit.findOneAndDelete({ uid });

        if (!credit) {
            return res.status(404).json({ success: false, error: 'Credit not found' });
        }

        res.status(200).json({ success: true, data: credit });
    } catch (error) {
        log('Error in deleteCredit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    createCredit,
    getCreditsByUser,
    getCreditByUid,
    updateCredit,
    deleteCredit
};
