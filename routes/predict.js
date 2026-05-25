const express = require('express');
const router  = express.Router();

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
  const {
    avg_gsr      = 1,
    acc_std      = 5,
    avg_engagement = 2,
    gaze_ratio   = 0.7,
    duration_seconds = 0
  } = data;

  // Rule-based cognitive state prediction
  // Based on Engagnition dataset thresholds from your ML training
  if (avg_gsr > 3.0 && acc_std > 10) return 'Overstimulated';
  if (avg_engagement < 1.5 || gaze_ratio < 0.3) return 'Distracted';
  if (acc_std > 8 && avg_engagement < 2.0) return 'Distracted';
  return 'Focused';
}

router.post('/focus-state', async (req, res) => {
  try {
    const state = predictState(req.body);
    const adaptations = getAdaptations(state, req.body.neurotype);
    res.json({
      focusState:  state,
      confidence:  0.85,
      adaptations,
      mode: 'rule-based'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;