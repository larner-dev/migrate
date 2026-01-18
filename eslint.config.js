import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
  {
    ignores: ["build/**/*", "dist/**/*", "node_modules/**/*"],
  }
);
