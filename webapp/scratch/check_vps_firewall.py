import paramiko

def main():
    hostname = "45.89.228.139"
    username = "root"
    password = "N3jR9mI3R9NgBjM"
    
    print(f"--- Проверка фаервола на российском VPS {hostname}... ---")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password, timeout=10)
        print("[OK] SSH соединение успешно установлено!")
        
        # 1. Check ufw status
        stdin, stdout, stderr = ssh.exec_command("ufw status || true")
        print("\n=== UFW Status ===")
        print(stdout.read().decode('utf-8'))
        
        # 2. Check iptables rules
        stdin, stdout, stderr = ssh.exec_command("iptables -L -n -v | grep -i 8888 || echo 'No specific iptables for 8888'")
        print("\n=== iptables check ===")
        print(stdout.read().decode('utf-8'))
        
        # 3. Check tinyproxy logs
        stdin, stdout, stderr = ssh.exec_command("tail -n 20 /var/log/tinyproxy/tinyproxy.log || journalctl -u tinyproxy --no-pager -n 20 || true")
        print("\n=== Tinyproxy Logs ===")
        print(stdout.read().decode('utf-8'))
        
    except Exception as e:
        print(f"[ERR] Ошибка: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
