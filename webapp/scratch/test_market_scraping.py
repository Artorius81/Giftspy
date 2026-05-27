import requests
from bs4 import BeautifulSoup
import sys
import os
import urllib.parse

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import config

def main():
    proxy_url = "socks5h://giftspy:giftspy_proxy_pass_2026@45.89.228.139:1080"
    proxies = {
        "http": proxy_url,
        "https": proxy_url
    }
    
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Connection": "keep-alive",
        "Referer": "https://m.market.yandex.ru/"
    }
    
    query = "Кофемашина"
    url = f"https://m.market.yandex.ru/search?text={urllib.parse.quote(query)}"
    print(f"Requesting mobile market: {url}")
    
    try:
        response = requests.get(url, headers=headers, proxies=proxies, timeout=15)
        print(f"Status Code: {response.status_code}")
        print(f"Content Length: {len(response.text)}")
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        with open("webapp/scratch/market_scraping_results.html", "w", encoding="utf-8") as f:
            f.write(response.text)
            
        print("HTML saved.")
        
        # Check if we got captcha
        if "showcaptcha" in response.url or "captcha" in response.text.lower():
            print("CAPTCHA DETECTED on Yandex Market!")
        else:
            print("SUCCESS! NO CAPTCHA on Yandex Market!")
            print("Title:", soup.title.text if soup.title else "No title")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
