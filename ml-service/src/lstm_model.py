"""
LSTM Model Module for Jakarta FloodNet
====================================
Integrated Scaling & Config
"""

import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from sklearn.preprocessing import MinMaxScaler, StandardScaler
import joblib
import os
import logging
from dataclasses import dataclass, field
from typing import Tuple, List, Optional, Dict, Union

# Setup Logger
logger = logging.getLogger(__name__)

@dataclass
class LSTMConfig:
    """Hyperparameters for LSTM Model"""
    sequence_length: int = 24       # Berapa jam data masa lalu yang dilihat
    lstm_units: List[int] = field(default_factory=lambda: [64, 32, 16])
    dropout_rate: float = 0.2
    learning_rate: float = 0.001
    batch_size: int = 32
    epochs: int = 50
    patience: int = 15

class FloodLevelLSTM:
    """
    LSTM Model Wrapper.
    Manages Neural Network + Data Scalers for easy inference.
    """
    
    def __init__(self, config: Optional[LSTMConfig] = None):
        self.config = config if config else LSTMConfig()
        self.model = None
        
        # Scalers (Penting untuk disimpan biar API bisa pakai)
        self.scaler_X = StandardScaler()
        self.scaler_y = MinMaxScaler(feature_range=(0, 1))
        
        self.is_trained = False
        self.feature_count = 0

    def _build_architecture(self, input_shape: Tuple[int, int]):
        """Build Keras LSTM Architecture based on config."""
        model = Sequential()
        
        # Layer 1
        model.add(LSTM(
            self.config.lstm_units[0], 
            return_sequences=True, 
            input_shape=input_shape
        ))
        model.add(BatchNormalization())
        model.add(Dropout(self.config.dropout_rate))
        
        # Layer 2
        model.add(LSTM(
            self.config.lstm_units[1], 
            return_sequences=len(self.config.lstm_units) > 2
        ))
        model.add(BatchNormalization())
        model.add(Dropout(self.config.dropout_rate))
        
        # Layer 3 (Optional)
        if len(self.config.lstm_units) > 2:
            model.add(LSTM(self.config.lstm_units[2], return_sequences=False))
            model.add(BatchNormalization())
            model.add(Dropout(self.config.dropout_rate))
        
        # Output Head
        model.add(Dense(32, activation='relu'))
        model.add(Dropout(self.config.dropout_rate / 2))
        model.add(Dense(1, activation='linear')) # Regression output
        
        optimizer = Adam(learning_rate=self.config.learning_rate)
        model.compile(optimizer=optimizer, loss='mse', metrics=['mae'])
        
        self.model = model
        logger.info(f"LSTM Architecture Built. Input Shape: {input_shape}")

    def create_sequences(self, X_data: np.ndarray, y_data: np.ndarray = None) -> Union[np.ndarray, Tuple[np.ndarray, np.ndarray]]:
        """
        Convert 2D array [samples, features] to 3D array [samples, time_steps, features]
        """
        X_seq, y_seq = [], []
        seq_len = self.config.sequence_length
        
        if len(X_data) < seq_len:
            raise ValueError(f"Data length ({len(X_data)}) is smaller than sequence length ({seq_len})")

        for i in range(len(X_data) - seq_len):
            X_seq.append(X_data[i:(i + seq_len)])
            if y_data is not None:
                y_seq.append(y_data[i + seq_len])
                
        if y_data is not None:
            return np.array(X_seq), np.array(y_seq)
        return np.array(X_seq)

    def fit(self, X_raw: np.ndarray, y_raw: np.ndarray, validation_split=0.2):
        """
        Full Training Pipeline: Scale -> Sequence -> Train
        """
        logger.info("Starting Training Pipeline...")
        
        # 1. Fit & Transform Scalers
        self.feature_count = X_raw.shape[1]
        X_scaled = self.scaler_X.fit_transform(X_raw)
        y_scaled = self.scaler_y.fit_transform(y_raw.reshape(-1, 1)).flatten()
        
        # 2. Create Sequences
        X_seq, y_seq = self.create_sequences(X_scaled, y_scaled)
        
        # 3. Build Model (Lazy Building - waiting for data shape)
        if self.model is None:
            self._build_architecture(input_shape=(X_seq.shape[1], X_seq.shape[2]))
            
        # 4. Callbacks
        callbacks = [
            EarlyStopping(monitor='val_loss', patience=self.config.patience, restore_best_weights=True),
            ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=5, min_lr=1e-6)
        ]
        
        # 5. Train
        history = self.model.fit(
            X_seq, y_seq,
            epochs=self.config.epochs,
            batch_size=self.config.batch_size,
            validation_split=validation_split,
            callbacks=callbacks,
            verbose=1
        )
        
        self.is_trained = True
        return history

    def predict(self, X_raw: np.ndarray) -> np.ndarray:
        """
        Inference Pipeline: Scale -> Sequence/Reshape -> Predict -> Inverse Scale
        """
        if not self.is_trained:
            logger.warning("Model is not trained/loaded! Returning zeros.")
            return np.zeros(len(X_raw))
            
        # 1. Scale Input
        X_scaled = self.scaler_X.transform(X_raw)
        
        # 2. Handle Sequence Shape
        # Scenario A: Single data point (API real-time) -> Duplicate to fake sequence
        if X_scaled.shape[0] == 1:
            # (1, features) -> (1, 24, features)
            # We repeat the single input 24 times (Naive approach for API)
            # Better approach: API sends 24h history. But for MVP this is robust.
            X_input = np.repeat(X_scaled[np.newaxis, :, :], self.config.sequence_length, axis=1)
        
        # Scenario B: Batch prediction (Evaluation) -> Create real sequences
        elif X_scaled.shape[0] > self.config.sequence_length:
            X_input = self.create_sequences(X_scaled)
            
        else:
             # Not enough data for sequence
             logger.warning("Not enough data for sequence. Padding...")
             # Simple padding logic (not ideal but prevents crash)
             pad_len = self.config.sequence_length - X_scaled.shape[0]
             X_pad = np.pad(X_scaled, ((pad_len, 0), (0, 0)), 'edge')
             X_input = X_pad[np.newaxis, :, :]

        # 3. Predict
        y_pred_scaled = self.model.predict(X_input, verbose=0)
        
        # 4. Inverse Scale
        y_pred = self.scaler_y.inverse_transform(y_pred_scaled)
        return y_pred.flatten()

    def save_model(self, path: str):
        """Save Model .h5 + Scalers .pkl"""
        if not self.is_trained:
            logger.warning("Model not trained, nothing to save.")
            return
            
        # Create directory
        base_dir = os.path.dirname(path)
        os.makedirs(base_dir, exist_ok=True)
        
        # Save Keras Model
        self.model.save(path)
        
        # Save Scalers (Side-by-side with model)
        # e.g. model.h5 -> model_scaler_X.pkl
        base_name = os.path.splitext(path)[0]
        joblib.dump(self.scaler_X, f"{base_name}_scaler_X.pkl")
        joblib.dump(self.scaler_y, f"{base_name}_scaler_y.pkl")
        
        logger.info(f"Model saved to {path}")

    def load_model(self, path: str, scaler_base_path: str = None):
        """Load Model + Scalers"""
        try:
            # Load Keras Model
            self.model = load_model(path)
            
            # Load Scalers
            # Logic: If scaler_base_path not provided, assume same name as model
            if scaler_base_path is None:
                scaler_base_path = os.path.splitext(path)[0]
                
            self.scaler_X = joblib.load(f"{scaler_base_path}_scaler_X.pkl")
            self.scaler_y = joblib.load(f"{scaler_base_path}_scaler_y.pkl")
            
            self.is_trained = True
            logger.info(f"Model & Scalers loaded from {path}")
            return True
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False

if __name__ == "__main__":
    # Sanity Check
    print("Testing LSTM Class...")
    model = FloodLevelLSTM()
    
    # Dummy Data: 100 hours, 5 features
    X_dummy = np.random.rand(100, 5)
    y_dummy = np.random.rand(100)
    
    # Test Fit
    print("Fitting...")
    model.fit(X_dummy, y_dummy)
    
    # Test Predict
    print("Predicting...")
    pred = model.predict(X_dummy[-30:]) # Predict on new data
    print(f"Prediction shape: {pred.shape}")
    print("✅ LSTM Class Test Passed")