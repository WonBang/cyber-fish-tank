import { defineConfig } from "vite";

export default defineConfig({
  // relative asset paths: required for file:// loading in the macOS WKWebView
  // bundle and for the GitHub Pages subpath
  base: "./",
  build: {
    target: "safari15", // WKWebView on macOS 12 (LSMinimumSystemVersion)
    outDir: "dist",
    assetsInlineLimit: 0,
  },
});
