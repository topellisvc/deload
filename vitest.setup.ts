import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Test files here use explicit `import { describe, it, ... } from "vitest"`
// rather than globals (see vitest.config.ts) — React Testing Library's own
// automatic cleanup only hooks into a *global* afterEach, so without
// `test.globals: true` it never runs on its own. Without this, a component
// rendered in one test is still in the DOM for the next `render()` in the
// same file, which is exactly what caused the very first component tests
// here to fail with "found multiple elements" (leftover buttons from a
// prior test's render).
afterEach(() => {
  cleanup();
});
