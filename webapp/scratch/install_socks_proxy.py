import paramiko

def main():
    hostname = "45.89.228.139"
    username = "root"
    password = "N3jR9mI3R9NgBjM"
    
    proxy_user = "giftspy"
    proxy_pass = "giftspy_proxy_pass_2026"
    
    print(f"--- Установка SOCKS5 прокси на российском VPS {hostname}... ---")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password, timeout=15)
        print("[OK] SSH соединение успешно установлено!")
        
        # 1. Update and install dante-server
        print("Обновление пакетов и установка dante-server...")
        stdin, stdout, stderr = ssh.exec_command("apt-get update && apt-get install -y dante-server")
        stdout.read() # Wait for completion
        
        # 2. Create the system user for proxy authentication
        print(f"Создание системного пользователя '{proxy_user}' для прокси...")
        # Create user if it doesn't exist
        ssh.exec_command(f"id -u {proxy_user} || useradd -m -s /usr/sbin/nologin {proxy_user}")
        
        # Set password for the user
        stdin, stdout, stderr = ssh.exec_command(f"chpasswd")
        stdin.write(f"{proxy_user}:{proxy_pass}\n")
        stdin.flush()
        stdin.close()
        stdout.read()
        
        # 3. Create Dante configuration file
        dante_config = """logoutput: syslog
user.privileged: root
user.unprivileged: nobody

internal: 0.0.0.0 port = 1080
external: eth0

socksmethod: username

client pass {
    from: 0.0.0.0/0 to: 0.0.0.0/0
    log: connect disconnect error
}

socks pass {
    from: 0.0.0.0/0 to: 0.0.0.0/0
    command: bind connect udpassociate
    log: connect disconnect error
    socksmethod: username
}
"""
        
        print("Запись конфигурации /etc/danted.conf...")
        # We can write the config file directly
        sftp = ssh.open_sftp()
        with sftp.open("/etc/danted.conf", "w") as f:
            f.write(dante_config)
        sftp.close()
        
        # 4. Restart and enable Dante service
        print("Перезапуск и включение автозапуска dante-server...")
        stdin, stdout, stderr = ssh.exec_command("systemctl restart danted && systemctl enable danted")
        stdout.read()
        
        # 5. Check if Dante is running on port 1080
        stdin, stdout, stderr = ssh.exec_command("ss -lntp | grep 1080 || true")
        status = stdout.read().decode('utf-8').strip()
        print(f"=== Статус порта SOCKS5 (1080) ===\n{status}")
        
        print("[OK] SOCKS5 ПРОКСИ СЕРВЕР УСПЕШНО НАСТРОЕН!")
        print(f"Адрес прокси: socks5://{proxy_user}:{proxy_pass}@{hostname}:1080")
        
    except Exception as e:
        print(f"[ERR] Ошибка при настройке прокси: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
