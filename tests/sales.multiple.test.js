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

// helpers
async function createUser(username = "seller1") {
  // ✅ FIXED: Use correct auth endpoint
  await request(app)
    .post("/api/auth/register")
    .send({ username, password: "pass123", role: "sales" })
    .expect(201);
  const usersRes = await request(app).get("/api/users").expect(200);
  const u = usersRes.body.find((x) => x.username === username) || usersRes.body[0];
  return u?._id;
}

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
    const userId = await createUser("seller-multi");

    // create products
    const p1 = await createProduct({ sku: "SKU-A", name: "Apple", price: 3, quantity: 10 });
    const p2 = await createProduct({ sku: "SKU-B", name: "Banana", price: 2, quantity: 7 });

    // submit multi-item sale
    const saleRes = await request(app)
      .post("/api/sales")
      .send({
        soldBy: userId,
        items: [
          { productId: p1, quantity: 3 },
          { productId: p2, quantity: 2 },
        ],
      })
      .expect(201)
      .expect("Content-Type", /json/);

    // response shape: either { sale } or { sales: [...] } – handle both
    const body = saleRes.body || {};
    const sales = body.sales || (body.sale ? [body.sale] : []);
    expect(Array.isArray(sales) && sales.length >= 1).toBe(true);

    // verify line items (populated or not)
    const productIdsInResponse = sales.map((s) =>
      typeof s.product === "object" ? String(s.product._id) : String(s.product),
    );
    expect(productIdsInResponse).toEqual(expect.arrayContaining([String(p1), String(p2)]));

    // verify quantities updated
    const p1After = await getProduct(p1);
    const p2After = await getProduct(p2);
    expect(p1After.quantity).toBe(10 - 3);
    expect(p2After.quantity).toBe(7 - 2);
  });

  test("fails when any item has insufficient stock (no partial update)", async () => {
    const userId = await createUser("seller-insufficient");

    const p1 = await createProduct({ sku: "SKU-C", name: "Cookie", price: 4, quantity: 2 });
    const p2 = await createProduct({ sku: "SKU-D", name: "Donut", price: 5, quantity: 5 });

    const bad = await request(app)
      .post("/api/sales")
      .send({
        soldBy: userId,
        items: [
          { productId: p1, quantity: 3 }, // exceeds stock
          { productId: p2, quantity: 1 },
        ],
      })
      .expect(400); // your route returns 400 for validation like "Not enough stock"

    expect(bad.body.error).toBeTruthy();

    // verify no stock changed (since request should fail entirely)
    const p1After = await getProduct(p1);
    const p2After = await getProduct(p2);
    expect(p1After.quantity).toBe(2);
    expect(p2After.quantity).toBe(5);
  });

  test("merges duplicate product lines (same product twice)", async () => {
    const userId = await createUser("seller-merge");

    const p1 = await createProduct({ sku: "SKU-E", name: "Eggs", price: 1.5, quantity: 10 });

    const res = await request(app)
      .post("/api/sales")
      .send({
        soldBy: userId,
        items: [
          { productId: p1, quantity: 2 },
          { productId: p1, quantity: 3 }, // same product again
        ],
      })
      .expect(201);

    // stock should decrement by total (2+3=5)
    const p1After = await getProduct(p1);
    expect(p1After.quantity).toBe(10 - 5);

    // response sanity
    const body = res.body || {};
    const sales = body.sales || (body.sale ? [body.sale] : []);
    expect(sales.length >= 1).toBe(true);
  });
});