// cypress/e2e/rbac-products.cy.js
describe("RBAC on Products Page", () => {
  const LOGIN_URL = "http://localhost:5000/html/login.html";
  const PRODUCTS_URL = "http://localhost:5000/html/products.html";

  const loginAsAdminUI = () => {
    cy.visit(LOGIN_URL);
    cy.document().its("readyState").should("eq", "complete");
    cy.title().should("include", "Login"); // sanity

    cy.get('input[type="text"], input[name="username"]').first().type("admin");
    cy.get('input[type="password"], input[name="password"]').first().type("admin123");
    cy.get('button[type="submit"], input[type="submit"]').first().click();

    // after login your app may redirect (dashboard/sales/etc.). Just ensure we left login.
    cy.url().should("not.include", "/html/login.html");
  };

  beforeEach(() => {
    cy.request("POST", "http://localhost:5000/api/test/reset").its("status").should("eq", 200);
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it("unauthenticated user is redirected to Login when visiting Products", () => {
    cy.visit(PRODUCTS_URL);
    cy.document().its("readyState").should("eq", "complete");
    cy.title().should("include", "Login"); // you saw “Login – Inventory System”
  });

  it("admin can access Products and create a product", () => {
    // 1) Login first (server sets whatever session/cookie it needs)
    loginAsAdminUI();

    // 2) Now open Products page (should be allowed)
    cy.visit(PRODUCTS_URL);
    cy.document().its("readyState").should("eq", "complete");

    // Section + form should be visible to admin
    cy.get("#productSection").should("exist").and("be.visible");
    cy.get("#productForm").should("exist").and("be.visible");

    // 3) Create product (use name for later assertion; price = 19)
    const name = `RBAC Test Product ${Date.now()}`;
    const sku = `RBAC-${Date.now()}`;

    cy.get("#name").type(name);
    cy.get("#sku").type(sku);
    cy.get("#price").type("19");
    cy.get("#quantity").type("10");
    cy.get('#productForm button[type="submit"]').click();

    // Message appears (don’t rely on specific color)
    cy.get("#message", { timeout: 10000 })
      .should("be.visible")
      .invoke("text")
      .then((t) => expect(t.trim().length).to.be.greaterThan(0));

    // 4) Many apps repopulate table on load => reload, then check table by NAME (not SKU)
    cy.reload();
    cy.get("#productTable tbody", { timeout: 10000 }).should("exist");
    cy.contains("#productTable tbody", name, { timeout: 10000 }).should("exist");
  });
});
