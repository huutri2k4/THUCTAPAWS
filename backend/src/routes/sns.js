const express = require('express');
const router = express.Router();
const snsService = require('../services/sns');

// Public route to publish message to SNS topic
router.post('/publish', async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'message is required' });
    const result = await snsService.publish(subject, message);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
