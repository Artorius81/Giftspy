import requests

def test_unsplash():
    # Test if Unsplash source redirect works
    url = "https://images.unsplash.com/photo-1549465220-1a8b9238cd48" # fallback
    queries = ["coffee-maker", "keychron", "perfume", "smartphone"]
    
    for q in queries:
        try:
            # Let's try unsplash source featured URL
            test_url = f"https://source.unsplash.com/featured/?{q}"
            resp = requests.head(test_url, timeout=3, allow_redirects=True)
            print(f"Query '{q}': Status {resp.status_code}, URL: {resp.url}")
        except Exception as e:
            print(f"Query '{q}' failed: {e}")

if __name__ == "__main__":
    test_unsplash()
