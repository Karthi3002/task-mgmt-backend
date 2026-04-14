import { redisClient, isRedisReady } from '../config/redis.js';

// 🔥 SAFE: clear dashboard cache for user
export const clearDashboardCache = async (userId) => {
  if (!isRedisReady || !redisClient) return; // ✅ skip if Redis OFF

  try {
    const pattern = `dashboard:*:${userId}`;

    // ✅ Use SCAN instead of KEYS (non-blocking)
    let cursor = '0';

    do {
      const result = await redisClient.scan(cursor, {
        MATCH: pattern,
        COUNT: 50,
      });

      cursor = result.cursor;
      const keys = result.keys;

      if (keys.length > 0) {
        const pipeline = redisClient.multi();

        keys.forEach((key) => {
          pipeline.del(key);
        });

        await pipeline.exec();
      }

    } while (cursor !== '0');

  } catch (err) {
    console.log('⚠️ Cache clear skipped');
  }
};