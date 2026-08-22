import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ["app/dashboard/**/*.tsx"],
    rules: {
      // These server pages intentionally render migration guidance when their
      // data loader fails. The JSX is not expected to catch render-time errors.
      "react-hooks/error-boundaries": "off",
    },
  },
  {
    files: ["components/assignments/assignment-notification-bell.tsx"],
    rules: {
      // Initial network synchronization belongs in the mount effect.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),
]);
