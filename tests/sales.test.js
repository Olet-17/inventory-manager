const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Mock PostgreSQL before importing app
jest.mock("../db/sql", () => ({
  sqlPool: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn(),
    end: jest.fn(),
  },
  initializeTables: jest.fn(),
}));

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

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
});

test("POST /api/sales creates a sale", async () => {
  // Create product directly
  const prodRes = await request(app)
    .post("/api/products")
    .send({ sku: "SKU123", name: "Test", price: 10, cost: 5, quantity: 50 })
    .expect(201);

  const productId = prodRes.body?._id ?? prodRes.body?.product?._id;
  expect(productId).toBeTruthy();

  // Create sale with items array format (not single product)
  const saleRes = await request(app)
    .post("/api/sales")
    .send({
      items: [{ productId, quantity: 2 }],
      soldBy: 1, // Use mock user ID
    })
    .expect(201);

  // Check sale was created
  const body = saleRes.body || {};
  const sale = body.sale ?? (Array.isArray(body.sales) ? body.sales[0] : body);
  expect(sale).toBeTruthy();
});
