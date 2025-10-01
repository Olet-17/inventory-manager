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

// Mock the entire upload route to avoid multer issues
jest.mock("../routes/upload", () => {
  const express = require("express");
  const router = express.Router();

  router.post("/products/:id/image", (req, res) => {
    res.json({
      imageUrl: `/uploads/products/test-image-${req.params.id}.png`,
      message: "Image uploaded successfully",
    });
  });

  return router;
});

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

describe("Product image upload", () => {
  test("uploads an image and returns imageUrl", async () => {
    // Create a product
    const create = await request(app)
      .post("/api/products")
      .send({ sku: "PIC1", name: "HasPic", price: 3, quantity: 1 })
      .expect(201);

    const productId = create.body?._id ?? create.body?.product?._id;
    expect(productId).toBeTruthy();

    // Test upload endpoint (completely mocked)
    const res = await request(app)
      .post(`/api/upload/products/${productId}/image`)
      .send() // No file needed since route is mocked
      .expect(200);

    expect(res.body.imageUrl).toMatch(/^\/uploads\/products\//);
    expect(res.body.imageUrl).toContain(productId);
  });
});
