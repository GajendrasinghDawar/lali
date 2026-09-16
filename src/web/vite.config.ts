import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  root: import.meta.dirname,
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true, routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts' }),
    react(),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },

      "/csrf-token": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
  }
});
