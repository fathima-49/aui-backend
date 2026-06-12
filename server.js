const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const axios    = require('axios');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── MongoDB connection ──────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err.message));

// ── ML API URL (Flask running alongside on Render) ──────────────
// On Render: both processes share the same machine, so localhost works
const ML_API = process.env.ML_API_URL || 'http://localhost:5001';

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
  confidence:         Number,
  modelUsed:          String,
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

// ── Adaptations helper ───────────────────────────────────────────
function getAdaptations(state, neurotype) {
  const a = [];
  if (state === 'Distracted')     a.push('enable_focus_mode', 'reduce_animations', 'simplify_layout');
  if (state === 'Overstimulated') a.push('high_contrast', 'reduce_density', 'pause_animations', 'enlarge_text');
  if (neurotype === 'Dyslexia')   a.push('dyslexia_font');
  if (neurotype === 'ADHD')       a.push('chunked_content', 'progress_indicators');
  if (neurotype === 'ASD')        a.push('predictable_layout', 'reduce_transitions');
  return a;
}

// ── Rule-based fallback (used only if ML API is unavailable) ────
function ruleBased(data) {
  const { avg_gsr = 1, acc_std = 5, avg_engagement = 2, gaze_ratio = 0.7 } = data;
  if (avg_gsr > 3.0 && acc_std > 10) return { state: 'Overstimulated', confidence: 0.72 };
  if (avg_engagement < 1.5 || gaze_ratio < 0.3) return { state: 'Distracted', confidence: 0.68 };
  if (acc_std > 8 && avg_engagement < 2.0) return { state: 'Distracted', confidence: 0.65 };
  return { state: 'Focused', confidence: 0.80 };
}

// ── Predict route — calls ML Flask API ──────────────────────────
app.post('/api/predict/focus-state', async (req, res) => {
  const body = req.body;
  let state, confidence, modelUsed;

  try {
    // Call the ML Flask API
    // Map frontend behavioral signals to model feature names
    const mlPayload = {
      gsr_mean:  body.avg_gsr     || 1.0,
      gsr_std:   body.std_gsr     || 0.3,
      gsr_max:   body.max_gsr     || body.avg_gsr * 1.5 || 2.0,
      gsr_min:   body.min_gsr     || 0.1,
      gsr_range: (body.max_gsr - body.min_gsr) || body.avg_gsr || 1.0,
      gsr_slope: body.gsr_slope   || 0.0,
      acc_mean:  body.acc_mean    || 65.0,
      acc_std:   body.acc_std     || 12.0,
      acc_max:   body.acc_max     || 80.0,
      acc_p75:   body.acc_p75     || 70.0,
      tmp_mean:  body.tmp_mean    || 32.0,
      tmp_std:   body.tmp_std     || 0.5,
      tmp_slope: body.tmp_slope   || 0.0,
    };

    const mlResponse = await axios.post(`${ML_API}/ml/predict`, mlPayload, {
      timeout: 3000
    });

    state      = mlResponse.data.state;
    confidence = mlResponse.data.confidence;
    modelUsed  = mlResponse.data.model;

  } catch (mlError) {
    // ML API not reachable — use rule-based fallback
    console.log('ML API unavailable, using rule-based fallback:', mlError.message);
    const fallback = ruleBased(body);
    state      = fallback.state;
    confidence = fallback.confidence;
    modelUsed  = 'rule-based-fallback';
  }

  res.json({
    focusState:   state,
    confidence:   confidence,
    adaptations:  getAdaptations(state, body.neurotype),
    modelUsed:    modelUsed,
  });
});

// ── Health check ─────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const users    = await User.countDocuments();
    const sessions = await Session.countDocuments();

    // Check ML API status
    let mlStatus = 'unknown';
    try {
      const mlHealth = await axios.get(`${ML_API}/ml/health`, { timeout: 2000 });
      mlStatus = mlHealth.data.model_loaded ? 'loaded' : 'fallback';
    } catch {
      mlStatus = 'offline';
    }

    res.json({
      status:   'ok',
      storage:  'mongodb',
      db:       mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      ml_model: mlStatus,
      users,
      sessions,
    });
  } catch (e) {
    res.json({ status: 'ok', storage: 'mongodb', db: 'error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
