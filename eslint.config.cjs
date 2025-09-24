// eslint.config.cjs
const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  js.configs.recommended,

  // --- Node / server files ---
  {
    files: [
      "server.js",
      "routes/**",
      "*.config.cjs",
      "*.config.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node, // require, module, __dirname, process, Buffer, console, etc.
      },
    },
    rules: {
      // keep style rules light to reduce churn
      quotes: ["warn", "double"],
      semi: ["error", "always"],
      
      // allow unused placeholders like (err, _next) without failing CI
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^(transporter|buildCsvBuffer)$" }],
    },
  },

  // --- Browser / client files (public/) ---
  {
    files: ["public/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,     // window, document, fetch, URLSearchParams, setTimeout, etc.
        Chart: "readonly",      // Chart.js global from CDN
      },
    },
    rules: {
      "no-console": "off",
      "no-empty": "off",
      "no-unused-vars": "off",  // front-end helpers/handlers often trip this
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
        ...globals.jest,        // describe, test, expect, beforeAll, afterAll...
      },
    },
    rules: {
      "no-console": "off",
    },
  },
];
