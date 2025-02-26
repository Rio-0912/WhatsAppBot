const { Hisab } = require('../Modals');
const { log } = console;
const { generateUID } = require('../MiddleWare/Sequence'); // Import generateUID

// Create a new hisab entry
const createHisab = async (req, res) => {
    try {
        const { username } = req.body;
        
        // Check if hisab already exists
        let existingHisab = await Hisab.findOne({ username });
        if (existingHisab) {
            return res.status(400).json({ 
                success: false, 
                error: 'Hisab already exists for this user' 
            });
        }

        const uid = await generateUID(Hisab); // Generate unique UID
        const hisab = new Hisab({ username, uid });
        await hisab.save();
        
        res.status(201).json({ success: true, data: hisab });
    } catch (error) {
        log('Error in createHisab:', error);
        res.status(500).json({ success: false, error: error.message });
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
