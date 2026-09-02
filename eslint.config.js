// eslint.config.js — Security-first flat config for the Rekuway Auth monorepo.
// Rule of thumb from the project spec: never blanket-disable security rules
// just to make the build pass. Document exceptions locally with a comment.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";
import importPlugin from "eslint-plugin-import";
import unicorn from "eslint-plugin-unicorn";
import promise from "eslint-plugin-promise";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/node_modules/**",
      "apps/mobile/node_modules/**",
      "apps/web/node_modules/**",
      "apps/api/node_modules/**",
      "**/next-env.d.ts",
      "**/.expo/**",
      "**/coverage/**",
      "**/*.config.js",
      "**/generated/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      security,
      import: importPlugin,
      unicorn,
      promise
    },
    rules: {
      // --- Security-critical ---
      "security/detect-object-injection": "warn",
      "security/detect-non-literal-regexp": "error",
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-possible-timing-attacks": "warn",
      "security/detect-eval-with-expression": "error",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-new-buffer": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",

      // --- TypeScript strictness ---
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-floating-promises": "error",
      // Fastify (and many other frameworks) idiomatically accept async
      // functions in positions typed to return `void` — as direct handler
      // arguments (app.get(path, handler)) AND as object properties (e.g.
      // { preHandler: someAsyncFn }). The framework awaits them correctly
      // either way. Disabling only these two checks (not the whole rule)
      // keeps real misuse — e.g. an async function assigned to a plain
      // variable expected to be synchronous with no promise handling —
      // caught everywhere else.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { arguments: false, properties: false } }
      ],
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/consistent-type-imports": "error",

      // --- Promises / async ---
      "promise/no-return-in-finally": "error",
      "promise/always-return": "off",

      // --- Import hygiene ---
      "import/no-cycle": "error",
      "import/no-self-import": "error",

      // --- Dead / unsafe code ---
      "unicorn/no-process-exit": "error",
      "unicorn/no-unsafe-regex": "off",
      "unicorn/prefer-node-protocol": "error",
      "no-var": "error",
      "prefer-const": "error"
    }
  },
  {
    // Tests may use relaxed assertions for readability, and are excluded
    // from type-aware linting below via disableTypeChecked (they aren't
    // part of any app's src/ tsconfig "include", so the parser's project
    // service can't resolve them for typed rules).
    files: ["**/*.test.ts", "**/test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off"
    }
  },
  {
    // Config/build files and test files aren't included in any app's
    // tsconfig "include" (which is scoped to "src" for correct rootDir/
    // outDir behavior), so type-aware rules can't run on them. Lint them
    // with the syntax-only rule set instead of failing to parse.
    files: [
      "**/*.test.ts",
      "**/test/**/*.ts",
      "**/vitest.config.ts",
      "**/next.config.js",
      "eslint.config.js"
    ],
    ...tseslint.configs.disableTypeChecked
  }
);