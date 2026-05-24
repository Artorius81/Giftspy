import paramiko

def main():
    hostname = "45.89.228.139"
    username = "root"
    password = "N3jR9mI3R9NgBjM"
    
    print(f"--- Подключение к российскому VPS {hostname}... ---")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password, timeout=10)
        print("[OK] SSH соединение успешно установлено!")
        
        # Check OS
        stdin, stdout, stderr = ssh.exec_command("cat /etc/os-release")
        print("\n=== OS Release ===")
        print(stdout.read().decode('utf-8'))
        
        # Check installed package managers / docker
        stdin, stdout, stderr = ssh.exec_command("which apt-get yum docker docker-compose || true")
        print("=== Tools ===")
        print(stdout.read().decode('utf-8'))
        
    except Exception as e:
        print(f"[ERR] Ошибка подключения: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
