import paramiko

def main():
    hostname = "50.114.74.242"
    username = "root"
    password = "5F8w8PbFh1jD3qC"
    
    print(f"--- Проверка VPN соединений на основном VPS {hostname}... ---")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password, timeout=10)
        print("[OK] SSH соединение успешно установлено!")
        
        # 1. Run ip a
        stdin, stdout, stderr = ssh.exec_command("ip a")
        print("\n=== Interfaces on Main VPS ===")
        print(stdout.read().decode('utf-8'))
        
        # 2. Check running WireGuard interfaces
        stdin, stdout, stderr = ssh.exec_command("wg show || true")
        print("\n=== WireGuard Show on Main VPS ===")
        print(stdout.read().decode('utf-8'))
        
        # 3. Check outgoing IP of host
        stdin, stdout, stderr = ssh.exec_command("curl -s https://ipinfo.io/json || true")
        print("\n=== Outgoing IP of Host ===")
        print(stdout.read().decode('utf-8'))
        
        # 4. Check outgoing IP of giftspy_bot container
        stdin, stdout, stderr = ssh.exec_command("docker exec giftspy_bot curl -s https://ipinfo.io/json || true")
        print("\n=== Outgoing IP of giftspy_bot Container ===")
        print(stdout.read().decode('utf-8'))
        
    except Exception as e:
        print(f"[ERR] Ошибка: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
