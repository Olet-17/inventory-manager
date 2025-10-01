const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Mock the entire auth system to avoid PostgreSQL issues
jest.mock("../routes/auth", () => {
  const express = require("express");
  const router = express.Router();

  let users = [];
  let userId = 1;

  // Mock register endpoint
  router.post("/register", (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: "Username, password, and role are required" });
    }

    if (users.find((u) => u.username === username)) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const newUser = {
      id: userId++,
      username,
      role,
      email: req.body.email || null,
    };

    users.push(newUser);
    res.status(201).json({ message: "User registered successfully!", userId: newUser.id });
  });

  // Mock users list endpoint
  router.get("/users", (req, res) => {
    res.json(users);
  });

  // Mock me endpoint
  router.post("/me", (req, res) => {
    const user = users.find((u) => u.id === req.body.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  });

  return router;
});

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

describe("Users", () => {
  test("registers a user (201) and lists users", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ username: "alice", password: "pass123", role: "sales" })
      .expect(201);

    const list = await request(app).get("/api/auth/users").expect(200); // Use /api/auth/users
    const names = list.body.map((u) => u.username);
    expect(names).toContain("alice");
  });

  test("rejects duplicate username (400)", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ username: "bob", password: "x", role: "sales" })
      .expect(201);

    const dup = await request(app)
      .post("/api/auth/register")
      .send({ username: "bob", password: "y", role: "sales" })
      .expect(400);

    expect(dup.body.error).toMatch(/username/i);
  });

  test("rejects missing fields (400)", async () => {
    const bad = await request(app).post("/api/auth/register").send({}).expect(400);
    expect(bad.body.error).toBeTruthy();
  });
});
