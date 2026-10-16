import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

const D = String.fromCharCode(45);

export default tseslint.config(
  {
    ignores: ["dist/**", "node" + D + "modules/**", "docs/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["tools/**/*.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    rules: {
      [`@typescript${D}eslint${D}no${D}non${D}null${D}assertion`]: "off",
      [`prefer${D}const`]: "error",
      [`no${D}var`]: "error",
    },
  },
);
