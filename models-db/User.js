const mongoose = require('mongoose');

module.exports = mongoose.model('User', new mongoose.Schema({
  userId:   { type: String, required: true, unique: true },
  neurotype:{ type: String, enum: ['ASD','ADHD','Dyslexia','Neurotypical','Other'] },
  preferences: {
    colorTheme:     { type: String,  default: 'default' },
    fontStyle:      { type: String,  default: 'Arial'   },
    fontSize:       { type: Number,  default: 16        },
    animationSpeed: { type: String,  default: 'normal'  },
    focusMode:      { type: Boolean, default: false     },
    highContrast:   { type: Boolean, default: false     },
  },
  createdAt: { type: Date, default: Date.now }
}));