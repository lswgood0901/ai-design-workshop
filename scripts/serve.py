"""Serve only the workshop UI and optional local model files."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import mimetypes
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("application/wasm", ".wasm")


class WorkshopHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        route = unquote(urlsplit(path).path)
        if route.startswith("/public/models/"):
            base, relative = ROOT / "public" / "models", route[len("/public/models/"):]
        else:
            base = ROOT / "web"
            relative = route[len("/web/"):] if route.startswith("/web/") else route.lstrip("/")
        parts = Path(relative).parts
        if any(p in ("..", ".") or p.startswith(".") for p in parts):
            return str(ROOT / "__not_served__")
        candidate = (base / relative).resolve()
        if not candidate.is_relative_to(base.resolve()):
            return str(ROOT / "__not_served__")
        return str(candidate)

    def list_directory(self, path):
        self.send_error(404, "Directory listing is disabled")
        return None

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("Use a port between 1024 and 65535.")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), WorkshopHandler)
    print(f"Open http://127.0.0.1:{args.port}/ — Ctrl+C to stop", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
