import nextConfig from "eslint-config-next";

const config = [...nextConfig];

// This project intentionally mutates ref-backed simulation/render state (e.g. particle systems),
// and uses effects that may set state as part of UI orchestration. The additional "react-hooks/*"
// rules shipped by our current config are too strict for this architecture and cause lint to fail.
config.push({
  rules: {
    "react-hooks/immutability": "off",
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/refs": "off",
  },
});

export default config;
