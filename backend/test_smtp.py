import smtplib
import socket

def check_port(host, port):
    try:
        sock = socket.create_connection((host, port), timeout=5)
        print(f"Success connecting to {host}:{port}")
        sock.close()
    except Exception as e:
        print(f"Failed connecting to {host}:{port} - {e}")

check_port("smtp.gmail.com", 587)
check_port("smtp.gmail.com", 465)
