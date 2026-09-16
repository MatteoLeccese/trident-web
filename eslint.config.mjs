import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import stylistic from "@stylistic/eslint-plugin";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { "@stylistic": stylistic },
    rules: {
      // ── General formatting ─────────────────────────────────────────────
      "@stylistic/semi": [ "error", "always", { omitLastInOneLineClassBody: true } ],
      "@stylistic/eol-last": [ "error", "always" ],
      "no-dupe-else-if": "error",
      "no-duplicate-imports": "error",
      "@stylistic/no-multiple-empty-lines": [ "error", { max: 2 } ],
      "@stylistic/no-trailing-spaces": [ "error", { skipBlankLines: false } ],
      "@stylistic/quotes": [ "error", "double", { allowTemplateLiterals: "always" } ],
      "@stylistic/arrow-spacing": [ "error", { before: true, after: true } ],
      "@stylistic/array-bracket-spacing": [ "error", "always" ],
      "@stylistic/no-multi-spaces": "error",
      "@stylistic/semi-spacing": [ "error", { before: false, after: true } ],
      "@stylistic/comma-spacing": [ "error", { before: false, after: true } ],
      "@stylistic/space-in-parens": [ "error", "never" ],
      "@stylistic/key-spacing": [ "error", { beforeColon: false, afterColon: true } ],
      "@stylistic/keyword-spacing": [ "error", { before: true, after: true } ],
      "@stylistic/space-before-function-paren": [ "error", "always" ],
      "@stylistic/block-spacing": [ "error", "always" ],
      "@stylistic/no-whitespace-before-property": "error",
      "@stylistic/wrap-regex": "error",
      "@stylistic/object-property-newline": [ "error", { allowAllPropertiesOnSameLine: true } ],

      // ── TypeScript ─────────────────────────────────────────────────────
      "@stylistic/object-curly-spacing": [ "error", "always" ],
      "@stylistic/lines-around-comment": [ "error", { beforeBlockComment: true } ],
      "@stylistic/lines-between-class-members": [ "error", "always" ],
      "@stylistic/indent": [ "error", 2 ],
      "@stylistic/space-infix-ops": "error",
      "@stylistic/function-call-spacing": [ "error", "never" ],
      // `overrides.arrow` con objeto está deprecado: se delega la flecha a
      // @stylistic/arrow-spacing (arriba, con espacios a ambos lados), que es
      // la intención original de code-style.md.
      "@stylistic/type-annotation-spacing": [ "error", {
        before: false,
        after: true,
        overrides: { arrow: "ignore" },
      } ],
      "@stylistic/member-delimiter-style": [ "error", {
        multiline: { delimiter: "semi", requireLast: true },
        singleline: { delimiter: "semi", requireLast: true },
        overrides: {
          interface: {
            multiline: { delimiter: "semi", requireLast: true },
            singleline: { delimiter: "semi", requireLast: true },
          },
        },
      } ],

      // ── JSX ────────────────────────────────────────────────────────────
      "@stylistic/jsx-quotes": [ "error", "prefer-double" ],
      "@stylistic/jsx-curly-brace-presence": [ "error", { props: "ignore", children: "ignore", propElementValues: "always" } ],
      "@stylistic/jsx-curly-spacing": [ "error", "never", { allowMultiline: true, spacing: { objectLiterals: "never" } } ],
      "@stylistic/jsx-equals-spacing": [ "error", "never" ],
      "@stylistic/jsx-pascal-case": "error",
      "@stylistic/jsx-closing-tag-location": "error",
      "@stylistic/jsx-curly-newline": [ "error", { multiline: "consistent", singleline: "consistent" } ],
      "@stylistic/jsx-first-prop-new-line": [ "error", "multiline-multiprop" ],
      "@stylistic/jsx-self-closing-comp": [ "error", { component: true, html: true } ],
      "@stylistic/jsx-tag-spacing": [ "error", { beforeSelfClosing: "always" } ],
      "@stylistic/jsx-wrap-multilines": [ "error", {
        declaration: "parens-new-line",
        assignment: "parens-new-line",
        return: "parens-new-line",
        arrow: "parens-new-line",
        condition: "parens-new-line",
        logical: "parens-new-line",
        prop: "parens-new-line",
        propertyValue: "parens",
      } ],
    },
  },
  globalIgnores([ ".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts" ]),
]);

export default eslintConfig;
