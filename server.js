const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Uses Atlas URI if available, falls back to local MongoDB
const MONGO_URI = process.env.MONGO_URI
  || 'mongodb://localhost:27017/aui_db';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✓ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

app.use('/api/users',    require('./routes/users'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/predict',  require('./routes/predict'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✓ Backend running on http://localhost:${PORT}`)
);