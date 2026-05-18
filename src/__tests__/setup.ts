import { vi, afterEach } from "vitest";

/**
 * Centralize the console.warn spy so every test file gets it automatically.
 * This avoids noisy warning output during test runs.
 */
vi.spyOn(console, "warn").mockImplementation(() => {});

/**
 * Env var isolation: save and restore DASHSCOPE_API_KEY around each test.
 */
const _savedApiKey = process.env.DASHSCOPE_API_KEY;

afterEach(() => {
  if (_savedApiKey === undefined) {
    delete process.env.DASHSCOPE_API_KEY;
  } else {
    process.env.DASHSCOPE_API_KEY = _savedApiKey;
  }
});
