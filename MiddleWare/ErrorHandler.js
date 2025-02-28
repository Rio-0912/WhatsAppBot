const { redis } = require('./QueueManager');

class ErrorHandler {
  static async handleError(error, context) {
    console.error(`Error in ${context}:`, error);
    
    // Log error to monitoring service (e.g., Sentry)
    if (process.env.NODE_ENV === 'production') {
      // Sentry.captureException(error);
    }

    // Store error in Redis for analysis
    await redis.lpush('error_logs', JSON.stringify({
      timestamp: new Date(),
      context,
      error: error.message,
      stack: error.stack
    }));

    return {
      success: false,
      error: error.message,
      context
    };
  }

  static async handleRetry(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
}

module.exports = ErrorHandler; 