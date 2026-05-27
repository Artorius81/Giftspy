import requests
from bs4 import BeautifulSoup
import sys
import os

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
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Connection": "keep-alive"
    }
    
    query = "Кофемашина"
    url = f"https://yandex.ru/search?text={requests.utils.quote(query)}&products_mode=1"
    print(f"Requesting through proxy: {url}")
    
    try:
        response = requests.get(url, headers=headers, proxies=proxies, timeout=12)
        print(f"Status Code: {response.status_code}")
        print(f"Final URL: {response.url}")
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Save HTML
        with open("webapp/scratch/proxy_products_search.html", "w", encoding="utf-8") as f:
            f.write(response.text)
            
        print("HTML successfully saved.")
        
        if "showcaptcha" in response.url or "captcha" in response.text.lower():
            print("CAPTCHA DETECTED through proxy!")
        else:
            print("SUCCESS! NO CAPTCHA through proxy!")
            # Let's count potential product containers in the HTML
            # Check for standard product markup or class names
            # (e.g. elements containing price or shop info)
            print("Page title:", soup.title.text if soup.title else "No title")
            
    except Exception as e:
        print(f"Error through proxy: {e}")

if __name__ == "__main__":
    main()
