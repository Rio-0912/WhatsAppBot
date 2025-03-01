const logger = {
  checkpoint: (message, data = {}) => {
    console.log(`[CHECKPOINT] ${message}`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  },

  error: (message, error) => {
    console.error(`[ERROR] ${message}`, {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });
  },

  debug: (message, data = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG] ${message}`, {
        timestamp: new Date().toISOString(),
        ...data
      });
    }
  }
};

module.exports = logger; 