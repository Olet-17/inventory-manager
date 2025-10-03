// cypress/e2e/simple-test.cy.js
describe("Inventory System E2E Tests", () => {
  beforeEach(() => {
    // Reset database before each test
    cy.request("POST", "http://localhost:5000/api/test/reset").its("status").should("eq", 200);
  });

  it("should load the login page", () => {
    // Visit the actual login page directly
    cy.visit("/html/login.html");

    // Check if we're on the login page
    cy.url().should("include", "/html/login.html");

    // Look for login form elements with more flexible selectors
    cy.get("body").then(($body) => {
      // Take a screenshot to see what's actually on the page
      cy.screenshot("login-page-actual");

      // Debug: log the page content
      console.log("Page content:", $body.text());
    });

    // Try different possible selectors for the login form
    cy.get(
      'input[type="text"], input[name="username"], input[placeholder*="username" i], input[placeholder*="user" i]',
    ).should("be.visible");
    cy.get(
      'input[type="password"], input[name="password"], input[placeholder*="password" i]',
    ).should("be.visible");
    cy.get(
      'button[type="submit"], input[type="submit"], button:contains("Login"), button:contains("Sign In")',
    ).should("be.visible");
  });

  it("should login with test admin credentials", () => {
    cy.visit("/html/login.html");

    // Use more flexible selectors
    cy.get('input[type="text"], input[name="username"], input[placeholder*="username" i]')
      .first()
      .type("admin");
    cy.get('input[type="password"], input[name="password"], input[placeholder*="password" i]')
      .first()
      .type("admin123");
    cy.get('button[type="submit"], input[type="submit"], button:contains("Login")').first().click();

    // Check for successful login - might redirect to dashboard or sales page
    cy.url().should("not.include", "/html/login.html"); // Should redirect away from login

    // Wait a bit for any redirects
    cy.wait(2000);

    // Take screenshot to see where we ended up
    cy.screenshot("after-login");
  });

  it("should test health check endpoint", () => {
    cy.request("GET", "http://localhost:5000/api/test/health").then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.status).to.eq("healthy");
      expect(response.body.environment).to.be.oneOf(["development", "test"]);
    });
  });

  it("should verify test data was created", () => {
    // Test that our reset endpoint actually created test data
    cy.request("POST", "http://localhost:5000/api/auth/login", {
      username: "admin",
      password: "admin123",
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property("success", true);
    });
  });
});
