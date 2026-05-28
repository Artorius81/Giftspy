import subprocess
from bs4 import BeautifulSoup
import sys
import os

def main():
    query = "Кофемашина"
    url = f"https://yandex.ru/search?text={query}&products_mode=1"
    print(f"Requesting via curl: {url}")
    
    try:
        # Run native curl command with standard browser headers to look fully realistic
        cmd = [
            "curl",
            "-s",
            "-H", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            "-H", "Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            "-H", "Connection: keep-alive",
            "-L", # follow redirects
            url
        ]
        
        # Run curl command
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore")
        html = result.stdout
        
        print(f"Curl Status: {result.returncode}")
        print(f"Content Length: {len(html)}")
        
        # Save HTML
        with open("webapp/scratch/curl_search_results.html", "w", encoding="utf-8") as f:
            f.write(html)
            
        soup = BeautifulSoup(html, "html.parser")
        print("Page title:", soup.title.text if soup.title else "No title")
        
        if "showcaptcha" in html or "captcha" in html.lower():
            print("CAPTCHA DETECTED via curl!")
        else:
            print("SUCCESS! NO CAPTCHA via curl!")
            
    except Exception as e:
        print(f"Error via curl: {e}")

if __name__ == "__main__":
    main()
