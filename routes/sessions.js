const express = require('express');
const router  = express.Router();
const Session = require('../models-db/Session');

router.post('/log', async (req, res) => {
  try {
    const session = await new Session(req.body).save();
    res.json({ success: true, sessionId: session.sessionId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:userId', async (req, res) => {
  try {
    const sessions = await Session
      .find({ userId: req.params.userId })
      .sort({ timestamp: -1 }).limit(20);
    res.json(sessions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;