import paramiko
import json

def main():
    hostname = "50.114.74.242"
    username = "root"
    password = "5F8w8PbFh1jD3qC"
    
    print(f"--- Проверка работоспособности живого API на VPS {hostname} (Порт 8001)... ---")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password, timeout=10)
        print("[OK] SSH соединение успешно установлено!")
        
        # Test query via curl to local FastAPI container inside docker
        print("Отправка тестового запроса к эндпоинту поиска подарков на порт 8001...")
        stdin, stdout, stderr = ssh.exec_command(
            'curl -s "http://localhost:8001/api/market/search?query=Keychron&page=0" -H "X-Dev-User-Id: 1"'
        )
        output = stdout.read().decode('utf-8').strip()
        
        if not output:
            print("[WARN] Пустой ответ от API.")
            err = stderr.read().decode('utf-8').strip()
            if err:
                print(f"Curl error: {err}")
            return
            
        try:
            results = json.loads(output)
            print(f"[OK] Получен валидный JSON ответ от API!")
            print(f"Количество найденных товаров: {len(results)}")
            
            if results:
                print("\nПример первого найденного товара:")
                first = results[0]
                print(f"- Название: {first.get('title')}")
                print(f"- Цена: {first.get('price')} {first.get('currency')}")
                print(f"- Старая цена: {first.get('old_price')}")
                print(f"- Ссылка: {first.get('url')}")
                print(f"- Изображение: {first.get('image')}")
            else:
                print("[WARN] Список товаров пуст.")
        except json.JSONDecodeError:
            print("[ERR] Ответ API не является валидным JSON!")
            print(f"Ответ: {output[:500]}...")
            
    except Exception as e:
        print(f"[ERR] Ошибка при проверке API: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
