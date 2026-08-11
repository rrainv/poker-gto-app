import http.server
import socketserver
from pathlib import Path
from urllib.parse import unquote, urlsplit

REPOSITORY_ROOT = Path(__file__).resolve().parent
APP_DIRECTORY = REPOSITORY_ROOT / "app"
POKER_DOMAIN_DIRECTORY = REPOSITORY_ROOT / "shared" / "poker-domain"


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIRECTORY), **kwargs)

    def translate_path(self, path):
        request_path = unquote(urlsplit(path).path)
        domain_prefix = "/shared/poker-domain/"
        if request_path.startswith(domain_prefix):
            candidate = (POKER_DOMAIN_DIRECTORY / request_path[len(domain_prefix):]).resolve()
            try:
                candidate.relative_to(POKER_DOMAIN_DIRECTORY.resolve())
            except ValueError:
                return str(POKER_DOMAIN_DIRECTORY / "__invalid_path__")
            return str(candidate)
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

CustomHandler.extensions_map.update({
    '.mjs': 'application/javascript',
    '.wasm': 'application/wasm',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.html': 'text/html',
})

PORT = 3000
try:
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        print(f"Serving web app on http://localhost:{PORT}")
        httpd.serve_forever()
except OSError as e:
    print(f"Port {PORT} is in use, trying 8080...")
    PORT = 8080
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        print(f"Serving web app on http://localhost:{PORT}")
        httpd.serve_forever()
