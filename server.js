const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── MongoDB connection ──────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err.message));

// ── Schemas ─────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  userId:      { type: String, required: true, unique: true },
  neurotype:   String,
  preferences: {
    colorTheme:     { type: String, default: 'default' },
    fontStyle:      { type: String, default: 'sans' },
    fontSize:       { type: String, default: 'medium' },
    animationSpeed: { type: String, default: 'normal' },
    focusMode:      { type: Boolean, default: false },
  },
  createdAt: { type: Date, default: Date.now },
});

const sessionSchema = new mongoose.Schema({
  userId:             String,
  sessionId:          String,
  neurotype:          String,
  behavioralData:     Object,
  predictedState:     String,
  adaptationsApplied: [String],
  timestamp:          { type: Date, default: Date.now },
});

const User    = mongoose.model('User',    userSchema);
const Session = mongoose.model('Session', sessionSchema);

// ── User routes ─────────────────────────────────────────────────
app.post('/api/users/profile', async (req, res) => {
  try {
    const { userId, neurotype, preferences } = req.body;
    const user = await User.findOneAndUpdate(
      { userId },
      { userId, neurotype, preferences },
      { upsert: true, new: true }
    );
    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/users/profile/:userId', async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Session routes ───────────────────────────────────────────────
app.post('/api/sessions/log', async (req, res) => {
  try {
    const session = await Session.create({
      ...req.body,
      timestamp: new Date(),
    });
    res.json({ success: true, sessionId: session.sessionId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/sessions/:userId', async (req, res) => {
  try {
    const sessions = await Session
      .find({ userId: req.params.userId })
      .sort({ timestamp: -1 })
      .limit(20);
    res.json(sessions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Predict route ────────────────────────────────────────────────
function getAdaptations(state, neurotype) {
  const a = [];
  if (state === 'Distracted')     a.push('enable_focus_mode','reduce_animations','simplify_layout');
  if (state === 'Overstimulated') a.push('high_contrast','reduce_density','pause_animations','enlarge_text');
  if (neurotype === 'Dyslexia')   a.push('dyslexia_font');
  if (neurotype === 'ADHD')       a.push('chunked_content','progress_indicators');
  if (neurotype === 'ASD')        a.push('predictable_layout','reduce_transitions');
  return a;
}

function predictState(data) {
  const { avg_gsr=1, acc_std=5, avg_engagement=2, gaze_ratio=0.7 } = data;
  if (avg_gsr > 3.0 && acc_std > 10) return 'Overstimulated';
  if (avg_engagement < 1.5 || gaze_ratio < 0.3) return 'Distracted';
  if (acc_std > 8 && avg_engagement < 2.0) return 'Distracted';
  return 'Focused';
}

app.post('/api/predict/focus-state', (req, res) => {
  const state = predictState(req.body);
  res.json({
    focusState:  state,
    confidence:  0.85,
    adaptations: getAdaptations(state, req.body.neurotype),
  });
});

// ── Health check ─────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const users    = await User.countDocuments();
    const sessions = await Session.countDocuments();
    res.json({
      status:   'ok',
      storage:  'mongodb',
      db:       mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      users,
      sessions,
    });
  } catch (e) {
    res.json({ status: 'ok', storage: 'mongodb', db: 'error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));