import requests
from bs4 import BeautifulSoup
import sys
import os

# Add root folder to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import config
from webapp.services.yandex_market import make_request

def test_search():
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Connection": "keep-alive"
    }
    
    query = "Bosch TSM6A013B"
    url = f"https://yandex.ru/products/search?text={requests.utils.quote(query)}"
    print(f"Requesting: {url}")
    
    try:
        response = make_request("get", url, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Content Length: {len(response.text)}")
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Save html preview or print title
        print(f"Title of page: {soup.title.text if soup.title else 'No Title'}")
        
        # Check if there is captcha
        if "showcaptcha" in response.url or "captcha" in response.text.lower():
            print("CAPTCHA DETECTED!")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_search()
