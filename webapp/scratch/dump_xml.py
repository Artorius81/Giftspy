import sys
import os
import base64
import requests
from bs4 import BeautifulSoup

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import config

def main():
    url = "https://searchapi.api.cloud.yandex.net/v2/web/search"
    headers = {
        "Authorization": f"Api-Key {config.YANDEX_API_KEY}",
        "Content-Type": "application/json"
    }
    body = {
        "query": {
            "searchType": "SEARCH_TYPE_RU",
            "queryText": "Bosch TSM6A013B site:market.yandex.ru"
        },
        "folderId": config.YANDEX_FOLDER_ID,
        "responseFormat": "FORMAT_XML",
        "page": 0
    }
    
    response = requests.post(url, headers=headers, json=body, timeout=7)
    if response.status_code == 200:
        raw_data_b64 = response.json().get("rawData")
        xml_content = base64.b64decode(raw_data_b64).decode("utf-8")
        soup = BeautifulSoup(xml_content, "xml")
        docs = soup.find_all("doc")
        if docs:
            print("=== Properties of the first doc ===")
            props = docs[0].find("properties")
            if props:
                for child in props.find_all(recursive=False):
                    print(f"[{child.name}]:")
                    print(child.text)
                    print("-" * 20)
            else:
                print("No properties found.")
        else:
            print("No docs found in response.")
    else:
        print(f"Error {response.status_code}: {response.text}")

if __name__ == "__main__":
    main()
