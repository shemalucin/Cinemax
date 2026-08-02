import express from 'express';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Validation rules for report submission
const reportValidationRules = [
  body('itemId').notEmpty().withMessage('Item ID is required'),
  body('itemType').isIn(['movie', 'episode', 'comment']).withMessage('Invalid item type'),
  body('reportType').notEmpty().withMessage('Report type is required'),
  body('reportType').isIn(['video_not_playing', 'wrong_content', 'audio_issues', 'subtitle_issues', 'broken_embed', 'other']).withMessage('Invalid report type'),
];

// In-memory storage for reports (in production, this would be stored in a database)
const reports: any[] = [];

// POST /api/reports - Submit a new report
router.post('/', reportValidationRules, async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid report data', details: errors.array() });
    }

    const { itemId, itemType, itemTitle, reportType, customMessage } = req.body;

    // Create report object
    const report = {
      id: Date.now().toString(),
      itemId,
      itemType,
      itemTitle: itemTitle || 'Unknown',
      reportType,
      customMessage: customMessage || null,
      userId: req.user?.id || 'anonymous',
      username: req.user?.name || 'Anonymous',
      status: 'pending',
      createdAt: new Date().toISOString(),
      ipAddress: req.ip || req.socket.remoteAddress,
    };

    // Store report (in production, save to database)
    reports.push(report);

    // Log for admin notification (in production, this would send email/notification)
    console.log('🚨 NEW REPORT SUBMITTED:', {
      id: report.id,
      type: report.reportType,
      item: report.itemTitle,
      user: report.username,
      timestamp: report.createdAt,
    });

    res.status(201).json({ 
      success: true, 
      message: 'Report submitted successfully',
      reportId: report.id
    });

  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// GET /api/reports - Get all reports (admin only, would require authentication in production)
router.get('/', (req, res) => {
  // In production, this would require admin authentication
  res.json({
    reports: reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    total: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
  });
});

// GET /api/reports/:id - Get a specific report (admin only)
router.get('/:id', (req, res) => {
  const report = reports.find(r => r.id === req.params.id);
  
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  res.json(report);
});

// PATCH /api/reports/:id - Update report status (admin only)
router.patch('/:id', (req, res) => {
  const { status } = req.body;
  const reportIndex = reports.findIndex(r => r.id === req.params.id);
  
  if (reportIndex === -1) {
    return res.status(404).json({ error: 'Report not found' });
  }

  if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  reports[reportIndex].status = status;
  reports[reportIndex].updatedAt = new Date().toISOString();

  res.json({ 
    success: true, 
    message: 'Report status updated',
    report: reports[reportIndex]
  });
});

export default router;