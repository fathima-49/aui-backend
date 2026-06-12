"""
AUI Project — ML Prediction API (predict_ml.py)
================================================
A small Flask server that loads the trained model and serves predictions.
This runs alongside your Node.js backend on Render.

HOW THIS WORKS:
  Node.js server.js  →  calls this Flask API  →  returns ML prediction
  Port: 5001 (Flask), Port: 5000 (Node.js)

DEPLOYMENT:
  - Add this file and the ./model/ folder to your backend repo
  - Render will run both server.js and this file
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import joblib
import os

app = Flask(__name__)
CORS(app)

# ── Load model files ───────────────────────────────────────────────────────────
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'model')

try:
    model         = joblib.load(os.path.join(MODEL_DIR, 'model.pkl'))
    scaler        = joblib.load(os.path.join(MODEL_DIR, 'scaler.pkl'))
    label_encoder = joblib.load(os.path.join(MODEL_DIR, 'label_encoder.pkl'))
    features      = joblib.load(os.path.join(MODEL_DIR, 'features.pkl'))
    print(f"ML model loaded successfully. Features: {features}")
    print(f"Classes: {list(label_encoder.classes_)}")
    MODEL_LOADED = True
except Exception as e:
    print(f"WARNING: Could not load model — {e}")
    print("Using fallback rule-based prediction.")
    MODEL_LOADED = False


def rule_based_fallback(data):
    """Fallback if model files are missing."""
    avg_gsr        = data.get('avg_gsr', 1.0)
    acc_std        = data.get('acc_std', 5.0)
    avg_engagement = data.get('avg_engagement', 2.0)
    gaze_ratio     = data.get('gaze_ratio', 0.7)

    if avg_gsr > 3.0 and acc_std > 10:
        return 'Overstimulated', 0.72
    if avg_engagement < 1.5 or gaze_ratio < 0.3:
        return 'Distracted', 0.68
    if acc_std > 8 and avg_engagement < 2.0:
        return 'Distracted', 0.65
    return 'Focused', 0.80


@app.route('/ml/predict', methods=['POST'])
def predict():
    """
    Expects JSON body with sensor features:
    {
        "avg_gsr": 1.5,
        "std_gsr": 0.3,
        "max_gsr": 3.0,
        "min_gsr": 0.5,
        "gsr_range": 2.5,
        "gsr_slope": 0.01,
        "acc_mean": 65.0,
        "acc_std": 12.0,
        "acc_max": 85.0,
        "acc_p75": 72.0,
        "tmp_mean": 32.0,
        "tmp_std": 0.5,
        "tmp_slope": 0.001
    }
    Returns:
    {
        "state": "Focused",
        "confidence": 0.87,
        "model": "MLP"
    }
    """
    try:
        data = request.get_json(force=True)

        if not MODEL_LOADED:
            state, confidence = rule_based_fallback(data)
            return jsonify({
                'state':      state,
                'confidence': confidence,
                'model':      'rule-based-fallback',
            })

        # Build feature vector in the correct order
        feature_vector = []
        for feat in features:
            val = data.get(feat, 0.0)
            feature_vector.append(float(val))

        X = np.array([feature_vector])
        X_scaled = scaler.transform(X)

        # Predict
        pred_enc = model.predict(X_scaled)[0]
        prob     = model.predict_proba(X_scaled)[0]
        confidence = float(prob.max())
        state    = label_encoder.inverse_transform([pred_enc])[0]

        return jsonify({
            'state':      state,
            'confidence': round(confidence, 3),
            'model':      type(model).__name__,
            'probabilities': {
                cls: round(float(p), 3)
                for cls, p in zip(label_encoder.classes_, prob)
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/ml/health', methods=['GET'])
def health():
    return jsonify({
        'status':       'ok',
        'model_loaded': MODEL_LOADED,
        'model_type':   type(model).__name__ if MODEL_LOADED else 'none',
        'classes':      list(label_encoder.classes_) if MODEL_LOADED else [],
    })


if __name__ == '__main__':
    port = int(os.environ.get('ML_PORT', 5001))
    print(f"Starting ML API on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
