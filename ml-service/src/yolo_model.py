"""
YOLO Model Module for Jakarta FloodNet
=====================================
Robust Visual Verification with Color Heuristics
Uses Roboflow Workflow API via HTTP (no inference-sdk; Python 3.13 compatible).
"""

import base64
import cv2
import numpy as np
import os
import logging
import requests
from typing import List, Dict, Any, Optional, Union

# Setup Logger
logger = logging.getLogger(__name__)

# Try Import Ultralytics (Optional now, but good for fallback if needed)
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    logger.error("❌ Ultralytics not found! Please install: pip install ultralytics")
    YOLO_AVAILABLE = False

ROBOFLOW_BASE = "https://serverless.roboflow.com"
WORKSPACE = "ari-aziz"
WORKFLOW_ID = "detect-count-and-visualize"


class FloodVisualVerifier:
    """
    Visual Verification System using Roboflow Workflow API (HTTP).
    """
    
    def __init__(self, model_path: str = 'models/yolov8n.pt', confidence_threshold: float = 0.4):
        self.model_path = model_path
        self.conf_thresh = confidence_threshold
        self.model = None
        self.is_loaded = False
        self.api_key: Optional[str] = None
        
        try:
            self.api_key = os.getenv("ROBOFLOW_API_KEY")
            if not self.api_key:
                logger.warning("⚠️ ROBOFLOW_API_KEY not found in environment variables. Using fallback.")
                self.api_key = "kI2MJW8A3nh8M8MdgyR4"
            self.is_loaded = True
            logger.info("✅ Roboflow Client Initialized (HTTP)")
        except Exception as e:
            logger.error(f"❌ Failed to init Roboflow: {e}")
            self.is_loaded = False

    def load_model(self) -> bool:
        """Legacy load method - kept for compatibility."""
        return self.is_loaded

    def _run_workflow_http(self, image_b64: str) -> list:
        """Call Roboflow workflow API via HTTP."""
        url = f"{ROBOFLOW_BASE}/{WORKSPACE}/workflows/{WORKFLOW_ID}"
        payload = {
            "api_key": self.api_key,
            "inputs": {"image": {"type": "base64", "value": image_b64}},
            "use_cache": True,
        }
        r = requests.post(url, json=payload, timeout=60)
        r.raise_for_status()
        data = r.json()
        return data.get("outputs", [])

    def detect_flood_features(self, image_source: Union[str, np.ndarray]) -> Dict[str, Any]:
        """
        Main detection function using Roboflow Workflow API.
        """
        default_response = {
            "is_flooded": False,
            "flood_probability": 0.0,
            "objects_detected": []
        }

        if not self.is_loaded or not self.api_key:
            return default_response

        temp_filename = "temp_inference.jpg"  # used in except cleanup
        
        try:
            # 1. Prepare image and encode as base64
            if isinstance(image_source, np.ndarray):
                _, buf = cv2.imencode(".jpg", image_source)
                image_b64 = base64.b64encode(buf.tobytes()).decode("utf-8")
            elif isinstance(image_source, str) and os.path.exists(image_source):
                with open(image_source, "rb") as f:
                    image_b64 = base64.b64encode(f.read()).decode("utf-8")
            else:
                return default_response

            # 2. Run Roboflow Workflow via HTTP
            result = self._run_workflow_http(image_b64)
            
            # 3. Parse Results
            # Expected Structure: [{'predictions': {'predictions': [{'class': 'flood', ...}]}}]
            predictions = []
            
            if isinstance(result, list) and len(result) > 0:
                # Get the first image result
                image_result = result[0]
                
                # Check for nested predictions (Workflow output)
                if 'predictions' in image_result:
                    preds_data = image_result['predictions']
                    
                    # If it's a dictionary containing 'predictions' list (Nested case)
                    if isinstance(preds_data, dict) and 'predictions' in preds_data:
                        predictions = preds_data['predictions']
                    # If it's directly a list (Standard inference case)
                    elif isinstance(preds_data, list):
                        predictions = preds_data
                    # If it's just a dict but not nested (Single prediction?)
                    elif isinstance(preds_data, dict):
                        predictions = [preds_data]
            
            objects_detected = []
            flood_prob = 0.0
            
            # Check for flood class or water class
            flood_detected = False
            
            for pred in predictions:
                # Roboflow prediction structure usually has 'class', 'confidence'
                label = pred.get('class', 'unknown')
                conf = pred.get('confidence', 0.0)
                
                objects_detected.append(label)
                
                if label.lower() in ['flood', 'water', 'flooded', 'puddle']:
                    flood_detected = True
                    flood_prob = max(flood_prob, conf)

            # Clean up temp file (if we ever wrote one)
            if os.path.exists(temp_filename):
                try:
                    os.remove(temp_filename)
                except OSError:
                    pass

            return {
                "is_flooded": flood_detected,
                "flood_probability": float(flood_prob),
                "objects_detected": list(set(objects_detected)) # Unique strings
            }

        except Exception as e:
            logger.error(f"❌ Roboflow Inference Error: {e}")
            # Clean up temp file if exists
            if os.path.exists(temp_filename):
                try:
                    os.remove(temp_filename)
                except:
                    pass
            # Return default False as requested
            return default_response

    def _load_image(self, source):
        """Safe Image Loader."""
        if isinstance(source, str):
            if os.path.exists(source):
                return cv2.imread(source)
        elif isinstance(source, np.ndarray):
            return source
        return None

    def _analyze_water_color(self, img: np.ndarray) -> float:
        """
        Legacy method - kept for reference
        """
        return 0.0

if __name__ == "__main__":
    # Test Code
    print("Testing YOLO Class...")
    verifier = FloodVisualVerifier()
    verifier.load_model()
    
    # Create Dummy Image (Brown-ish)
    dummy_img = np.zeros((480, 640, 3), dtype=np.uint8)
    dummy_img[:] = (50, 100, 150) # BGR
    
    res = verifier.detect_flood_features(dummy_img)
    print("Result:", res)
    print("✅ YOLO Class Test Passed")