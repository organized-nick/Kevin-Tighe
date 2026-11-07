"""
server.py
Multi-threaded, high-concurrency HTTP/1.1 server for Kevin Tighe: 3D Lakeside Retreat.

Features:
- Dual-stack IPv6/IPv4 binding on port 8097
- Persistent Keep-Alive connections via HTTP/1.1 (prevents socket churn)
- Expanded TCP listen backlog (128) to eliminate connection refused errors during rapid test sweeps
- ThreadingHTTPServer for concurrent asset delivery
"""
import http.server
import socketserver

# Expand OS TCP listen queue from default 5 to 128
socketserver.TCPServer.request_queue_size = 128

if __name__ == '__main__':
    http.server.test(
        HandlerClass=http.server.SimpleHTTPRequestHandler,
        protocol='HTTP/1.1',
        port=8097
    )
