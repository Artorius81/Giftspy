import sys
import os

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from webapp.services.yandex_market import get_yandex_market_suggestions

def main():
    query = "Bosch TSM6A013B"
    print(f"--- Testing Yandex Market search for: '{query}' ---")
    
    results = get_yandex_market_suggestions(query)
    
    if not results:
        print("[ERR] No results found or error occurred!")
        return
        
    print(f"[OK] Found products: {len(results)}")
    for idx, card in enumerate(results, 1):
        print(f"\n[Product {idx}]")
        print(f"Title: {card['title']}")
        print(f"Price: {card['price']} {card['currency']}")
        print(f"URL: {card['url']}")
        print(f"Image (preview): {card['image'][:100]}...")
        print(f"Description: {card['description'][:150]}...")
        print("-" * 40)

if __name__ == "__main__":
    main()
