import fastf1
import pandas as pd
import json
import os

# Cache for FastF1
fastf1.Cache.enable_cache('fastf1_cache')


def fetch_fastf1_data(year, circuit, session_type='R', output_file=None):
    if output_file is None:
        output_file = f'data/fastf1_{year}_{circuit}_{session_type}.json'

    print(f"Fetching FastF1 data for {year} {circuit} {session_type}...")
    try:
        session = fastf1.get_session(year, circuit, session_type)
        session.load(telemetry=False, weather=True, messages=True)

        laps = session.laps.reset_index(drop=True)
        available_cols = [
            'LapNumber', 'Driver', 'Stint', 'Compound', 'TyreLife', 'Position',
            'LapTime', 'PitInTime', 'PitOutTime', 'TrackStatus', 'LapStartTime',
            'Time', 'Interval', 'GapToLeader'
        ]
        selected_cols = [col for col in available_cols if col in laps.columns]
        lap_records = laps[selected_cols].to_dict(orient='records')

        messages = []
        if hasattr(session, 'messages') and session.messages is not None:
            try:
                messages = session.messages.to_dict(orient='records')
            except Exception:
                messages = []

        weather = []
        if hasattr(session, 'weather_data') and session.weather_data is not None:
            try:
                weather = session.weather_data.to_dict(orient='records')
            except Exception:
                weather = []

        data = {
            'year': year,
            'circuit': circuit,
            'session': session_type,
            'laps': lap_records,
            'messages': messages,
            'weather': weather,
        }

        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2, default=str)

        print(f"Saved FastF1 data to {output_file}")
    except Exception as e:
        print(f"Error fetching FastF1 data: {e}")


if __name__ == "__main__":
    fetch_fastf1_data(2023, 'Bahrain', 'R', 'data/fastf1_2023_Bahrain_R.json')
