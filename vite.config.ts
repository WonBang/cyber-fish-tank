import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  // inline JS+CSS into one dist/index.html: module scripts are CORS-blocked
  // on file:// (macOS WKWebView bundle, double-clicked builds), and a single
  // file also keeps the GitHub Pages deploy shape unchanged
  base: "./",
  plugins: [viteSingleFile()],
  build: {
    target: "safari15", // WKWebView on macOS 12 (LSMinimumSystemVersion)
    outDir: "dist",
  },
});
