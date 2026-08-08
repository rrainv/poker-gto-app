import http.server
import socketserver
import os

# Change to app directory
os.chdir('app')

PORT = 3000
Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving web app on http://localhost:{PORT}")
    httpd.serve_forever()
