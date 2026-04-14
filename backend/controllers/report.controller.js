import { getSummaryReport } from '../services/report.service.js';

export const summaryReport = async (req, res) => {
  try {
    const report = await getSummaryReport(req.query, req.user);
    return res.json({ success: true, data: report });
  } catch (err) {
    console.error('❌ Report Summary Error:', err);
    const statusCode = err.code === 'VALIDATION_ERROR' ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Failed to generate summary report',
      },
    });
  }
};