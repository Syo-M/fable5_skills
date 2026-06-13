// Starter Stylelint config — copy to stylelint.config.mjs. Enforces the design-token
// rules from `css-modules` / `design-system`: themable properties must use var(), and
// raw z-index integers are banned outside tokens.css. Install the referenced plugins.
/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-declaration-strict-value'],
  rules: {
    // Require var() for themable properties — no raw hex/px for these in component modules
    'scale-unlimited/declaration-strict-value': [
      ['/color/', 'fill', 'stroke', 'z-index', 'box-shadow', 'transition-duration'],
      { ignoreValues: ['transparent', 'currentColor', 'inherit', 'none', 'initial', 'unset'] },
    ],
    // Ban arbitrary z-index integers (use the z-index token ladder)
    'declaration-property-value-disallowed-list': {
      'z-index': ['/^\\d+$/'],
    },
    // CSS Modules use camelCase class names (styles.primaryButton)
    'selector-class-pattern': ['^[a-z][a-zA-Z0-9]+$', { resolveNestedSelectors: true }],
  },
  // tokens.css defines the primitives/scale — exempt it from the var()-only rule
  overrides: [
    { files: ['**/tokens.css'], rules: { 'scale-unlimited/declaration-strict-value': null } },
  ],
};
