import requests
from bs4 import BeautifulSoup
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import config
from webapp.services.yandex_market import make_request

def main():
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Connection": "keep-alive"
    }
    
    query = "Кофемашина"
    url = f"https://yandex.ru/search?text={requests.utils.quote(query)}&products_mode=1"
    print(f"Requesting: {url}")
    
    try:
        response = make_request("get", url, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Final URL: {response.url}")
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Save html
        with open("webapp/scratch/products_mode_search.html", "w", encoding="utf-8") as f:
            f.write(response.text)
            
        print("HTML successfully saved.")
        
        if "showcaptcha" in response.url or "captcha" in response.text.lower():
            print("CAPTCHA DETECTED!")
        else:
            print("SUCCESS! NO CAPTCHA!")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
