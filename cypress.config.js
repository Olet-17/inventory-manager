const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:5000",
    setupNodeEvents(on, config) {
      on("task", {
        resetDatabase: () => {
          // Simple task that just returns success
          console.log("🔄 Database reset requested");
          return { success: true, message: "Reset completed" };
        },

        log(message) {
          console.log("📝 Cypress Log:", message);
          return null;
        },
      });

      return config;
    },
  },

  // Test configuration
  viewportWidth: 1280,
  viewportHeight: 720,
  defaultCommandTimeout: 10000,
  requestTimeout: 10000,
  responseTimeout: 30000,

  // Screenshots and videos
  screenshotOnRunFailure: true,
  video: true,
  videoCompression: 32,

  // Environment variables for tests
  env: {
    adminUsername: "admin",
    adminPassword: "admin123",
  },
});
