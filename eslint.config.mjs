import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "test-results/**", "playwright-report/**"] },
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Browser-only values (clock, time zone, screen capture) are set after mount so server and client HTML match.
      "react-hooks/set-state-in-effect": "off",
      // Flags Date.now() in server components, which render once per request.
      "react-hooks/purity": "off",
      // The timer's key handler reads the latest state through a ref so it binds only once.
      "react-hooks/refs": "off",
    },
  },
];

export default config;
