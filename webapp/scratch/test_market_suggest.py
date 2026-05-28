import requests
import json

def main():
    query = "Кофемашина"
    url = f"http://suggest.market.yandex.ru/suggest-market?part={requests.utils.quote(query)}"
    print(f"Requesting suggest API: {url}")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=5)
        print(f"Status Code: {response.status_code}")
        print(f"Content: {response.text[:500]}")
        
        # Try parsing JSON
        data = response.json()
        print(json.dumps(data, indent=2, ensure_ascii=False)[:600])
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
