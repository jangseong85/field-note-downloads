import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: { target: "es2022", outDir: "dist-dock", rollupOptions: { input: "dock.html" } },
});
