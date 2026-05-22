// Flat ESLint config. Focused on real-bug rules (typescript-eslint recommended +
// react-hooks), not stylistic nits. Also enforces the architectural invariant
// that core/ stays filesystem-free (no fs / node: / @tauri-apps / React imports).
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "core/dist",
      "src-tauri",
      "node_modules",
      "src/test/stubs/**",
      "*.config.js",
      "*.config.ts",
    ],
  },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  // React UI: hook-rules + exhaustive deps (catches real hook bugs).
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  // core/ must stay pure: no filesystem, no Tauri, no React/DOM.
  {
    files: ["core/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "fs", message: "core/ is filesystem-free — inject bytes from the host layer." },
            { name: "path", message: "core/ is filesystem-free." },
            { name: "react", message: "core/ has no React/DOM." },
            { name: "react-dom", message: "core/ has no React/DOM." },
          ],
          patterns: ["node:*", "@tauri-apps/*"],
        },
      ],
    },
  },
  // Tests may use `any` for fixtures/mocks.
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
