import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Vitest previously ran with zero config (relying on Vite's own tsconfig
 * discovery to resolve "@/..." imports) and only ever had to run plain
 * .ts logic files — sequencing, calculators, that kind of thing. Adding
 * component tests (.test.tsx, using React Testing Library) needs two
 * things a bare setup didn't: JSX transform (the react plugin) and a DOM
 * (jsdom) to render into. Default environment stays "node" (the existing
 * .test.ts files never touch the DOM, and node is faster) — component
 * test files opt into jsdom individually via a
 * `// @vitest-environment jsdom` docblock at the top of the file, rather
 * than a blanket `environmentMatchGlobs`, which Vitest 3 deprecated in
 * favor of `test.projects`.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
});
