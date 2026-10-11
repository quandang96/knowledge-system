import js from '@eslint/js'
import ts from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
export default ts.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.cache/**', '**/.vitepress/cache/**', '**/.vitepress/.temp/**'] },
  js.configs.recommended, ...ts.configs.recommended, ...vue.configs['flat/recommended'],
  { files: ['**/*.{ts,vue,js}'], languageOptions: { globals: { ...globals.browser, ...globals.node }, parserOptions: { parser: ts.parser } }, rules: {
    'vue/multi-word-component-names': 'off', 'vue/html-self-closing': 'off',
    'vue/max-attributes-per-line': 'off', 'vue/html-indent': 'off',
    'vue/singleline-html-element-content-newline': 'off', 'vue/html-closing-bracket-newline': 'off',
    'vue/first-attribute-linebreak': 'off', 'vue/attributes-order': 'off',
    'vue/html-closing-bracket-spacing': 'off', 'vue/multiline-html-element-content-newline': 'off',
    '@typescript-eslint/no-explicit-any': 'off'
  } }
)
