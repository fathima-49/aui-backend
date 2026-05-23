const express = require('express');
const router  = express.Router();
const axios   = require('axios');

function getAdaptations(state, neurotype) {
  const a = [];
  if (state === 'Distracted')     a.push('enable_focus_mode','reduce_animations','simplify_layout');
  if (state === 'Overstimulated') a.push('high_contrast','reduce_density','pause_animations','enlarge_text');
  if (neurotype === 'Dyslexia')   a.push('dyslexia_font');
  if (neurotype === 'ADHD')       a.push('chunked_content','progress_indicators');
  if (neurotype === 'ASD')        a.push('predictable_layout','reduce_transitions');
  return a;
}

router.post('/focus-state', async (req, res) => {
  try {
    const mlRes = await axios.post('http://localhost:8000/predict', req.body);
    const { state, confidence } = mlRes.data;
    res.json({
      focusState:  state,
      confidence,
      adaptations: getAdaptations(state, req.body.neurotype)
    });
  } catch (e) {
    const { avg_gsr=1, acc_std=5, avg_engagement=2 } = req.body;
    let state = 'Focused';
    if (avg_gsr > 3 && acc_std > 10) state = 'Overstimulated';
    else if (avg_engagement < 1.5)   state = 'Distracted';
    res.json({
      focusState:  state,
      adaptations: getAdaptations(state, req.body.neurotype),
      fallback:    true
    });
  }
});

module.exports = router;