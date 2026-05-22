const mongoose = require('mongoose');

module.exports = mongoose.model('Session', new mongoose.Schema({
  userId:    String,
  sessionId: { type: String, required: true },
  neurotype: String,
  behavioralData: {
    avg_engagement:   Number,
    gaze_ratio:       Number,
    avg_gsr:          Number,
    acc_std:          Number,
    avg_temp:         Number,
    duration_seconds: Number,
  },
  predictedState:     String,
  adaptationsApplied: [String],
  timestamp: { type: Date, default: Date.now }
}));