import pandas as pd
import numpy as np
import os

def generate_synthetic_dataset(num_samples=5000, output_file='data/training_dataset.csv'):
    print(f"Generating synthetic dataset with {num_samples} samples...")
    np.random.seed(42)
    
    # Feature ranges
    laps = np.random.randint(1, 60, num_samples)
    positions = np.random.randint(1, 21, num_samples)
    compounds = np.random.choice([0, 1, 2], num_samples) # 0: Soft, 1: Medium, 2: Hard
    tyre_age = np.random.randint(1, 40, num_samples)
    gap_ahead = np.random.uniform(0.1, 20.0, num_samples)
    gap_behind = np.random.uniform(0.1, 20.0, num_samples)
    safety_car_risk = np.random.uniform(0, 1, num_samples)
    track_temp = np.random.uniform(20, 50, num_samples)
    
    # Outcomes: Projected finish position
    # Basic logic: 
    # If tyre age is high, pitting now is better.
    # If gap behind is large, pitting now is safe.
    # If safety car risk is high, pitting now is excellent.
    
    pit_now_outcome = positions.copy()
    pit2_outcome = positions.copy()
    pit5_outcome = positions.copy()
    stay_out_outcome = positions.copy()
    
    for i in range(num_samples):
        # Degraded tyres
        if tyre_age[i] > 20:
            stay_out_outcome[i] = min(20, stay_out_outcome[i] + 2)
            pit_now_outcome[i] = max(1, pit_now_outcome[i] - 1)
        
        # Huge gap behind -> free pit stop
        if gap_behind[i] > 25:
            pit_now_outcome[i] = max(1, pit_now_outcome[i] - 2)
            
        # High SC risk -> Pitting is great
        if safety_car_risk[i] > 0.8:
            pit_now_outcome[i] = max(1, pit_now_outcome[i] - 2)
            pit2_outcome[i] = max(1, pit2_outcome[i] - 1)
            
        # Pitting with fresh tyres is bad
        if tyre_age[i] < 5:
            pit_now_outcome[i] = min(20, pit_now_outcome[i] + 3)
            
        # Add some noise
        pit_now_outcome[i] += np.random.randint(-1, 2)
        pit2_outcome[i] += np.random.randint(-1, 2)
        pit5_outcome[i] += np.random.randint(-1, 2)
        stay_out_outcome[i] += np.random.randint(-1, 2)
        
        # Clamp to 1-20
        pit_now_outcome[i] = max(1, min(20, pit_now_outcome[i]))
        pit2_outcome[i] = max(1, min(20, pit2_outcome[i]))
        pit5_outcome[i] = max(1, min(20, pit5_outcome[i]))
        stay_out_outcome[i] = max(1, min(20, stay_out_outcome[i]))

    df = pd.DataFrame({
        'lap': laps,
        'position': positions,
        'compound': compounds,
        'tyre_age': tyre_age,
        'gap_ahead': gap_ahead,
        'gap_behind': gap_behind,
        'sc_risk': safety_car_risk,
        'track_temp': track_temp,
        'pit_now_outcome': pit_now_outcome,
        'pit2_outcome': pit2_outcome,
        'pit5_outcome': pit5_outcome,
        'stay_out_outcome': stay_out_outcome
    })
    
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    df.to_csv(output_file, index=False)
    print(f"Saved dataset to {output_file}")

if __name__ == "__main__":
    generate_synthetic_dataset()
