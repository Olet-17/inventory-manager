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

describe("Users", () => {
  test("registers a user (201) and lists users", async () => {
    const reg = await request(app)
      .post("/api/register")
      .send({ username: "alice", password: "pass123", role: "sales" })
      .expect(201);

    // list
    const list = await request(app).get("/api/users").expect(200);
    const names = list.body.map((u) => u.username);
    expect(names).toContain("alice");
  });

  test("rejects duplicate username (400)", async () => {
    await request(app)
      .post("/api/register")
      .send({ username: "bob", password: "x", role: "sales" })
      .expect(201);

    const dup = await request(app)
      .post("/api/register")
      .send({ username: "bob", password: "y", role: "sales" })
      .expect(400);

    expect(dup.body.error).toMatch(/username/i);
  });

  test("rejects missing fields (400)", async () => {
    const bad = await request(app).post("/api/register").send({}).expect(400);
    expect(bad.body.error).toBeTruthy();
  });
});
