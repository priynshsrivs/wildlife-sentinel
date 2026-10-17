"""Standard-library preflight shared by bootstrap and process supervisor."""

import socket


def service_ports(frontend_port=5173, camera=False):
    if not 1 <= frontend_port <= 65535:
        raise RuntimeError("Frontend port must be between 1 and 65535")
    ports = {"backend": 8000, "audio": 5001, "frontend": frontend_port}
    if camera:
        ports["camera"] = 8080
    if len(set(ports.values())) != len(ports):
        raise RuntimeError("Frontend port conflicts with another Sentinel service")
    return ports


def check_ports(ports):
    for name, port in ports.items():
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
                if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                    probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
                probe.bind(("127.0.0.1", port))
        except OSError:
            raise RuntimeError(
                f"Port {port} ({name}) is already occupied or unavailable. "
                "Stop the other Sentinel copy/service first, or choose --frontend-port for a frontend conflict. "
                "Existing processes will not be stopped."
            ) from None
