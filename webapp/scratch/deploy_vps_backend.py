import paramiko

def main():
    hostname = "50.114.74.242"
    username = "root"
    password = "5F8w8PbFh1jD3qC"
    
    print(f"--- Подключение к SSH {hostname} для деплоя бэкенда... ---")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password, timeout=15)
        print("[OK] SSH Connection Successful!")
        
        # 1. Pull latest git changes
        print("Выполнение git pull на сервере...")
        stdin, stdout, stderr = ssh.exec_command("cd /root/Giftspy && git pull")
        print(stdout.read().decode('utf-8'))
        print(stderr.read().decode('utf-8'))
        
        # 2. Rebuild and restart docker containers
        print("Перезапуск и сборка Docker контейнеров...")
        stdin, stdout, stderr = ssh.exec_command("cd /root/Giftspy && docker-compose down")
        stdout.read() # Wait for down to complete
        
        stdin, stdout, stderr = ssh.exec_command("cd /root/Giftspy && docker-compose up -d --build")
        print(stdout.read().decode('utf-8'))
        print(stderr.read().decode('utf-8'))
        
        # 3. Clean up unused images
        print("Очистка неиспользуемых Docker образов...")
        stdin, stdout, stderr = ssh.exec_command("docker image prune -f")
        stdout.read()
        
        print("[OK] ДЕПЛОЙ БЭКЕНДА УСПЕШНО ЗАВЕРШЕН!")
        
    except Exception as e:
        print(f"[ERR] Ошибка при деплое бэкенда: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
