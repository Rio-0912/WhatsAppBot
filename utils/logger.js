const moment = require('moment-timezone');

const logger = {
  checkpoint: (message, data = {}) => {
    console.log(`[CHECKPOINT] ${message}`, {
      timestamp: moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
      ...data
    });
  },

  error: (message, error) => {
    console.error(`[ERROR] ${message}`, {
      timestamp: moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
      error: error.message,
      stack: error.stack
    });
  },

  debug: (message, data = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG] ${message}`, {
        timestamp: moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
        ...data
      });
    }
  }
};

module.exports = logger; 