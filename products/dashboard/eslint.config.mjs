import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "coverage/**"] },
  ...coreWebVitals,
  ...nextTypescript,
  {
    // react-hooks v7 (bundled with eslint-config-next 16) flags long-standing
    // dashboard patterns; treat as warnings until refactors land.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
];

export default eslintConfig;
