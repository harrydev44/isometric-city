import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    rules: {
      // This codebase intentionally mutates objects stored in refs for performance (canvas simulation systems).
      // The React Compiler-oriented immutability rules flag these patterns, so disable them.
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
];

export default config;
