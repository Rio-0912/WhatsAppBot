const mongoose = require('mongoose');
const logger = require('../utils/logger');

class ConnectionManager {
  static async initialize() {
    try {
      if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI environment variable is not defined');
      }

      await mongoose.connect(process.env.MONGO_URI, {
        // useNewUrlParser: true,
        // useUnifiedTopology: true,
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000,
        maxPoolSize: 50,
        minPoolSize: 5
      });

      logger.checkpoint('MongoDB connected successfully');

      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error', error);
        setTimeout(() => {
          this.initialize().catch(console.error);
        }, 10000);
      });

      mongoose.connection.on('disconnected', () => {
        logger.checkpoint('MongoDB disconnected, attempting reconnection');
        setTimeout(() => {
          this.initialize().catch(console.error);
        }, 10000);
      });

    } catch (error) {
      logger.error('Failed to initialize MongoDB connection', error);
      setTimeout(() => {
        this.initialize().catch(console.error);
      }, 10000);
    }
  }

  static async cleanup() {
    try {
      await mongoose.connection.close();
      logger.checkpoint('MongoDB connection closed');
    } catch (error) {
      logger.error('Error during MongoDB cleanup', error);
    }
  }
}

module.exports = { ConnectionManager }; 