const { Hisab } = require('../Models/Modals');
const { log } = console;
const { generateUID } = require('../MiddleWare/Sequence'); // Import generateUID

// Create a new hisab entry
const createHisab = async (req, res = null) => {
    try {
        const { username, amount, date, previousBalance } = req.body;
        
        if (!username || amount === undefined) {
            const error = { success: false, error: 'Username and amount are required' };
            return res ? res.status(400).json(error) : error;
        }

        // Generate new UID for hisab entry
        const uid = await generateUID(Hisab);

        // Create new hisab entry with exact timestamp and previous balance
        const hisab = new Hisab({
            username,
            amount: Number(amount),
            // date: date || new Date(), // Use provided date or current timestamp
            previousBalance: Number(previousBalance || 0), // Store total balance before this payment
            uid
        });

        const savedHisab = await hisab.save();
        console.log(`Created new hisab entry for ${username} at ${savedHisab.date}`);

        const response = { success: true, data: savedHisab };
        return res ? res.status(201).json(response) : response;
        
    } catch (error) {
        console.log('Error in createHisab:', error);
        const errorResponse = { success: false, error: error.message };
        return res ? res.status(500).json(errorResponse) : errorResponse;
    }
};

// Get hisab by username
const getHisabByUser = async (req, res) => {
    try {
        const { username } = req.params;
        const hisab = await Hisab.findOne({ username });
        
        if (!hisab) {
            return res.status(404).json({ 
                success: false, 
                error: 'No hisab found for this user' 
            });
        }
        
        res.status(200).json({ success: true, data: hisab });
    } catch (error) {
        log('Error in getHisabByUser:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get all hisabs
const getAllHisabs = async (req, res) => {
    try {
        const hisabs = await Hisab.find();
        res.status(200).json({ success: true, data: hisabs });
    } catch (error) {
        log('Error in getAllHisabs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update hisab
const updateHisab = async (req, res) => {
    try {
        const { username } = req.params;
        const updates = req.body;
        
        const hisab = await Hisab.findOneAndUpdate(
            { username },
            updates,
            { new: true, runValidators: true }
        );

        if (!hisab) {
            return res.status(404).json({ 
                success: false, 
                error: 'No hisab found for this user' 
            });
        }

        res.status(200).json({ success: true, data: hisab });
    } catch (error) {
        log('Error in updateHisab:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete hisab
const deleteHisab = async (req, res) => {
    try {
        const { username } = req.params;
        const hisab = await Hisab.findOneAndDelete({ username });

        if (!hisab) {
            return res.status(404).json({ 
                success: false, 
                error: 'No hisab found for this user' 
            });
        }

        res.status(200).json({ success: true, data: hisab });
    } catch (error) {
        log('Error in deleteHisab:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    createHisab,
    getHisabByUser,
    getAllHisabs,
    updateHisab,
    deleteHisab
};
