#!/usr/bin/env python3
"""Start SSH tunnel to serveo.net, survives session interruption."""
import subprocess, time, re

tunnel = subprocess.Popen(
    ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null",
     "-o", "ServerAliveInterval=60", "-o", "ServerAliveCountMax=3",
     "-R", "80:localhost:3333", "serveo.net"],
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    start_new_session=True
)

print(f"Tunnel PID: {tunnel.pid}")

start = time.time()
url = None
while time.time() - start < 15:
    line = tunnel.stdout.readline()
    if line:
        print(line.strip())
        if "serveousercontent.com" in line:
            urls = re.findall(r"https://[^\s]+serveousercontent\.com", line)
            if urls:
                url = urls[0]
                with open("/tmp/tunnel_url.txt", "w") as f:
                    f.write(url)
                print(f"\nURL saved: {url}")
            break

if not url:
    print("URL not found in output. Check /tmp/hermes_tunnel.log later.")
    # Keep process info
    with open("/tmp/tunnel_pid.txt", "w") as f:
        f.write(str(tunnel.pid))
