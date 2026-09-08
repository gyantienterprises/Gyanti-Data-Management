import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  server: {
    watch: {
      // Ignore temporary file creation inside DATA folder
      ignored: ["**/DATA/**"],
    },
  },
});
