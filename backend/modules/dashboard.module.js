import * as dashboardService from '../services/dashboard.service.js';
import { getCache, setCache } from '../utils/cache.js';

// 🔹 Dashboard Summary
export const getDashboardSummaryModule = async (userId) => {
  const cacheKey = `dashboard:summary:${userId}`;

  // 1. Check cache
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log('⚡ Cache HIT: Dashboard Summary');
    return cached;
  }

  // 2. Fetch from DB
  const data = await dashboardService.getDashboardSummary(userId);

  // 3. Store in cache (TTL: 60s)
  await setCache(cacheKey, data, 60);

  return data;
};

// 🔹 Dashboard Tasks
export const getDashboardTasksModule = async (userId) => {
  const cacheKey = `dashboard:tasks:${userId}`;

  const cached = await getCache(cacheKey);
  if (cached) {
    console.log('⚡ Cache HIT: Dashboard Tasks');
    return cached;
  }

  const data = await dashboardService.getDashboardTasks(userId);

  await setCache(cacheKey, data, 60);

  return data;
};