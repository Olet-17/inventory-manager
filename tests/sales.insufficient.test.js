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

async function ensureSeller(username = "seller-x") {
  // ✅ FIXED: Use correct auth endpoint
  await request(app)
    .post("/api/auth/register")
    .send({ username, password: "p", role: "sales" })
    .expect(201);

  const users = await request(app).get("/api/users").expect(200);
  return users.body.find((u) => u.username === username)._id;
}

describe("Sales - insufficient stock", () => {
  test("returns 400 if requested qty > stock", async () => {
    const soldBy = await ensureSeller();

    const prod = await request(app)
      .post("/api/products")
      .send({ sku: "SKU-LOW", name: "LowStock", price: 10, cost: 5, quantity: 2 })
      .expect(201);

    const productId = prod.body?._id ?? prod.body?.product?._id;

    const bad = await request(app)
      .post("/api/sales")
      .send({ productId, quantity: 5, soldBy })
      .expect(400);

    expect(bad.body.error).toMatch(/not enough stock/i);
  });
});
