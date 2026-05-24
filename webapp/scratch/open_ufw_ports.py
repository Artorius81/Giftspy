import paramiko

def main():
    hostname = "45.89.228.139"
    username = "root"
    password = "N3jR9mI3R9NgBjM"
    
    allowed_client_ip = "50.114.74.242"
    
    print(f"--- Настройка UFW фаервола на российском VPS {hostname}... ---")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password, timeout=10)
        print("[OK] SSH соединение успешно установлено!")
        
        # Configure UFW to allow port 1080 only from the main VPS IP
        print(f"Разрешение SOCKS5 (порт 1080) для IP {allowed_client_ip}...")
        stdin, stdout, stderr = ssh.exec_command(
            f"ufw allow from {allowed_client_ip} to any port 1080 proto tcp && ufw reload"
        )
        print(stdout.read().decode('utf-8'))
        print(stderr.read().decode('utf-8'))
        
        # Verify UFW status
        stdin, stdout, stderr = ssh.exec_command("ufw status")
        print("=== Актуальный статус UFW ===")
        print(stdout.read().decode('utf-8'))
        
        print("[OK] НАСТРОЙКА UFW СОВЕРШЕНА УСПЕШНО!")
        
    except Exception as e:
        print(f"[ERR] Ошибка при настройке фаервола: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
