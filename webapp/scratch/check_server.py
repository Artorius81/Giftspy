import paramiko
import sys

def main():
    hostname = "50.114.74.242"
    username = "root"
    password = "5F8w8PbFh1jD3qC"
    
    print(f"--- Connecting to SSH {hostname}... ---")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        client.connect(hostname, username=username, password=password, timeout=10)
        print("[OK] SSH connection successful!")
        
        commands = [
            ("Project folder check", "ls -la /root/Giftspy"),
            ("Frontend folder check", "ls -la /root/Giftspy/webapp/frontend"),
            ("Dist folder content check", "ls -la /root/Giftspy/webapp/frontend/dist || echo 'No dist folder'"),
            ("Nginx paths search", "cat /etc/nginx/sites-enabled/* 2>/dev/null || cat /etc/nginx/nginx.conf 2>/dev/null || echo 'No nginx config found'")
        ]
        
        for name, cmd in commands:
            print(f"\n=== {name} ({cmd}) ===")
            stdin, stdout, stderr = client.exec_command(cmd)
            out = stdout.read().decode('utf-8', errors='ignore').strip()
            err = stderr.read().decode('utf-8', errors='ignore').strip()
            if out:
                print(out)
            if err:
                print(f"Error: {err}")
                
    except Exception as e:
        print(f"[ERR] SSH connection failed: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    main()
