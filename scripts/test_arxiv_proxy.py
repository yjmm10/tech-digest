"""验证 arXiv 双后端支持 ARXIV_API_BASE 代理 + 真实网络连通性。"""
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from digest_sources.arxiv import (  # noqa: E402
    _arxiv_api_base,
    _arxiv_export_api_url,
    _fetch_arxiv_api,
    _fetch_arxiv_library,
)

ATOM = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
  <title>arXiv Query</title><id>http://arxiv.org/api/test</id><updated>2026-11-25T00:00:00Z</updated>
  <opensearch:totalResults>1</opensearch:totalResults>
  <opensearch:startIndex>0</opensearch:startIndex>
  <opensearch:itemsPerPage>1</opensearch:itemsPerPage>
  <entry>
    <id>http://arxiv.org/abs/2607.12345v1</id>
    <title>Test UAV Paper</title>
    <summary>test summary</summary>
    <published>2026-07-03T00:00:00Z</published>
    <author><name>Test Author</name></author>
    <link href="http://arxiv.org/abs/2607.12345v1" rel="alternate" type="text/html"/>
    <arxiv:primary_category term="cs.RO" xmlns:arxiv="http://arxiv.org/schemas/atom"/>
    <category term="cs.RO" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
</feed>"""

failures = []


def check(name, ok, detail=""):
    print(("PASS" if ok else "FAIL") + "  " + name + (f"  [{detail}]" if detail and not ok else ""))
    if not ok:
        failures.append(name)


# --- 1) base 解析 ---
os.environ.pop("ARXIV_API_BASE", None)
check("默认 base=官方", _arxiv_api_base() == "https://export.arxiv.org")
u = _arxiv_export_api_url("all:uav", sort_by="submittedDate", sort_order="descending", max_results=5)
check("默认 URL 指向官方", u.startswith("https://export.arxiv.org/api/query?"), u)

os.environ["ARXIV_API_BASE"] = "https://arxiv-proxy.example.workers.dev/"
check("代理 base 去尾斜杠", _arxiv_api_base() == "https://arxiv-proxy.example.workers.dev")
u2 = _arxiv_export_api_url("all:uav", sort_by="submittedDate", sort_order="descending", max_results=5)
check("代理 URL 指向 worker", u2.startswith("https://arxiv-proxy.example.workers.dev/api/query?"), u2)

os.environ["ARXIV_API_BASE"] = "export.arxiv.org"
check("非法 base 回退官方", _arxiv_api_base() == "https://export.arxiv.org")

# --- 2) 本地假代理：两个后端都应命中并解析 ---
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/atom+xml")
        self.end_headers()
        self.wfile.write(ATOM.encode())

    def log_message(self, *a):
        pass


srv = HTTPServer(("127.0.0.1", 0), H)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

os.environ["ARXIV_API_BASE"] = f"http://127.0.0.1:{port}"
ctx = SimpleNamespace(date_range="202607010000 TO 202607072359")
cfg = {"max_results": 5, "library_page_size": 100, "library_delay_seconds": 0, "library_num_retries": 1}

got_api = _fetch_arxiv_api(ctx, cfg, "uav")
check("api 后端走代理取到条目", len(got_api) == 1 and got_api[0]["title"] == "Test UAV Paper", str(got_api)[:120])

got_lib = _fetch_arxiv_library(ctx, cfg, "uav")
check("library 后端走代理取到条目", len(got_lib) == 1 and got_lib[0]["link"].endswith("2607.12345v1"), str(got_lib)[:120])
srv.shutdown()

# --- 3) 真实网络：默认官方地址（本地 IP 通常未限流）---
os.environ.pop("ARXIV_API_BASE", None)
os.environ["ARXIV_READ_TIMEOUT"] = "60"
try:
    real = _fetch_arxiv_api(SimpleNamespace(date_range="202607010000 TO 202607072359"),
                            {"max_results": 3}, "uav")
    check("真实官方 API 取到条目", len(real) > 0, f"n={len(real)}")
except Exception as e:
    check("真实官方 API 取到条目", False, f"{type(e).__name__}: {e}")

print(("\nALL ARXIV CHECKS PASSED" if not failures else f"\n{len(failures)} FAILED: {failures}"))
sys.exit(1 if failures else 0)
