import paramiko

def main():
    hostname = "45.89.228.139"
    username = "root"
    password = "N3jR9mI3R9NgBjM"
    
    allowed_client_ip = "50.114.74.242"
    
    print(f"--- Установка Tinyproxy (HTTP) на российском VPS {hostname}... ---")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password, timeout=15)
        print("[OK] SSH соединение успешно установлено!")
        
        # 1. Install tinyproxy
        print("Обновление пакетов и установка tinyproxy...")
        stdin, stdout, stderr = ssh.exec_command("apt-get update && apt-get install -y tinyproxy")
        stdout.read() # Wait for completion
        
        # 2. Write custom secure tinyproxy configuration
        tinyproxy_config = f"""User tinyproxy
Group tinyproxy

Port 8888
Listen 0.0.0.0
Timeout 600
DefaultErrorFile "/usr/share/tinyproxy/default.html"
StatFile "/usr/share/tinyproxy/stats.html"
LogFile "/var/log/tinyproxy/tinyproxy.log"
LogLevel Info
PidFile "/var/run/tinyproxy/tinyproxy.pid"

MaxClients 100
MinSpareServers 5
MaxSpareServers 20
StartServers 10
MaxRequestsPerChild 0

# SECURE: Allow only the Giftspy VPS IP
Allow {allowed_client_ip}
Allow 127.0.0.1

ViaHeader "X-Tinyproxy"
ConnectPort 443
ConnectPort 563
ConnectPort 80
"""
        
        print("Запись конфигурации /etc/tinyproxy/tinyproxy.conf...")
        sftp = ssh.open_sftp()
        with sftp.open("/etc/tinyproxy/tinyproxy.conf", "w") as f:
            f.write(tinyproxy_config)
        sftp.close()
        
        # 3. Restart and enable tinyproxy
        print("Перезапуск и включение автозапуска tinyproxy...")
        stdin, stdout, stderr = ssh.exec_command("systemctl restart tinyproxy && systemctl enable tinyproxy")
        stdout.read()
        
        # 4. Check if Tinyproxy is listening on port 8888
        stdin, stdout, stderr = ssh.exec_command("ss -lntp | grep 8888 || true")
        status = stdout.read().decode('utf-8').strip()
        print(f"=== Статус порта Tinyproxy (8888) ===\n{status}")
        
        print("[OK] HTTP/HTTPS ТАЙНИПРОКСИ СЕРВЕР УСПЕШНО НАСТРОЕН!")
        print(f"Адрес прокси: http://{hostname}:8888 (разрешен доступ только для {allowed_client_ip})")
        
    except Exception as e:
        print(f"[ERR] Ошибка при настройке tinyproxy: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
