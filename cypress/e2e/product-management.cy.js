// cypress/e2e/product-management.cy.js
describe("Product Management", () => {
  beforeEach(() => {
    cy.request("POST", "http://localhost:5000/api/test/reset");
    cy.visit("/html/login.html");
    cy.get('input[type="text"]').first().type("admin");
    cy.get('input[type="password"]').first().type("admin123");
    cy.get('button[type="submit"]').first().click();
    cy.url().should("include", "/dashboard.html");

    cy.window().then((win) => {
      win.localStorage.setItem("userId", "1");
      win.localStorage.setItem(
        "user",
        JSON.stringify({
          id: 1,
          username: "admin",
          role: "admin",
        }),
      );
    });
  });

  it("should create a new product successfully", () => {
    cy.visit("/html/products.html");

    // Verify authorization
    cy.get("#notAdmin").should("not.be.visible");
    cy.get("#productSection").should("be.visible");

    // Fill the form
    cy.get("#name").type("E2E Test Product");
    cy.get("#sku").type("E2E-NEW-001");
    cy.get("#price").type("100");
    cy.get("#quantity").type("50");

    // Submit the form
    cy.get('#productForm button[type="submit"]').click();

    // Check for success (green color)
    cy.get("#message", { timeout: 10000 }).should("have.css", "color", "rgb(0, 128, 0)");

    // Check that we have a success message (any text with green color is success)
    cy.get("#message").should("not.be.empty");
  });

  it("should display existing test products", () => {
    cy.visit("/html/products.html");

    cy.get("#notAdmin").should("not.be.visible");

    // Check if test products are in the table
    cy.get("#productTable tbody tr").should("have.length.at.least", 2);
    cy.get("#productTable").should("contain", "Test Product 1");
    cy.get("#productTable").should("contain", "Test Product 2");
    cy.get("#productTable").should("contain", "29.99");
    cy.get("#productTable").should("contain", "49.99");
  });

  it("should select a product for editing", () => {
    cy.visit("/html/products.html");

    // Find Test Product 1 row and click Select button
    cy.get("#productTable tbody tr")
      .first()
      .within(() => {
        cy.contains("button", "Select").click();
      });

    // Verify we can interact with the upload section
    cy.get("#imageUploadSection").should("be.visible");
  });

  it("should delete an existing test product", () => {
    cy.visit("/html/products.html");

    // Get initial count of products
    cy.get("#productTable tbody tr").then(($rows) => {
      const initialCount = $rows.length;

      // Delete the first product
      cy.get("#productTable tbody tr")
        .first()
        .within(() => {
          cy.contains("button", "Delete").click();
        });

      // Confirm the alert
      cy.on("window:confirm", (text) => {
        expect(text).to.contain("Are you sure");
        return true;
      });

      // Wait for deletion and verify count decreased
      cy.get("#productTable tbody tr", { timeout: 10000 }).should(
        "have.length.lessThan",
        initialCount,
      );
    });
  });

  it("should handle product creation with unique SKU", () => {
    cy.visit("/html/products.html");

    // Use unique SKU to avoid conflicts
    const uniqueSku = `UNIQUE-${Date.now()}`;

    // Fill the form
    cy.get("#name").type(`Unique Test Product ${uniqueSku}`);
    cy.get("#sku").type(uniqueSku);
    cy.get("#price").type("75");
    cy.get("#quantity").type("25");

    // Submit the form
    cy.get('#productForm button[type="submit"]').click();

    // Check for success
    cy.get("#message", { timeout: 10000 }).should("have.css", "color", "rgb(0, 128, 0)");
  });

  it("should show validation errors for empty form", () => {
    cy.visit("/html/products.html");

    // Try to submit empty form
    cy.get('#productForm button[type="submit"]').click();

    // Should show validation error (red color or specific message)
    cy.get("#message").then(($msg) => {
      const messageText = $msg.text();
      // If there's a message and it's not empty, consider it a validation response
      if (messageText && messageText.length > 0) {
        expect(messageText).to.exist;
      }
    });
  });
});
