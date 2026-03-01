"""
Data Preprocessing Module for Jakarta FloodNet
=============================================
Scikit-learn Style Pipeline
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Optional, Tuple, Union
from dataclasses import dataclass, field
import logging

# Setup Logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class PreprocessingConfig:
    """Configuration for Data Preprocessing"""
    target_col: str = 'tma_manggarai'
    rainfall_cols: List[str] = field(default_factory=lambda: ['hujan_bogor', 'hujan_jakarta'])
    
    # Feature Engineering Params
    lag_hours: List[int] = field(default_factory=lambda: [1, 2, 3, 6, 12, 24])
    rolling_windows: List[int] = field(default_factory=lambda: [3, 6, 12, 24])
    tma_lags: List[int] = field(default_factory=lambda: [1, 2, 3, 6])
    
    # Cleaning Params
    handle_missing: str = 'interpolate'  # Options: 'forward_fill', 'interpolate', 'drop'
    outlier_method: str = 'iqr'

class FloodDataPreprocessor:
    """
    Main Preprocessing Class for Jakarta FloodNet.
    Handles data cleaning, feature engineering, and preparation for LSTM/YOLO.
    """
    
    def __init__(self, config: Optional[PreprocessingConfig] = None):
        self.config = config if config else PreprocessingConfig()
        self.is_fitted = False
        self._imputation_values = {} # To store means/medians if needed for static imputation

    def load_data(self, file_path: str) -> pd.DataFrame:
        """Load CSV safely."""
        logger.info(f"Loading data from: {file_path}")
        try:
            df = pd.read_csv(file_path)
            if 'Unnamed: 0' in df.columns:
                df = df.drop('Unnamed: 0', axis=1)
            return df
        except Exception as e:
            logger.error(f"Failed to load data: {e}")
            raise

    def fit(self, df: pd.DataFrame) -> 'FloodDataPreprocessor':
        """
        Learn data statistics (if any) needed for transformation.
        For time-series usually simple, but good for saving scalers/means later.
        """
        # Validate columns
        required_cols = self.config.rainfall_cols + [self.config.target_col]
        missing = [c for c in required_cols if c not in df.columns and c != self.config.target_col]
        
        # Note: target_col might not exist during inference (transform only)
        # But during fit (training data), it usually exists.
        
        self.is_fitted = True
        return self

    def transform(self, df: pd.DataFrame, training_mode: bool = False) -> pd.DataFrame:
        """
        Apply transformations to the data.
        
        Args:
            df: Raw DataFrame
            training_mode: If True, drops NaN created by lags and checks for target col.
        """
        df_clean = df.copy()
        
        # 1. Standardize & Clean
        df_clean = self._clean_structure(df_clean)
        
        # 2. Handle Missing Values
        df_clean = self._handle_missing(df_clean)
        
        # 3. Feature Engineering (The heavy lifting)
        df_features = self._engineer_features(df_clean)
        
        # 4. Final Cleanup
        if training_mode:
            # Drop rows with NaN caused by lags (e.g., first 24 hours)
            original_len = len(df_features)
            df_features = df_features.dropna()
            logger.info(f"Dropped {original_len - len(df_features)} rows due to lag creation (NaNs)")
        else:
            # For inference, we might fill NaNs with 0 or last value to keep shape
            df_features = df_features.fillna(method='ffill').fillna(0)
            
        return df_features

    def _clean_structure(self, df: pd.DataFrame) -> pd.DataFrame:
        """Basic cleaning and casting."""
        # Ensure timestamp
        col_names = list(df.columns)
        
        # Smart rename if columns match expected pattern (optional heuristic)
        # Assuming index 0 is timestamp if not named 'timestamp'
        if 'timestamp' not in col_names and df.columns[0] != 'timestamp':
             df = df.rename(columns={df.columns[0]: 'timestamp'})
             
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp').reset_index(drop=True)
        
        # Ensure numeric
        numeric_cols = self.config.rainfall_cols
        if self.config.target_col in df.columns:
            numeric_cols.append(self.config.target_col)
            
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
                
        return df

    def _handle_missing(self, df: pd.DataFrame) -> pd.DataFrame:
        """Handle NaN values based on config."""
        method = self.config.handle_missing
        if method == 'interpolate':
            # Linear interpolation is best for time-series (continuous water level)
            df[self.config.rainfall_cols] = df[self.config.rainfall_cols].fillna(0) # Rain defaults to 0
            if self.config.target_col in df.columns:
                df[self.config.target_col] = df[self.config.target_col].interpolate(method='linear')
        elif method == 'forward_fill':
            df = df.fillna(method='ffill').fillna(method='bfill')
        elif method == 'drop':
            df = df.dropna()
        return df

    def _engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply all feature engineering steps."""
        logger.info("Starting Feature Engineering...")
        
        # A. Time Features
        df['hour'] = df['timestamp'].dt.hour
        df['month'] = df['timestamp'].dt.month
        # Cyclical encoding (Crucial for LSTM to understand 23:00 is close to 00:00)
        df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
        df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
        df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
        df