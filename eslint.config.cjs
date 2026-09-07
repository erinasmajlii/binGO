// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // eslint-config-expo bundles the React Compiler readiness rules. This
    // project does not use React Compiler, and these rules false-positive
    // heavily on standard React Native patterns used throughout the app
    // (e.g. `useRef(new Animated.Value(0)).current`, which is the
    // documented, idiomatic way to create a stable Animated.Value).
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
]);
