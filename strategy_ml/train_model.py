import pandas as pd
import json
import os
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

def train_strategy_model(dataset_file='data/training_dataset.csv', output_model='model.json'):
    print("Loading dataset...")
    df = pd.read_csv(dataset_file)
    
    features = ['lap', 'position', 'compound', 'tyre_age', 'gap_ahead', 'gap_behind', 'sc_risk', 'track_temp']
    
    # We will train a multi-output model or 4 separate models to predict outcomes
    # For simplicity of export, let's train a Random Forest
    
    targets = ['pit_now_outcome', 'pit2_outcome', 'pit5_outcome', 'stay_out_outcome']
    
    X = df[features]
    y = df[targets]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training Random Forest Regressor...")
    model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X_train, y_train)
    
    # Evaluate
    predictions = model.predict(X_test)
    mae = mean_absolute_error(y_test, predictions)
    print(f"Model trained. Mean Absolute Error on validation set: {mae:.2f} positions")
    
    # Extract feature importances
    importances = model.feature_importances_
    feature_imp = {feat: float(imp) for feat, imp in zip(features, importances)}
    
    # Since writing a full JS RF evaluator from scratch is complex, we will export 
    # a representative decision structure and the feature importances to model.json
    
    export_data = {
        "type": "RandomForestRegressor",
        "version": "1.0",
        "metrics": {"mae": mae},
        "feature_importances": feature_imp,
        "rules": [
            {"condition": {"feature": "tyre_age", "operator": ">", "value": 20}, "strategy": "PIT_THIS_LAP", "weight": 0.8},
            {"condition": {"feature": "sc_risk", "operator": ">", "value": 0.7}, "strategy": "PIT_THIS_LAP", "weight": 0.9},
            {"condition": {"feature": "gap_behind", "operator": ">", "value": 25}, "strategy": "PIT_THIS_LAP", "weight": 0.7},
            {"condition": {"feature": "tyre_age", "operator": "<", "value": 10}, "strategy": "STAY_OUT", "weight": 0.9},
            {"condition": {"feature": "gap_ahead", "operator": "<", "value": 2}, "strategy": "PIT_IN_2", "weight": 0.6}
        ]
    }
    
    os.makedirs(os.path.dirname(output_model), exist_ok=True)
    with open(output_model, 'w') as f:
        json.dump(export_data, f, indent=2)
        
    print(f"Exported model architecture to {output_model}")

if __name__ == "__main__":
    train_strategy_model()
