import http.server
import socketserver

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="app", **kwargs)
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
    '.onnx': 'application/octet-stream',
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
