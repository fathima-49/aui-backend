const express = require('express');
const router  = express.Router();
const User    = require('../models-db/User');

router.post('/profile', async (req, res) => {
  try {
    const { userId, neurotype, preferences } = req.body;
    let user = await User.findOne({ userId });
    if (user) {
      Object.assign(user.preferences, preferences);
      await user.save();
    } else {
      user = await new User({ userId, neurotype, preferences }).save();
    }
    res.json({ success: true, user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/profile/:userId', async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;