import paramiko
import json

def main():
    hostname = "50.114.74.242"
    username = "root"
    password = "5F8w8PbFh1jD3qC"
    
    proxy_url = "socks5h://giftspy:giftspy_proxy_pass_2026@45.89.228.139:1080"
    
    print(f"--- Тестирование SOCKS5 роутинга с основного VPS {hostname}... ---")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password, timeout=10)
        print("[OK] SSH соединение успешно установлено!")
        
        # Test routing through SOCKS5
        print(f"Выполнение запроса через SOCKS5 {proxy_url}...")
        stdin, stdout, stderr = ssh.exec_command(
            f"curl -s -x {proxy_url} https://ipinfo.io/json"
        )
        output = stdout.read().decode('utf-8').strip()
        
        if not output:
            print("[WARN] Нет ответа от SOCKS5 прокси.")
            err = stderr.read().decode('utf-8').strip()
            if err:
                print(f"Curl error: {err}")
            return
            
        try:
            ip_info = json.loads(output)
            print(f"\n[SUCCESS] SOCKS5 прокси успешно работает! Маршрутизация проверена.")
            print(f"- Исходящий IP: {ip_info.get('ip')}")
            print(f"- Страна: {ip_info.get('country')}")
            print(f"- Город: {ip_info.get('city')}")
            print(f"- Организация/Провайдер: {ip_info.get('org')}")
        except json.JSONDecodeError:
            print("[ERR] Ответ прокси не является валидным JSON!")
            print(f"Ответ: {output}")
            
    except Exception as e:
        print(f"[ERR] Ошибка при тестировании: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
