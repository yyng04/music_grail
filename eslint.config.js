import { readFileSync } from "node:fs";
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import { reactRefresh } from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

// Also skip anything git ignores locally (.git/info/exclude), as Prettier does.
function localExcludes() {
  try {
    return readFileSync(".git/info/exclude", "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => (line.endsWith("/") ? `${line}**` : line));
  } catch {
    return [];
  }
}

export default defineConfig([
  globalIgnores([
    "dist",
    "test-results",
    "playwright-report",
    ...localExcludes(),
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite(),
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/theory/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "tonal", message: "Only src/theory/ imports tonal." },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  prettier,
]);
