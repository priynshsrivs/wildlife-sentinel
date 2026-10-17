import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { localProxy, localProxyGuard } from "./dev-proxy.js";
export default defineConfig({
  plugins: [localProxyGuard(), react()],
  server: { host: "127.0.0.1", proxy: localProxy() },
});
