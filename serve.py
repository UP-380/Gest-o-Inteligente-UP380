import os
import sys
from urllib.parse import unquote
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json

class FallbackHandler(SimpleHTTPRequestHandler):
    route_aliases = {
        "/painel": "dashboard.html",
    }
    def translate_path(self, path):
        path = unquote(path)
        path = path.split("?", 1)[0].split("#", 1)[0]
        rel = path.lstrip("/")
        return os.path.join(os.getcwd(), rel)

    def send_head(self):
        if self.path in self.route_aliases:
            alias_target = os.path.join(os.getcwd(), self.route_aliases[self.path])
            if os.path.exists(alias_target):
                ctype = self.guess_type(alias_target)
                try:
                    f = open(alias_target, "rb")
                except OSError:
                    self.send_error(404, "File not found")
                    return None
                self.send_response(200)
                self.send_header("Content-type", ctype)
                fs = os.fstat(f.fileno())
                self.send_header("Content-Length", str(fs[6]))
                self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
                self.end_headers()
                return f
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            index = os.path.join(path, "index.html")
            if os.path.exists(index):
                ctype = self.guess_type(index)
                try:
                    f = open(index, "rb")
                except OSError:
                    self.send_error(404, "File not found")
                    return None
                self.send_response(200)
                self.send_header("Content-type", ctype)
                fs = os.fstat(f.fileno())
                self.send_header("Content-Length", str(fs[6]))
                self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
                self.end_headers()
                return f
            self.send_error(404, "File not found")
            return None
        if os.path.exists(path) and os.path.isfile(path):
            ctype = self.guess_type(path)
            try:
                f = open(path, "rb")
            except OSError:
                self.send_error(404, "File not found")
                return None
            self.send_response(200)
            self.send_header("Content-type", ctype)
            fs = os.fstat(f.fileno())
            self.send_header("Content-Length", str(fs[6]))
            self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
            self.end_headers()
            return f
        if not path.endswith(".html"):
            html_path = path + ".html"
            if os.path.exists(html_path):
                ctype = self.guess_type(html_path)
                try:
                    f = open(html_path, "rb")
                except OSError:
                    self.send_error(404, "File not found")
                    return None
                self.send_response(200)
                self.send_header("Content-type", ctype)
                fs = os.fstat(f.fileno())
                self.send_header("Content-Length", str(fs[6]))
                self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
                self.end_headers()
                return f
        root_index = os.path.join(os.getcwd(), "index.html")
        if os.path.exists(root_index):
            ctype = self.guess_type(root_index)
            try:
                f = open(root_index, "rb")
            except OSError:
                self.send_error(404, "File not found")
                return None
            self.send_response(200)
            self.send_header("Content-type", ctype)
            fs = os.fstat(f.fileno())
            self.send_header("Content-Length", str(fs[6]))
            self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
            self.end_headers()
            return f
        self.send_error(404, "File not found")
        return None

    def do_POST(self):
        if self.path == "/api/login":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length > 0 else b""
            try:
                payload = json.loads(body.decode("utf-8")) if body else {}
            except Exception:
                payload = {}
            email = str(payload.get("email", "")).strip()
            senha = str(payload.get("senha", ""))
            if email and senha:
                data = {
                    "success": True,
                    "usuario": {"email": email}
                }
                resp = json.dumps(data).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
            else:
                data = {"success": False, "message": "Email ou senha inválidos."}
                resp = json.dumps(data).encode("utf-8")
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
            return
        return super().do_POST()

def run(port):
    server = ThreadingHTTPServer(("", port), FallbackHandler)
    print(f"Serving at http://localhost:{port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == "__main__":
    p = 4000
    if len(sys.argv) > 1:
        try:
            p = int(sys.argv[1])
        except Exception:
            pass
    run(p)
