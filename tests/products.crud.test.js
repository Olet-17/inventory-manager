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
  // Clear MongoDB collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
});

describe("Products CRUD", () => {
  test("creates product (201), appears in list, then deletes", async () => {
    // Create product
    const create = await request(app)
      .post("/api/products")
      .send({
        sku: "SKU-1",
        name: "Widget",
        price: 9.99,
        cost: 5,
        quantity: 8,
      })
      .expect(201);

    const productId = create.body?._id ?? create.body?.product?._id;
    expect(productId).toBeTruthy();

    // Get product list
    const list = await request(app).get("/api/products").expect(200);

    // Handle different response formats
    let products;
    if (Array.isArray(list.body)) {
      products = list.body;
    } else if (list.body && list.body.products) {
      products = list.body.products;
    } else if (list.body) {
      products = [list.body];
    } else {
      products = [];
    }

    const names = products.map((p) => p && p.name).filter(Boolean);
    expect(names).toContain("Widget");

    // Delete product
    await request(app).delete(`/api/products/${productId}`).expect(200);

    // Verify product is gone
    const listAfter = await request(app).get("/api/products").expect(200);

    let productsAfter;
    if (Array.isArray(listAfter.body)) {
      productsAfter = listAfter.body;
    } else if (listAfter.body && listAfter.body.products) {
      productsAfter = listAfter.body.products;
    } else if (listAfter.body) {
      productsAfter = [listAfter.body];
    } else {
      productsAfter = [];
    }

    const namesAfter = productsAfter.map((p) => p && p.name).filter(Boolean);
    expect(namesAfter).not.toContain("Widget");
  });

  test("create fails with missing name (400)", async () => {
    const bad = await request(app).post("/api/products").send({ price: 10 }).expect(400);
    expect(bad.body.error).toMatch(/name/i);
  });

  test("delete non-existent product returns 404", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).delete(`/api/products/${fakeId}`).expect(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});
