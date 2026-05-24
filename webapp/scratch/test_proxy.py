import requests
import os
from dotenv import load_dotenv

load_dotenv()
proxy_url = os.getenv("PROXY_URL")
print(f"Using proxy: {proxy_url}")

# Let's try socks5h (DNS resolved on proxy)
proxies = {
    "http": proxy_url,
    "https": proxy_url
}

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Connection": "keep-alive"
}

# Test Yandex Search
try:
    url = "https://ya.ru"
    print(f"Fetching: {url}")
    response = requests.get(url, headers=headers, proxies=proxies, timeout=10)
    print("ya.ru Status Code:", response.status_code)
    print("ya.ru Preview:", response.text[:200])
except Exception as e:
    print("ya.ru Error:", e)

# Test Yandex Market
try:
    url = "https://market.yandex.ru/search?text=iphone"
    print(f"Fetching: {url}")
    response = requests.get(url, headers=headers, proxies=proxies, timeout=15)
    print("Market Status Code:", response.status_code)
    print("Market Preview:", response.text[:200])
except Exception as e:
    print("Market Error:", e)

# Let's also try socks5:// (local DNS resolution)
proxy_url_local = proxy_url.replace("socks5h://", "socks5://")
proxies_local = {
    "http": proxy_url_local,
    "https": proxy_url_local
}
print(f"Trying with local DNS (socks5://): {proxy_url_local}")
try:
    url = "https://ya.ru"
    print(f"Fetching: {url}")
    response = requests.get(url, headers=headers, proxies=proxies_local, timeout=10)
    print("Local DNS ya.ru Status:", response.status_code)
except Exception as e:
    print("Local DNS ya.ru Error:", e)
