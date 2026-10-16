import socket
import argparse
from app import create_app

app = create_app()

def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) == 0

def get_best_port(requested_port: int, host: str = "127.0.0.1") -> int:
    if not is_port_in_use(requested_port, "127.0.0.1"):
        return requested_port
    
    # Port 5000 is occupied (typically by macOS AirPlay Receiver). Automatically fall back to 5001+.
    fallback = 5001 if requested_port == 5000 else requested_port + 1
    while fallback < 65535:
        if not is_port_in_use(fallback, "127.0.0.1"):
            return fallback
        fallback += 1
    return requested_port

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run LyricStudio Web Server")
    parser.add_argument("--host", nargs="?", const="0.0.0.0", default="127.0.0.1", help="Host to bind (default 127.0.0.1, or 0.0.0.0 if flag provided without value)")
    parser.add_argument("--port", type=int, default=5001, help="Port to bind (default 5001, avoids macOS AirPlay collision on 5000)")
    args, _ = parser.parse_known_args()

    port = get_best_port(args.port, args.host)
    print(f"\n🚀 LyricStudio is running at: http://127.0.0.1:{port} (or http://{args.host}:{port})\n")
    app.run(host=args.host, port=port, debug=True)
