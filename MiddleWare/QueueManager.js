const Queue = require('bull');
const Redis = require('ioredis');

// Configure Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

// Create queues for different operations
const messageQueue = new Queue('message-processing', {
  redis: {
    port: process.env.REDIS_PORT || 6379,
    host: process.env.REDIS_HOST || '127.0.0.1',
    password: process.env.REDIS_PASSWORD
  }
});

const audioQueue = new Queue('audio-processing');
const whatsappQueue = new Queue('whatsapp-sending');

// Add rate limiting
messageQueue.rateLimiter = {
  max: 50, // Maximum number of jobs processed
  duration: 1000 // Per second
};

whatsappQueue.rateLimiter = {
  max: 30,
  duration: 1000
};

module.exports = {
  messageQueue,
  audioQueue,
  whatsappQueue,
  redis
}; 