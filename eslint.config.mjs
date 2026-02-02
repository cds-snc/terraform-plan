import js from "@eslint/js";
import security from "eslint-plugin-security";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  {
    files: ["src/**/*.js", "test/**/*.js"],
    plugins: {
      security,
    },
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...security.configs.recommended.rules,
    },
  },
  {
    files: ["src/**/*.js", "test/**/*.js"],
    ...prettier,
  },
];
