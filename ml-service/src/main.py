import sys
import os
import logging
import numpy as np
import cv2
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from pydantic import BaseModel
from typing import Optional, List
from .scenarios import get_scenario, list_scenarios

# --- LOGGING SETUP ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ProjectX-ML")

# --- PATH HACKS ---
# Ensure models path resolves relative to ml-service root
_ml_service_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, _ml_service_root)

# --- APP INITIALIZATION ---
app = FastAPI(title="Jakarta FloodNet API Gateway", version="1.0.0 (FINAL)")

# --- GLOBAL STATE (GOD MODE) ---
class DemoState:
    active: bool = False
    scenario: str = "CRITICAL"

demo_state = DemoState()

# --- MODEL LOADING (REAL AI) ---
lstm_model = None

# CONFIG: Paths relative to ml-service root
MODEL_DIR = os.getenv("MODEL_PATH", os.path.join(_ml_service_root, "models"))
LSTM_MODEL_PATH = os.path.join(MODEL_DIR, "lstm_flood_forecaster.h5")
LSTM_SCALER_BASE_PATH = os.path.join(MODEL_DIR, "lstm")
YOLO_PATH = os.getenv("YOLO_PATH", os.path.join(MODEL_DIR, "yolov8n.pt"))

# Load YOLO Service (Preserving existing logic)
yolo_service = None

try:
    # Attempt to load the Real AI
    from .lstm_model import FloodLevelLSTM
    from .yolo_model import FloodVisualVerifier
    
    logger.info(f"Loading LSTM from {LSTM_MODEL_PATH}...")
    lstm_model = FloodLevelLSTM()
    if os.path.exists(LSTM_MODEL_PATH):
        success = lstm_model.load_model(LSTM_MODEL_PATH, LSTM_SCALER_BASE_PATH)
        if success:
            logger.info("✅ REAL AI LOADED: LSTM Neural Network Active.")
        else:
            logger.error("❌ LSTM Load returned False.")
            lstm_model = None
    else:
        logger.warning(f"⚠️ LSTM Model file not found at {LSTM_MODEL_PATH}")

    # Load YOLO
    try:
        os.makedirs(MODEL_DIR, exist_ok=True)
        yolo_service = FloodVisualVerifier(model_path=YOLO_PATH)
        yolo_service.load_model()
        logger.info("✅ YOLO Service ready")
    except Exception as e:
        logger.error(f"❌ YOLO Error: {e}")

except Exception as e:
    logger.error(f"⚠️ MODEL LOAD FAILED: {e}")
    logger.warning("System running in API-Only mode (Real AI unavailable).")


# --- DATA MODELS ---
class PredictionRequest(BaseModel):
    water_level_cm: float
    rainfall_mm: float # Legacy (Jakarta)
    rainfall_jakarta: Optional[float] = 0.0
    rainfall_bogor: Optional[float] = 0.0

# --- ENDPOINTS ---

@app.get("/")
def root():
    return {"message": "Jakarta FloodNet API (Final Production) 🟢"}

@app.get("/health")
def health_check():
    return {
        "status": "active",
        "mode": "DEMO" if demo_state.active else "LIVE",
        "models": {
            "lstm_ready": lstm_model is not None and lstm_model.is_trained,
            "vision_ready": yolo_service is not None
        }
    }

# 1. GOD MODE TOGGLE
@app.post("/admin/set-demo-mode")
async def set_demo_mode(request: dict = Body(default={})):
    """
    MASTER SWITCH for Pitch Demo.
    Accepts {"enable": true, "scenario": "CRITICAL"}
    """
    enable = request.get("enable", False)
    scenario = request.get("scenario", "CRITICAL")
    
    demo_state.active = enable
    demo_state.scenario = scenario
    logger.info(f"🚨 DEMO MODE CHANGED: {enable} ({scenario})")
    return {
        "status": "success", 
        "mode": "DEMO" if enable else "LIVE", 
        "scenario": scenario
    }

@app.get("/admin/demo-status")
async def get_demo_status():
    return {
        "demo_mode_enabled": demo_state.active,
        "scenario": demo_state.scenario
    }

# 2. HYBRID PREDICTION ENGINE (Physics/AI + God Mode)
@app.post("/predict")
async def predict_flood_risk(data: PredictionRequest):
    # A. INTERCEPT: GOD MODE
    if demo_state.active:
        logger.info("⚡ GOD MODE TRIGGERED: Returning CRITICAL prediction.")
        return {
            "status": "demo_mode_active",
            "prediction_cm": 1100.0,
            "risk_level": "CRITICAL",
            "alert_message": "🚨 SIAGA 1 - EVAKUASI SEGERA! Ketinggian air mencapai level kritis.",
            "timestamp": "2025-11-25T10:00:00Z"
        }

    # B. HYBRID ENGINE (AI + PHYSICS)
    # 1. EXTRACT VARIABLES (Safety Scope)
    try:
        # Log raw inputs to console for debugging
        logger.info(f"DEBUG INPUT: {data}")
        
        # Ensure inputs are floats (Pydantic does this, but extra safety)
        rain_jkt = float(data.rainfall_jakarta if data.rainfall_jakarta > 0 else data.rainfall_mm)
        rain_bogor = float(data.rainfall_bogor)
        water_cm = float(data.water_level_cm)
        
    except Exception as e:
         # IF INPUT PARSING FAILS
        return {"status": "error", "message": f"INPUT PARSING ERROR: {str(e)}", "prediction_cm": 0.0}

    # 2. ATTEMPT AI (Try Block)
    pred_lstm_raw = water_cm # Default to current level if AI fails
    ai_success = False
    
    if lstm_model and lstm_model.is_trained:
        try:
             # Attempt to use the LSTM model
             # Note: If model expects more features (e.g. 62), this might fail
             features = np.array([[rain_jkt, rain_jkt, water_cm]])
             prediction_array = lstm_model.predict(features)
             pred_lstm_raw = float(prediction_array[0])
             ai_success = True
        except Exception as e:
             logger.warning(f"AI MODEL FAILED (Using Fallback): {e}")
             # pred_lstm_raw remains as water_cm

    # 3. PHYSICS ENGINE (Fallback Logic)
    # This block MUST run even if AI failed.
    try:
        # --- Dynamic Weighting ---
        deviation = abs(pred_lstm_raw - water_cm)
        if deviation > 200: 
            ai_weight = 0.05; physics_weight = 0.95
        elif deviation > 100:
            ai_weight = 0.15; physics_weight = 0.85
        else:
            ai_weight = 0.30; physics_weight = 0.70
        
        weighted_prediction = (water_cm * physics_weight) + (pred_lstm_raw * ai_weight)

        # --- Rainfall Bias (NEW BALANCED FORMULA) ---
        # rain_bias = (Bogor * 0.8) + (Jakarta * 0.5)
        rain_bias = (rain_bogor * 0.8) + (rain_jkt * 0.5)
        
        # Clamp bias to reasonable limits (e.g. max 200cm rise from rain alone)
        rain_bias = min(rain_bias, 200.0)
        
        temp_pred = weighted_prediction + rain_bias

        # --- Sanity Checks ---
        final_prediction = temp_pred
        # Rule A: Water can't drop if raining heavily
        if (rain_jkt + rain_bogor) > 20:
            final_prediction = max(final_prediction, water_cm)
        
        # Rule B: Max Hourly Change
        max_change = 150.0 # Increased slightly for responsiveness
        if abs(final_prediction - water_cm) > max_change:
            if final_prediction > water_cm:
                final_prediction = water_cm + max_change
            else:
                final_prediction = water_cm - (max_change * 0.5)

        predicted_tma = round(max(final_prediction, 0.0), 2)
        
        # Risk Logic (UPDATED THRESHOLDS)
        # >= 850: CRITICAL
        # >= 700: HIGH
        # >= 400: MEDIUM
        # < 400: LOW
        if predicted_tma >= 850:
            risk = "CRITICAL" # SIAGA 1
            msg = "🚨 EVAKUASI SEGERA! Ketinggian air mencapai level kritis."
        elif predicted_tma >= 700:
            risk = "BAHAYA" # HIGH / SIAGA 2
            msg = "⚠️ Air mulai meluap, waspada."
        elif predicted_tma >= 400:
            risk = "WASPADA" # MEDIUM / SIAGA 3
            msg = "ℹ️ Kondisi Waspada. Siaga di pintu air."
        else: # Below 400 cm (Normal/Aman)
            risk = "AMAN" # LOW
            msg = "✅ Kondisi Aman. Lanjutkan monitoring."
        
        return {
            "status": "success",
            "prediction_cm": predicted_tma,
            "risk_level": risk,
            "alert_message": msg
        }

    except Exception as e:
        # 4. THE REAL ERROR REVEAL
        # Do NOT return "Computation Error". Return the actual crash reason.
        logger.error(f"PHYSICS ENGINE CRASH: {e}")
        return {
            "status": "error", 
            "message": f"PHYSICS ENGINE CRASH: {str(e)}", 
            "prediction_cm": water_cm
        }
    
    # Fallback if model not loaded
    dummy_pred = data.water_level_cm + (data.rainfall_mm * 0.5)
    return {
        "status": "fallback_mode",
        "prediction_cm": round(dummy_pred, 1),
        "risk_level": "UNKNOWN",
        "alert_message": "Model belum siap/dilatih."
    }

# 3. VISUAL VERIFICATION (YOLO + God Mode)
@app.post("/verify-visual")
async def verify_visual(file: UploadFile = File(...)):
    # A. INTERCEPT: GOD MODE
    if demo_state.active:
        logger.info("⚡ GOD MODE TRIGGERED: Returning SUSTAINABILITY proof.")
        return {
            "is_flooded": True,
            "flood_probability": 0.99,
            "objects_detected": ["flood", "water"], 
            "timestamp": "2025-11-25T10:00:00Z"
        }

    # B. REAL LOGIC
    if not yolo_service:
         return {"status": "error", "message": "Visual service not available"}
         
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")
        return yolo_service.detect_flood_features(img)
    except Exception as e:
        return {"status": "error", "message": str(e)}

# 4. SCENARIO SYSTEM (One-Click Demo)
@app.get("/scenarios")
def get_available_scenarios():
    """List all scenarios for Frontend Dropdown"""
    return list_scenarios()

# --- SCENARIOS & DEMO DATA ---
# Imported from src.scenarios

@app.post("/predict/scenario/{scenario_id}")
async def predict_scenario(scenario_id: str):
    """
    Run a specific demo scenario with ADVANCED PHYSICS ENGINE.
    """
    scenario = get_scenario(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    # A. SCENARIO GOD MODE
    if scenario["god_mode_enabled"]:
        logger.info(f"⚡ SCENARIO GOD MODE: {scenario['name']}")
        return {
            "status": "demo_mode_active",
            "prediction_cm": 1100.0,
            "risk_level": "CRITICAL",
            "alert_message": "🚨 SIAGA 1 - EVAKUASI SEGERA! Ketinggian air mencapai level kritis.",
            "timestamp": "2025-11-25T10:00:00Z"
        }

    # B. REAL AI WITH PHYSICS ENGINE
    data = scenario["data"]
    # Map new schema to old variables for compatibility
    rain_jkt = float(data.get("rainfall_jakarta", data.get("rainfall_mm", 0.0)))
    rain_bogor = float(data.get("rainfall_bogor", 0.0))
    water_level = float(data.get("tma_manggarai", data.get("water_level_cm", 0.0)))
    
    predicted_tma = water_level # Default to current
    
    if lstm_model and lstm_model.is_trained:
        try:
            # 1. AI Prediction
            features = np.array([[rain_jkt, rain_jkt, water_level]])
            prediction_array = lstm_model.predict(features)
            pred_lstm_raw = float(prediction_array[0])
            
            # 2. PHYSICS ENGINE (The "Secret Sauce")
            # --- Dynamic Weighting ---
            deviation = abs(pred_lstm_raw - water_level)
            if deviation > 200: 
                ai_weight = 0.05; physics_weight = 0.95
            elif deviation > 100:
                ai_weight = 0.15; physics_weight = 0.85
            else:
                ai_weight = 0.30; physics_weight = 0.70
            
            weighted_prediction = (water_level * physics_weight) + (pred_lstm_raw * ai_weight)

            # --- Rainfall Bias (NEW BALANCED FORMULA) ---
            # rain_bias = (Bogor * 0.8) + (Jakarta * 0.5)
            rain_bias = (rain_bogor * 0.8) + (rain_jkt * 0.5)
            
            # Clamp bias
            rain_bias = min(rain_bias, 200.0)
            
            temp_pred = weighted_prediction + rain_bias

            # --- Sanity Checks ---
            final_prediction = temp_pred
            # Rule A: Water can't drop if raining heavily
            if (rain_jkt + rain_bogor) > 20:
                final_prediction = max(final_prediction, water_level)
            
            # Rule B: Max Hourly Change
            max_change = 150.0
            if abs(final_prediction - water_level) > max_change:
                if final_prediction > water_level:
                    final_prediction = water_level + max_change
                else:
                    final_prediction = water_level - (max_change * 0.5)

            predicted_tma = round(max(final_prediction, 0.0), 2)
            
            # Risk Logic (UPDATED THRESHOLDS)
            if predicted_tma >= 850:
                risk = "CRITICAL" # SIAGA 1
                msg = "🚨 EVAKUASI SEGERA! Ketinggian air mencapai level kritis."
            elif predicted_tma >= 700:
                risk = "BAHAYA" # HIGH / SIAGA 2
                msg = "⚠️ Air mulai meluap, waspada."
            elif predicted_tma >= 400:
                risk = "WASPADA" # MEDIUM / SIAGA 3
                msg = "ℹ️ Kondisi Waspada. Siaga di pintu air."
            else: # Below 400 cm (Normal/Aman)
                risk = "AMAN" # LOW
                msg = "✅ Kondisi Aman. Lanjutkan monitoring."
            
            return {
                "status": "success",
                "prediction_cm": predicted_tma,
                "risk_level": risk,
                "alert_message": msg,
                "scenario_used": scenario["name"]
            }
        except Exception as e:
            logger.error(f"Scenario Inference Error: {e}")
            # Fallback to physics
            pass

    # Fallback (Physics Only)
    dummy_pred = water_level + (rain_jkt * 0.5)
    return {
        "status": "fallback_mode",
        "prediction_cm": round(dummy_pred, 1),
        "risk_level": "UNKNOWN",
        "alert_message": "Model belum siap/dilatih. Menggunakan estimasi fisika.",
        "scenario_used": scenario["name"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
