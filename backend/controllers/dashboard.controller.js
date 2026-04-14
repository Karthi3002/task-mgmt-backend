import * as dashboardModule from '../modules/dashboard.module.js';// 🔹 DASHBOARD SUMMARY (counts + stats)
export const summary = async (req, res) => {
  try {
    const data = await dashboardModule.getDashboardSummaryModule(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 DASHBOARD TASK CARDS (top 5 per section)
export const taskCards = async (req, res) => {
  try {
    const data = await dashboardModule.getDashboardTasksModule(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};