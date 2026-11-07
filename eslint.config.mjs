import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "api/**",
    "public/maplibre-gl-worker.mjs",
    "next-env.d.ts",
    // Nested projects / generated artifacts
    "radar-mbg/**",
    "radar-mbg-web/**",
    "radar-mbg-backend/**",
    "trim_drivers.js",
    "*.js",
  ]),
]);

export default eslintConfig;
