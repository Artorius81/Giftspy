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
            "queryText": "Кофемашина"
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
        
        print(f"Total docs found: {len(docs)}")
        
        # Let's inspect everything inside the first few docs
        for idx, doc in enumerate(docs[:3], 1):
            print(f"\n=================== DOC {idx} ===================")
            print(f"URL: {doc.find('url').text if doc.find('url') else ''}")
            print(f"Title: {doc.find('title').text if doc.find('title') else ''}")
            
            # Print all child tag names in doc
            children = [c.name for c in doc.find_all(recursive=False)]
            print(f"Children tags: {children}")
            
            # Print properties children
            props = doc.find("properties")
            if props:
                print("Properties children:")
                for p_child in props.find_all(recursive=False):
                    print(f"  [{p_child.name}] size={len(p_child.text)} text={p_child.text[:120]}...")
            
            # Print mime-type, pass, passages
            print(f"Mime-type: {doc.find('mime-type').text if doc.find('mime-type') else 'None'}")
            print(f"Snippet/Passages:")
            for passage in doc.find_all("passage"):
                print(f"  - {passage.text}")
                
    else:
        print(f"Error {response.status_code}: {response.text}")

if __name__ == "__main__":
    main()
