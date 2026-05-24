import os
import sys

# Add root folder to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from webapp.services.webview import fetch_and_process_market_page

print("--- Testing webview.py direct execution ---")
query = "кофемолка"
print(f"Querying Yandex Market for: '{query}'")

try:
    html_content = fetch_and_process_market_page(query)
    print("Success! Length of HTML returned:", len(html_content))
    
    # Check if critical scripts and tags are present in returned HTML
    has_base = "<base href=\"https://market.yandex.ru/\">" in html_content
    has_script = "Giftspy WebView Proxy" in html_content
    has_error = "Ошибка подключения" in html_content or "Ошибка:" in html_content
    
    print(f"Contains <base href...>: {has_base}")
    print(f"Contains script injection: {has_script}")
    print(f"Contains error message: {has_error}")
    
    if not has_error:
        print("HTML Preview:")
        print(html_content[:800])
except Exception as e:
    print("Execution failed with exception:", e)
