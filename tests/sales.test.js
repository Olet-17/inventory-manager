const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../server");

let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongo.stop();
});

test("POST /api/sales creates a sale", async () => {
  // 1) Register user - ✅ FIXED: Use correct auth endpoint
  await request(app)
    .post("/api/auth/register")
    .send({ username: "testuser", password: "testpass", role: "sales" })
    .expect(201);

  // 2) Get userId from users list
  const usersRes = await request(app).get("/api/users").expect(200);
  const user = usersRes.body.find((u) => u.username === "testuser") || usersRes.body[0];
  const userId = user?._id;
  expect(userId).toBeTruthy();

  // 3) Create product
  const prodRes = await request(app)
    .post("/api/products")
    .send({ sku: "SKU123", name: "Test", price: 10, cost: 5, quantity: 50 })
    .expect(201)
    .expect("Content-Type", /json/);

  const productId = prodRes.body?.product?._id ?? prodRes.body?._id;
  expect(productId).toBeTruthy();

  // 4) Create sale (201 Created is correct)
  const saleRes = await request(app)
    .post("/api/sales")
    .send({ productId, quantity: 2, soldBy: userId })
    .expect(201)
    .expect("Content-Type", /json/);

  // Support both single and multi-item responses
  const body = saleRes.body || {};
  const sale = body.sale ?? (Array.isArray(body.sales) ? body.sales[0] : null);
  expect(sale).toBeTruthy();

  // If product is populated object -> check name
  if (sale.product && typeof sale.product === "object") {
    expect(sale.product.name).toBe("Test");
  } else {
    // else product is just an id -> check id equality
    expect(String(sale.product)).toBe(String(productId));
  }

  expect(sale.quantity).toBe(2);
});
