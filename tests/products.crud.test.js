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

describe("Products CRUD", () => {
  test("creates product (201), appears in list, then deletes", async () => {
    const create = await request(app)
      .post("/api/products")
      .send({ sku: "SKU-1", name: "Widget", price: 9.99, cost: 5, quantity: 8 })
      .expect(201);

    const productId = create.body?._id ?? create.body?.product?._id;
    expect(productId).toBeTruthy();

    const list = await request(app).get("/api/products").expect(200);
    const names = (Array.isArray(list.body) ? list.body : list.body.products).map((p) => p.name);
    expect(names).toContain("Widget");

    await request(app).delete(`/api/products/${productId}`).expect(200);

    const listAfter = await request(app).get("/api/products").expect(200);
    const namesAfter = (Array.isArray(listAfter.body) ? listAfter.body : listAfter.body.products).map(
      (p) => p.name,
    );
    expect(namesAfter).not.toContain("Widget");
  });

  test("create fails with missing name (400)", async () => {
    const bad = await request(app)
      .post("/api/products")
      .send({ price: 10 })
      .expect(400);
    expect(bad.body.error).toMatch(/name/i);
  });

  test("delete non-existent product returns 404", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).delete(`/api/products/${fakeId}`).expect(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});
