// Never turn an arbitrary website's Origin into a trusted backend Origin.
export function allowedLocalOrigin(headers) {
  const host = headers.host || "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) return false;
  return !headers.origin || headers.origin === `http://${host}`;
}
export function localProxyGuard() {
  return {
    name: "sentinel-local-proxy-guard",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (
          /^\/(api(?:\/|$)|health(?:\?|$)|ws(?:\/|$))/.test(request.url) &&
          !allowedLocalOrigin(request.headers)
        ) {
          response
            .writeHead(403)
            .end("Development proxy requires a local same-origin request");
          return;
        }
        next();
      });
    },
  };
}
export function localProxy(target = "http://127.0.0.1:8000") {
  return {
    "^/api(?:/|$)": { target, changeOrigin: true },
    "^/health(?:[?]|$)": { target, changeOrigin: true },
    "^/ws/": {
      target,
      ws: true,
      changeOrigin: true,
      configure(proxy) {
        proxy.on("proxyReqWs", (outgoing, incoming, socket) => {
          if (!allowedLocalOrigin(incoming.headers)) {
            socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
            outgoing.destroy();
            return;
          }
          outgoing.setHeader("origin", "http://127.0.0.1:5173");
        });
      },
    },
  };
}
