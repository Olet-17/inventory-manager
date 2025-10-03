// cypress/e2e/debug-page.cy.js
describe("Debug Page Structure", () => {
  it("should show me what the login page looks like", () => {
    cy.visit("/html/login.html");

    // Wait for page to load
    cy.wait(2000);

    // Take a screenshot
    cy.screenshot("debug-login-page");

    // Log all input elements
    cy.get("input").each(($input, index) => {
      const name = $input.attr("name");
      const type = $input.attr("type");
      const placeholder = $input.attr("placeholder");
      const id = $input.attr("id");

      console.log(`Input ${index}:`, { name, type, placeholder, id });
    });

    // Log all button elements
    cy.get('button, input[type="submit"]').each(($btn, index) => {
      const text = $btn.text();
      const type = $btn.attr("type");

      console.log(`Button ${index}:`, { text, type });
    });

    // Log page HTML for deep inspection
    cy.document().then((doc) => {
      console.log("Full page HTML:", doc.documentElement.outerHTML);
    });
  });
});
