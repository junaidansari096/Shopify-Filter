import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  plugins: [reactRouter()],
  server: {
    port: 3000,
    allowedHosts: [".ngrok.io", ".ngrok-free.app", "localhost"],
  },
  resolve: {
    alias: {
      "@shopify/polaris-icons": path.resolve(
        __dirname,
        "node_modules/@shopify/polaris-icons/dist/index.js"
      ),
    },
  },
  ssr: {
    noExternal: ["@shopify/polaris", "@shopify/polaris-icons"],
  },
});
