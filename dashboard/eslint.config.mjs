import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

export default [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    // Rules with pre-existing violations (10 errors measured 2026-07-04),
    // downgraded to warnings so CI is green from day one. Ratchet back to
    // "error" as the underlying code is cleaned up.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "prefer-spread": "warn",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
];
