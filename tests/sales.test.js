const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../server"); // <-- OK now: it exports the app, not a listening server

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
  // create user
  await request(app)
    .post("/api/register")
    .send({ username: "testuser", password: "testpass", role: "sales" })
    .expect(201);

  // get user id
  const userList = await request(app).get("/api/users").expect(200);
  const userId = userList.body[0]._id;

  // create product
  const product = await request(app)
    .post("/api/products")
    .send({ sku: "SKU123", name: "Test", price: 10, cost: 5, quantity: 50 })
    .expect(201);

  // create sale
  const sale = await request(app)
    .post("/api/sales")
    .send({ productId: product.body._id, quantity: 2, soldBy: userId })
    .expect(200);

  expect(sale.body.sale.product.name).toBe("Test");
});
