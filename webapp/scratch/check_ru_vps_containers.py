import paramiko

def main():
    hostname = "45.89.228.139"
    username = "root"
    password = "N3jR9mI3R9NgBjM"
    
    print(f"--- Проверка сервисов и контейнеров на российском VPS {hostname}... ---")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password, timeout=10)
        print("[OK] SSH соединение успешно установлено!")
        
        # Check running containers
        stdin, stdout, stderr = ssh.exec_command("docker ps -a")
        print("\n=== Docker containers on RU VPS ===")
        print(stdout.read().decode('utf-8'))
        
        # Check active wireguard / AmneziaWG interfaces
        stdin, stdout, stderr = ssh.exec_command("wg show || ip link show || true")
        print("\n=== Wireguard / interfaces on RU VPS ===")
        print(stdout.read().decode('utf-8'))
        
        # Check files inside /root
        stdin, stdout, stderr = ssh.exec_command("ls -la /root")
        print("\n=== Files in /root ===")
        print(stdout.read().decode('utf-8'))
        
    except Exception as e:
        print(f"[ERR] Ошибка: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
