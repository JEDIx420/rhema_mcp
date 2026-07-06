from __future__ import annotations

from http.server import HTTPServer
from typing import Type

from .config import get_settings


def create_http_server(handler: Type) -> HTTPServer:
    settings = get_settings()
    return HTTPServer((settings.api_host, settings.api_port), handler)


def serve(handler: Type) -> None:
    settings = get_settings()
    server = create_http_server(handler)
    print(f"Rhelo HTTP API running on port {settings.api_port}...")
    server.serve_forever()
