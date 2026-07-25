import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom doesn't implement ResizeObserver — components that use it
// (ScrollFadeX) would otherwise throw "ResizeObserver is not defined" the
// moment they mount in any test, even ones that have nothing to do with
// scrolling. A no-op stand-in is enough: tests that care about scroll-fade
// behavior specifically should drive canScrollLeft/Right through the
// element's scroll event instead of relying on real resize detection.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver = ResizeObserverStub;

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
