import requests
import json
import os

def fetch_jolpica_data(output_file):
    print("Fetching Jolpica F1 data...")
    try:
        # Example API call to Ergast/Jolpica for race results
        url = "https://api.jolpi.ca/ergast/f1/2023/results.json?limit=100"
        response = requests.get(url)
        response.raise_for_status()
        
        data = response.json()
        
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)
            
        print(f"Saved Jolpica data to {output_file}")
    except Exception as e:
        print(f"Error fetching Jolpica data: {e}")

if __name__ == "__main__":
    fetch_jolpica_data('data/jolpica_2023_results.json')
