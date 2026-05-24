import paramiko

def main():
    hostname = "50.114.74.242"
    username = "root"
    password = "5F8w8PbFh1jD3qC"
    
    proxy_line = "PROXY_URL=socks5h://giftspy:giftspy_proxy_pass_2026@45.89.228.139:1080"
    
    print(f"--- Обновление .env на основном VPS {hostname}... ---")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password, timeout=10)
        print("[OK] SSH соединение успешно установлено!")
        
        # Check if PROXY_URL is already in .env
        stdin, stdout, stderr = ssh.exec_command("grep -q 'PROXY_URL=' /root/Giftspy/.env && echo 'exists' || echo 'missing'")
        status = stdout.read().decode('utf-8').strip()
        
        if status == 'exists':
            print("PROXY_URL уже присутствует в удаленном файле .env. Обновляем значение...")
            # Remove old PROXY_URL lines
            ssh.exec_command("sed -i '/PROXY_URL=/d' /root/Giftspy/.env")
        else:
            print("PROXY_URL отсутствует в удаленном файле .env. Добавляем...")
            
        # Append the proxy configuration line
        stdin, stdout, stderr = ssh.exec_command(f"echo '{proxy_line}' >> /root/Giftspy/.env")
        stdout.read() # Wait for completion
        
        # Verify the file ends with the new configuration
        stdin, stdout, stderr = ssh.exec_command("tail -n 3 /root/Giftspy/.env")
        print("\n=== Последние строки удаленного .env ===")
        print(stdout.read().decode('utf-8'))
        
        print("[OK] ДАННЫЕ В УДАЛЕННОМ .env УСПЕШНО ОБНОВЛЕНЫ!")
        
    except Exception as e:
        print(f"[ERR] Ошибка: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
