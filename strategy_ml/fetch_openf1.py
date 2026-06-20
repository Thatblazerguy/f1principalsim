import requests
import json
import os

def fetch_openf1_data(session_key, output_file):
    print(f"Fetching OpenF1 data for session {session_key}...")
    try:
        # Example API call to OpenF1 for intervals/gaps
        url = f"https://api.openf1.org/v1/intervals?session_key={session_key}"
        response = requests.get(url)
        response.raise_for_status()
        
        data = response.json()
        
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w') as f:
            json.dump(data[:100], f, indent=2) # Save sample
            
        print(f"Saved OpenF1 data to {output_file}")
    except Exception as e:
        print(f"Error fetching OpenF1 data: {e}")

if __name__ == "__main__":
    # 9143 is an example session key (e.g. Monaco 2023 Race)
    fetch_openf1_data(9143, 'data/openf1_intervals.json')
