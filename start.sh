#!/bin/bash
echo "Starting ML Flask API..."
python predict_ml.py &
sleep 5
echo "Starting Node.js server..."
node server.js