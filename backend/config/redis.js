import { createClient } from 'redis';

let redisClient = null;
let isRedisReady = false;
let errorLogged = false; // ✅ ADD THIS

try {
    redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
        socket: {
            reconnectStrategy: false, // ❌ stops retry loop completely
        },
    });

    redisClient.on('connect', () => {
        isRedisReady = true;
        errorLogged = false; // reset if it reconnects
        console.log('✅ Redis Connected');
    });

    redisClient.on('error', (err) => {
        isRedisReady = false;

        // ✅ LOG ONLY ONCE
        if (!errorLogged) {
            console.log('⚠️ Redis not available, running without cache');
            errorLogged = true;
        }
    });

    // connect but don't crash app if fails
    redisClient.connect().catch(() => {
        if (!errorLogged) {
            console.log('⚠️ Redis connection failed');
            errorLogged = true;
        }
    });

} catch (error) {
    console.log('⚠️ Redis init failed');
}

export { redisClient, isRedisReady };