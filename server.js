const express = require('express');
const cors    = require('cors');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const users    = {};
const sessions = [];

app.post('/api/users/profile', (req, res) => {
  const { userId, neurotype, preferences } = req.body;
  users[userId] = { userId, neurotype, preferences, createdAt: new Date() };
  res.json({ success: true, user: users[userId] });
});

app.get('/api/users/profile/:userId', (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

app.post('/api/sessions/log', (req, res) => {
  const session = { ...req.body, timestamp: new Date() };
  sessions.push(session);
  if (sessions.length > 100) sessions.shift();
  res.json({ success: true, sessionId: req.body.sessionId });
});

app.get('/api/sessions/:userId', (req, res) => {
  const userSessions = sessions
    .filter(s => s.userId === req.params.userId)
    .slice(-20)
    .reverse();
  res.json(userSessions);
});

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

app.get('/health', (req, res) => {
  res.json({
    status:   'ok',
    storage:  'in-memory',
    users:    Object.keys(users).length,
    sessions: sessions.length,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));