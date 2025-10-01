const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Mock PostgreSQL
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

// Simplified helpers without auth dependencies
async function createProduct({ sku, name, price, cost = 0, quantity }) {
  const res = await request(app)
    .post("/api/products")
    .send({ sku, name, price, cost, quantity })
    .expect(201);
  return res.body?.product?._id ?? res.body?._id;
}

async function getProduct(id) {
  const res = await request(app).get("/api/products").expect(200);
  const list = Array.isArray(res.body) ? res.body : res.body.products || [];
  return list.find((p) => String(p._id) === String(id));
}

describe("POST /api/sales (multi-item)", () => {
  test("creates a sale with multiple items and decrements stock", async () => {
    // create products
    const p1 = await createProduct({ sku: "SKU-A", name: "Apple", price: 3, quantity: 10 });
    const p2 = await createProduct({ sku: "SKU-B", name: "Banana", price: 2, quantity: 7 });

    // submit multi-item sale
    await request(app)
      .post("/api/sales")
      .send({
        soldBy: 1, // Mock user ID
        items: [
          { productId: p1, quantity: 3 },
          { productId: p2, quantity: 2 },
        ],
      })
      .expect(201);

    // verify quantities updated
    const p1After = await getProduct(p1);
    const p2After = await getProduct(p2);
    expect(p1After.quantity).toBe(7); // 10 - 3
    expect(p2After.quantity).toBe(5); // 7 - 2
  });
});
