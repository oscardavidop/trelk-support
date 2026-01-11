/**
 * MongoDB Connection
 */

import mongoose from 'mongoose';
import { ENV } from '../config/index.js';
import { logger } from '../services/logger.js';

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) return;

  try {
    await mongoose.connect(ENV.MONGODB_URI);
    isConnected = true;
    logger.info('api', { action: 'mongodb_connected' });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    logger.error('api', { action: 'mongodb_error', error: String(error) });
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return;
  
  await mongoose.disconnect();
  isConnected = false;
  logger.info('api', { action: 'mongodb_disconnected' });
}

// Handle connection events
mongoose.connection.on('error', (err) => {
  logger.error('api', { action: 'mongodb_error', error: String(err) });
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  logger.warn('api', { action: 'mongodb_disconnected' });
});
