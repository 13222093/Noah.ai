"""
Metrics Module for Jakarta FloodNet
==================================
Stateless mathematical functions for evaluation.
"""

import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from typing import Dict, Union, List, Optional
import logging

logger = logging.getLogger(__name__)

def calculate_regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """
    Calculate standard regression metrics for LSTM Flood Forecast.
    
    Args:
        y_true: Actual water levels (cm)
        y_pred: Predicted water levels (cm)
        
    Returns:
        Dictionary containing RMSE, MAE, MAPE, R2
    """
    # Ensure numpy arrays and flatten
    y_true = np.array(y_true).flatten()
    y_pred = np.array(y_pred).flatten()
    
    # Handle NaN
    mask = ~np.isnan(y_true) & ~np.isnan(y_pred)
    y_true = y_true[mask]
    y_pred = y_pred[mask]

    if len(y_true) == 0:
        logger.warning("No valid data for metrics calculation")
        return {"rmse": 0.0, "mae": 0.0, "r2": 0.0}

    mse = mean_squared_error(y_true, y_pred)
    rmse = np.sqrt(mse)
    mae = mean_absolute_error(y_true, y_pred)
    r2 = r2_score(y_true, y_pred)
    
    # MAPE (Mean Absolute Percentage Error) - Handle division by zero
    # Add epsilon to denominator
    epsilon = 1e-6
    mape = np.mean(np.abs((y_true - y_pred) / (y_true + epsilon))) * 100

    metrics = {
        "rmse": round(float(rmse), 4),
        "mae": round(float(mae), 4),
        "mape_percent": round(float(mape), 4),
        "r2": round(float(r2), 4)
    }
    
    logger.info(f"Evaluation Metrics: {metrics}")
    return metrics

def evaluate_risk_classification(y_true_cm: np.ndarray, y_pred_cm: np.ndarray, 
                               thresholds: Dict[str, float] = None) -> Dict[str, float]:
    """
    Convert regression values to risk levels and evaluate accuracy.
    Useful to see if model predicts 'SIAGA 1' correctly even if cm is slightly off.
    """
    if thresholds is None:
        thresholds = {"SIAGA_1": 150.0, "SIAGA_2": 100.0} # Contoh threshold Manggarai
        
    def to_class(val):
        if val >= thresholds["SIAGA_1"]: return 2 # High
        if val >= thresholds["SIAGA_2"]: return 1 # Medium
        return 0 # Low

    y_true_class = [to_class(y) for y in y_true_cm]
    y_pred_class = [to_class(y) for y in y_pred_cm]
    
    from sklearn.metrics import accuracy_score, precision_score, recall_score
    
    return {
        "risk_accuracy": accuracy_score(y_true_class, y_pred_class),
        # Macro average karena imbalance class banjir jarang terjadi
        "risk_precision": precision_score(y_true_class, y_pred_class, average='macro', zero_division=0),
        "risk_recall": recall_score(y_true_class, y_pred_class, average='macro', zero_division=0)
    }