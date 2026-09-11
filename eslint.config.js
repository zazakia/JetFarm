// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/*",
      "tmp/*",
      ".expo/*",
      "coverage/*",
      "web-build/*",
      "node_modules/*",
    ],
  },
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react/no-children-prop": "off",
      "import/no-unresolved": "off",
      "import/namespace": "off",
      "import/no-named-as-default": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-useless-constructor": "off",
      "react-hooks/exhaustive-deps": "off",
      "import/no-duplicates": "off",
      "import/first": "off",
      "unicode-bom": "off",
      "@typescript-eslint/array-type": "off"
    },
  },
  {
    files: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "import/no-named-as-default": "off",
    }
  }
]);

