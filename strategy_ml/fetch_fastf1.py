import fastf1
import pandas as pd
import json
import os

# Cache for FastF1
fastf1.Cache.enable_cache('fastf1_cache')

def fetch_fastf1_data(year, circuit, output_file):
    print(f"Fetching FastF1 data for {year} {circuit}...")
    try:
        session = fastf1.get_session(year, circuit, 'R')
        session.load(telemetry=False, weather=True, messages=True)
        
        laps = session.laps
        
        # We want to extract:
        # Tyre compounds used
        # Tyre life when pitting
        # Stint lengths
        
        stints = laps[['Driver', 'Stint', 'Compound', 'TyreLife', 'LapNumber', 'PitOutTime', 'PitInTime']].dropna(subset=['Compound'])
        
        # Calculate max tyre life per stint per compound
        max_life = stints.groupby(['Compound', 'Stint'])['TyreLife'].max().reset_index()
        
        data = {
            'circuit': circuit,
            'year': year,
            'avg_soft_life': max_life[max_life['Compound'] == 'SOFT']['TyreLife'].mean(),
            'avg_medium_life': max_life[max_life['Compound'] == 'MEDIUM']['TyreLife'].mean(),
            'avg_hard_life': max_life[max_life['Compound'] == 'HARD']['TyreLife'].mean(),
            'weather_samples': len(session.weather_data),
        }
        
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)
            
        print(f"Saved FastF1 data to {output_file}")
    except Exception as e:
        print(f"Error fetching FastF1 data: {e}")

if __name__ == "__main__":
    fetch_fastf1_data(2023, 'Bahrain', 'data/fastf1_bahrain_2023.json')
