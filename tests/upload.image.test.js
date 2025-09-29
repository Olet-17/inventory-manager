const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../server");
const path = require("path");
const fs = require("fs");

let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => {
  await mongoose.connection.close();
  await mongo.stop();
});

// small helper to create a tiny PNG file in mem (not a real image, but good enough for multer path)
function getTempPngPath() {
  const p = path.join(__dirname, "tmp-test.png");
  fs.writeFileSync(p, Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG signature bytes
  return p;
}

describe("Product image upload", () => {
  test("uploads an image and returns imageUrl", async () => {
    const create = await request(app)
      .post("/api/products")
      .send({ sku: "PIC1", name: "HasPic", price: 3, quantity: 1 })
      .expect(201);

    const productId = create.body?._id ?? create.body?.product?._id;

    const imgPath = getTempPngPath();
    const res = await request(app)
      .post(`/api/upload/products/${productId}/image`) // ✅ FIXED: Use correct upload endpoint
      .attach("image", imgPath) // field name must be "image"
      .expect(200);

    expect(res.body.imageUrl).toMatch(/^\/uploads\/products\//);

    fs.unlinkSync(imgPath);
  });
});