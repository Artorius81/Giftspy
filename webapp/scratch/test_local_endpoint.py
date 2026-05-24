import requests
import json

url = "http://localhost:8001/api/market/webview?query=кофемолка"
print(f"Testing local FastAPI endpoint: {url}")
try:
    response = requests.get(url, timeout=15)
    print("Status Code:", response.status_code)
    print("Headers:", dict(response.headers))
    print("HTML Length:", len(response.text))
    print("HTML Preview:", response.text[:500])
except Exception as e:
    print("Error connecting to local server:", e)
