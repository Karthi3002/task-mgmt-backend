import { redisClient, isRedisReady } from '../config/redis.js';

// GET CACHE
export const getCache = async (key) => {
  if (!isRedisReady || !redisClient) return null;

  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

// SET CACHE
export const setCache = async (key, value, ttl = 60) => {
  if (!isRedisReady || !redisClient) return;

  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
  } catch {}
};

// DELETE CACHE
export const deleteCache = async (key) => {
  if (!isRedisReady || !redisClient) return;

  try {
    await redisClient.del(key);
  } catch {}
};