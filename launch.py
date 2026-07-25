#!/usr/bin/env python3
"""Start Hermes UI server + Serveo tunnel, survive session interruptions."""
import subprocess, time, re, os, sys

CEREBRO = "/opt/data/cerebro"

# Kill any lingering uvicorn or ssh processes
subprocess.run(["pkill", "-f", "uvicorn main:app"], capture_output=True)
subprocess.run(["pkill", "-f", "serveo.net"], capture_output=True)
time.sleep(1)

print("Starting uvicorn...")
server = subprocess.Popen(
    ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3333"],
    stdout=open("/tmp/hermes_server.log", "w"),
    stderr=subprocess.STDOUT,
    cwd=f"{CEREBRO}/backend",
    start_new_session=True,
)
print(f"  Server PID: {server.pid}")

# Wait for server to start
for i in range(10):
    time.sleep(1)
    r = subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "http://localhost:3333/"],
        capture_output=True, text=True, timeout=5,
    )
    if r.stdout.strip() == "200":
        print("  Server is UP (200)")
        break
    print(f"  Waiting... ({r.stdout.strip()})")
else:
    print("  Server failed to start!")
    sys.exit(1)

print("Starting Serveo tunnel...")
tunnel = subprocess.Popen(
    [
        "ssh",
        "-o", "StrictHostKeyChecking=no",
        "-o", "UserKnownHostsFile=/dev/null",
        "-o", "ServerAliveInterval=60",
        "-o", "ServerAliveCountMax=3",
        "-R", "80:localhost:3333", "serveo.net",
    ],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    start_new_session=True,
)
print(f"  Tunnel PID: {tunnel.pid}")

# Wait for tunnel URL
url = None
start = time.time()
while time.time() - start < 20:
    line = tunnel.stdout.readline()
    if line:
        print(f"  tunnel: {line.strip()}")
        urls = re.findall(r"https://[^\s]+serveousercontent\.com", line)
        if urls:
            url = urls[0]
            with open("/tmp/tunnel_url.txt", "w") as f:
                f.write(url)
            break

if url:
    print(f"\n✅ Tunnel URL: {url}")
else:
    print("\n⚠️  Tunnel URL not detected. Check /tmp/hermes_tunnel.log")

print(f"\nServer PID: {server.pid}, Tunnel PID: {tunnel.pid}")
print("Both started with start_new_session=True — they survive interruptions.")
