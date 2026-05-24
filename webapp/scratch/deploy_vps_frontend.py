import os
import paramiko

def upload_dir(sftp, local_dir, remote_dir):
    """Recursively uploads a local directory to a remote directory via SFTP."""
    # Ensure remote directory exists
    try:
        sftp.mkdir(remote_dir)
        print(f"Создана удаленная папка: {remote_dir}")
    except OSError:
        pass # Already exists

    for item in os.listdir(local_dir):
        local_path = os.path.join(local_dir, item)
        # Use forward slashes for Linux paths
        remote_path = f"{remote_dir}/{item}"
        
        if os.path.isdir(local_path):
            upload_dir(sftp, local_path, remote_path)
        else:
            print(f"Загрузка файла: {item} -> {remote_path}")
            sftp.put(local_path, remote_path)

def main():
    hostname = "50.114.74.242"
    username = "root"
    password = "5F8w8PbFh1jD3qC"
    
    local_dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
    # The TRUE Nginx root folder extracted from nginx config!
    remote_nginx_root = "/var/www/giftspy"
    
    print(f"--- Локальный путь сборки: {local_dist_path} ---")
    if not os.path.exists(local_dist_path):
        print("❌ Локальная папка dist не найдена! Сначала соберите проект через npm run build.")
        return
        
    print(f"--- Подключение к SSH/SFTP {hostname}... ---")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password, timeout=15)
        print("[OK] SSH Connection Successful!")
        
        # 1. Clear old web files in the actual Nginx web root
        print(f"Очистка старых файлов в {remote_nginx_root}...")
        stdin, stdout, stderr = ssh.exec_command(f"rm -rf {remote_nginx_root}/*")
        stdout.read() # Wait for completion
        
        # 2. Open SFTP session
        sftp = ssh.open_sftp()
        print("Запуск рекурсивной загрузки нового билда...")
        upload_dir(sftp, local_dist_path, remote_nginx_root)
        sftp.close()
        
        # 3. Reload Nginx to be absolutely sure
        print("Перезагрузка Nginx на сервере...")
        stdin, stdout, stderr = ssh.exec_command("nginx -s reload || systemctl reload nginx")
        stdout.read()
        
        print("[OK] ДЕПЛОЙ ФРОНТЕНДА УСПЕШНО ЗАВЕРШЕН!")
        
    except Exception as e:
        print(f"[ERR] Ошибка при деплое: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
