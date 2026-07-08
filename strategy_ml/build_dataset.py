import json
import os
import pandas as pd
import numpy as np

COMPOUND_MAP = {
    'SOFT': 0,
    'MEDIUM': 1,
    'HARD': 2,
    'C5': 0,
    'C4': 0,
    'C3': 1,
    'C2': 1,
    'C1': 2,
}


def _normalize_compound(value):
    if pd.isna(value):
        return 1
    text = str(value).upper()
    for key, mapped in COMPOUND_MAP.items():
        if key in text:
            return mapped
    return 1


def _parse_numeric(series, default=0.0):
    return pd.to_numeric(series, errors='coerce').fillna(default)


def _build_outcomes(features):
    positions = features['position'].astype(int).values
    tyre_age = features['tyre_age'].astype(int).values
    gap_ahead = features['gap_ahead'].astype(float).values
    gap_behind = features['gap_behind'].astype(float).values
    sc_risk = features['sc_risk'].astype(float).values

    pit_now_outcome = positions.copy()
    pit2_outcome = positions.copy()
    pit5_outcome = positions.copy()
    stay_out_outcome = positions.copy()

    for i in range(len(positions)):
        if tyre_age[i] > 20:
            stay_out_outcome[i] = min(20, stay_out_outcome[i] + 2)
            pit_now_outcome[i] = max(1, pit_now_outcome[i] - 1)

        if gap_behind[i] > 25:
            pit_now_outcome[i] = max(1, pit_now_outcome[i] - 2)

        if sc_risk[i] > 0.8:
            pit_now_outcome[i] = max(1, pit_now_outcome[i] - 2)
            pit2_outcome[i] = max(1, pit2_outcome[i] - 1)

        if tyre_age[i] < 5:
            pit_now_outcome[i] = min(20, pit_now_outcome[i] + 3)

        pit_now_outcome[i] += np.random.randint(-1, 2)
        pit2_outcome[i] += np.random.randint(-1, 2)
        pit5_outcome[i] += np.random.randint(-1, 2)
        stay_out_outcome[i] += np.random.randint(-1, 2)

        pit_now_outcome[i] = max(1, min(20, pit_now_outcome[i]))
        pit2_outcome[i] = max(1, min(20, pit2_outcome[i]))
        pit5_outcome[i] = max(1, min(20, pit5_outcome[i]))
        stay_out_outcome[i] = max(1, min(20, stay_out_outcome[i]))

    return pit_now_outcome, pit2_outcome, pit5_outcome, stay_out_outcome


def generate_synthetic_dataset(num_samples=5000, output_file='data/training_dataset.csv'):
    print(f"Generating synthetic dataset with {num_samples} samples...")
    np.random.seed(42)

    laps = np.random.randint(1, 60, num_samples)
    positions = np.random.randint(1, 21, num_samples)
    compounds = np.random.choice([0, 1, 2], num_samples)
    tyre_age = np.random.randint(1, 40, num_samples)
    gap_ahead = np.random.uniform(0.1, 20.0, num_samples)
    gap_behind = np.random.uniform(0.1, 20.0, num_samples)
    safety_car_risk = np.random.uniform(0, 1, num_samples)
    track_temp = np.random.uniform(20, 50, num_samples)

    df = pd.DataFrame({
        'lap': laps,
        'position': positions,
        'compound': compounds,
        'tyre_age': tyre_age,
        'gap_ahead': gap_ahead,
        'gap_behind': gap_behind,
        'sc_risk': safety_car_risk,
        'track_temp': track_temp,
    })

    outcomes = _build_outcomes(df)
    df['pit_now_outcome'], df['pit2_outcome'], df['pit5_outcome'], df['stay_out_outcome'] = outcomes

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    df.to_csv(output_file, index=False)
    print(f"Saved dataset to {output_file}")


def build_dataset_from_fastf1(input_file, output_file='data/training_dataset.csv'):
    print(f"Building dataset from FastF1 JSON: {input_file}")

    with open(input_file, 'r') as f:
        raw = json.load(f)

    laps = raw.get('laps') or raw.get('lap_records') or []
    if not laps:
        raise ValueError(f"No lap data found in {input_file}")

    df = pd.DataFrame(laps)
    df.columns = [str(col).strip() for col in df.columns]

    if 'LapNumber' not in df.columns and 'lap' in df.columns:
        df['LapNumber'] = df['lap']

    if 'Position' not in df.columns and 'position' in df.columns:
        df['Position'] = df['position']

    df['lap'] = _parse_numeric(df.get('LapNumber', df.get('lap')), default=1).astype(int)
    df['position'] = _parse_numeric(df.get('Position', df.get('position')), default=20).astype(int)
    df['compound'] = df.get('Compound', df.get('compound')).apply(_normalize_compound)

    if 'TyreLife' in df.columns:
        df['tyre_age'] = _parse_numeric(df['TyreLife'], default=1).astype(int)
    else:
        df['tyre_age'] = df.groupby(['Driver', 'Stint']).cumcount() + 1 if 'Driver' in df.columns and 'Stint' in df.columns else df['lap']
        df['tyre_age'] = df['tyre_age'].astype(int)

    df['gap_ahead'] = _parse_numeric(df.get('DeltaToDriverAhead', df.get('GapToLeader', df.get('gap_ahead'))), default=1.0)
    df['gap_behind'] = _parse_numeric(df.get('DeltaToDriverBehind', df.get('gap_behind')), default=1.0)

    if 'TrackStatus' in df.columns:
        df['sc_risk'] = df['TrackStatus'].astype(str).str.contains('SC|VSC', case=False, na=False).astype(float)
    else:
        df['sc_risk'] = 0.0

    df['track_temp'] = _parse_numeric(df.get('TrackTemp', df.get('track_temp')), default=np.nan)
    if df['track_temp'].isna().all() and raw.get('weather'):
        weather = pd.DataFrame(raw.get('weather'))
        if 'TrackTemperature' in weather.columns:
            temp = weather['TrackTemperature'].mean()
            df['track_temp'] = temp
    df['track_temp'] = df['track_temp'].fillna(30.0)

    df = df[['lap', 'position', 'compound', 'tyre_age', 'gap_ahead', 'gap_behind', 'sc_risk', 'track_temp']]

    df[['pit_now_outcome', 'pit2_outcome', 'pit5_outcome', 'stay_out_outcome']] = np.column_stack(_build_outcomes(df))

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    df.to_csv(output_file, index=False)
    print(f"Saved FastF1-derived dataset to {output_file}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) == 1:
        generate_synthetic_dataset()
    elif sys.argv[1] == 'synthetic':
        num_samples = int(sys.argv[2]) if len(sys.argv) > 2 else 5000
        output_file = sys.argv[3] if len(sys.argv) > 3 else 'data/training_dataset.csv'
        generate_synthetic_dataset(num_samples, output_file)
    elif sys.argv[1] == 'fastf1':
        if len(sys.argv) < 3:
            print('Usage: python build_dataset.py fastf1 <fastf1_json_file> [output_csv]')
        else:
            input_file = sys.argv[2]
            output_file = sys.argv[3] if len(sys.argv) > 3 else 'data/training_dataset.csv'
            build_dataset_from_fastf1(input_file, output_file)
    else:
        print('Usage: python build_dataset.py [synthetic [num_samples] [output_csv]] | fastf1 <fastf1_json_file> [output_csv]')
