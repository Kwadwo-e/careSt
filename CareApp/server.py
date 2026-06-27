from pathlib import Path
import os
import secrets
import subprocess
import sys
import time
import urllib.request
import webbrowser


PORT = os.environ.get("CAREAPP_PORT", "4000")


def app_dir():
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def ensure_secret(server_data_dir):
    server_data_dir.mkdir(parents=True, exist_ok=True)
    secret_file = server_data_dir / "jwt-secret.txt"
    if not secret_file.exists():
        secret_file.write_text(secrets.token_urlsafe(48), encoding="utf-8")
    return secret_file.read_text(encoding="utf-8").strip()


def health_url():
    return f"http://127.0.0.1:{PORT}/api/health"


def app_url():
    return f"http://127.0.0.1:{PORT}/"


def wait_for_server(timeout_seconds=30):
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(health_url(), timeout=2) as response:
                if response.status == 200:
                    return True
        except Exception:
            time.sleep(1)
    return False


def main():
    root = app_dir()
    node = root / "node" / "node.exe"
    server_dir = root / "server"
    server_script = server_dir / "src" / "local-dev-server.js"
    client_dist = root / "client" / "dist"
    data_dir = server_dir / "data"
    uploads_dir = server_dir / "uploads"

    if not node.exists():
        print(f"Cannot find bundled Node.js runtime: {node}")
        input("Press Enter to close.")
        return 1

    if not server_script.exists():
        print(f"Cannot find CareApp server file: {server_script}")
        input("Press Enter to close.")
        return 1

    data_dir.mkdir(parents=True, exist_ok=True)
    uploads_dir.mkdir(parents=True, exist_ok=True)

    if wait_for_server(timeout_seconds=2):
        print("CareApp is already running.")
        webbrowser.open(app_url())
        input("Press Enter to close this launcher window.")
        return 0

    env = os.environ.copy()
    env["NODE_ENV"] = "production"
    env["PORT"] = PORT
    env["JWT_SECRET"] = ensure_secret(data_dir)
    env["CLIENT_DIST_DIR"] = str(client_dist)
    env.setdefault("DEFAULT_ADMIN_USERNAME", "superadmin")
    env.setdefault("DEFAULT_ADMIN_PASSWORD", "ChangeMeNow!2026")
    env.setdefault("DEFAULT_ADMIN_NAME", "Super Administrator")

    log_file = root / "careapp-server.log"
    print("Starting CareApp...")
    print(f"Log file: {log_file}")
    log = log_file.open("a", encoding="utf-8")

    process = subprocess.Popen(
        [str(node), str(server_script)],
        cwd=str(server_dir),
        env=env,
        stdout=log,
        stderr=log,
    )

    if wait_for_server():
        print(f"CareApp is running at {app_url()}")
        webbrowser.open(app_url())
        print("Keep this window open while using CareApp.")
        print("Press Ctrl+C to stop CareApp.")
    else:
        print("CareApp did not start within 30 seconds.")
        print("Open careapp-server.log in the installation folder for details.")

    try:
        process.wait()
    except KeyboardInterrupt:
        print("Stopping CareApp...")
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
    finally:
        log.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
