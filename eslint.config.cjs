const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  js.configs.recommended,

  // --- Node / server files ---
  {
    files: [
      "server.js",
      "routes/**",
      "models/**",
      "db/**", // ← Add this
      "scripts/**", // ← Add this
      "*.config.cjs",
      "*.config.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      quotes: ["warn", "double"], // Your config uses double quotes
      semi: ["error", "always"],
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^(transporter|buildCsvBuffer|PDFDocument|Product|User|escapeRegExp)$",
        },
      ],
    },
  },

  // --- Browser / client files (public/) ---
  {
    files: ["public/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        Chart: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "no-empty": "off",
      "no-unused-vars": "off",
    },
  },

  // --- Jest tests ---
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": "warn", // Change to warn for tests
    },
  },
];
