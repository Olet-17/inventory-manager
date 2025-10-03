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
      "db/**",
      "scripts/**",
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
      quotes: ["warn", "double"],
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

  // --- Cypress tests ---
  {
    files: ["cypress/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.mocha, // Adds describe, it, beforeEach, etc.
        cy: "readonly",
        Cypress: "readonly",
        expect: "readonly",
        assert: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": "warn",
      quotes: ["warn", "double"],
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
    },
  },
];
