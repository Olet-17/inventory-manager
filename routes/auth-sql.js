const express = require("express");
const bcrypt = require("bcryptjs");
const { sqlPool } = require("../db/sql");
const router = express.Router();

/* ------------------------------- Security knobs ------------------------------- */
const BCRYPT_ROUNDS =
  Number(process.env.BCRYPT_ROUNDS) || (process.env.NODE_ENV === "production" ? 12 : 10);

/* --------------------------------- Validation --------------------------------- */
const Joi = require("joi");

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).trim().required(),
  password: Joi.string().min(8).max(128).required(),
  role: Joi.string().valid("admin", "sales").default("sales"),
  email: Joi.string().email().allow(null, "").optional(),
});

const loginSchema = Joi.object({
  username: Joi.string().trim().required(),
  password: Joi.string().required(),
});

const roleUpdateSchema = Joi.object({
  role: Joi.string().valid("admin", "sales").required(),
});

const idParamSchema = Joi.object({
  id: Joi.number().integer().min(1).required(),
});

function validateBody(schema) {
  return (req, res, next) => {
    const { value, error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: error.details.map((d) => d.message) });
    }
    req.body = value;
    next();
  };
}

function validateParams(schema) {
  return (req, res, next) => {
    const { value, error } = schema.validate(req.params, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res
        .status(400)
        .json({ error: "Invalid parameters", details: error.details.map((d) => d.message) });
    }
    req.params = value;
    next();
  };
}

/* --------------------------------- AuthZ --------------------------------- */
function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.session.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

/* -------------------------------- Helpers -------------------------------- */

function toPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    email: row.email,
    created_at: row.created_at,
    last_login: row.last_login,
  };
}

async function createUser({ username, password, role = "sales", email = null }) {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const result = await sqlPool.query(
    `INSERT INTO users (username, password_hash, role, email, created_at)
     VALUES ($1, $2, COALESCE($3,'sales'), $4, NOW())
     RETURNING id, username, role, email, created_at`,
    [username.trim(), hash, role?.trim() || "sales", email?.trim() || null],
  );
  return result.rows[0];
}

/* -------------------------------- Register -------------------------------- */
/* New clean endpoint used by the frontend: POST /api/auth-sql/register */
router.post("/register", validateBody(registerSchema), async (req, res) => {
  try {
    const { username, password, role, email } = req.body;

    const exists = await sqlPool.query("SELECT 1 FROM users WHERE username = $1", [username]);
    if (exists.rows.length) return res.status(400).json({ error: "Username already exists" });

    const user = await createUser({ username, password, role, email });

    // Optional: auto-login after signup
    if (req.session) req.session.user = { id: user.id, username: user.username, role: user.role };

    return res
      .status(201)
      .json({ message: "User registered successfully", user: toPublicUser(user) });
  } catch (error) {
    console.error("Register error:", error);
    if (error.code === "23505") return res.status(400).json({ error: "Username already exists" });
    return res.status(500).json({ error: "Registration failed" });
  }
});

/* Backwards-compatible: POST /api/auth-sql/register-sql */
router.post("/register-sql", validateBody(registerSchema), async (req, res) => {
  try {
    const { username, password, role = "sales", email } = req.body;

    const exists = await sqlPool.query("SELECT 1 FROM users WHERE username = $1", [username]);
    if (exists.rows.length) return res.status(400).json({ error: "Username already exists" });

    const user = await createUser({ username, password, role, email });
    return res
      .status(201)
      .json({ message: "User registered successfully (PostgreSQL)", user: toPublicUser(user) });
  } catch (error) {
    console.error("PostgreSQL registration error:", error);
    if (error.code === "23505") return res.status(400).json({ error: "Username already exists" });
    return res.status(500).json({ error: "Registration failed" });
  }
});

/* --------------------------------- Login --------------------------------- */
router.post("/login", validateBody(loginSchema), async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await sqlPool.query(
      "SELECT id, username, password_hash, role, email, is_active, last_login FROM users WHERE username = $1",
      [username],
    );
    if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const user = result.rows[0];
    if (user.is_active === false) return res.status(401).json({ error: "Account deactivated" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    await sqlPool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);

    req.session.user = { id: user.id, username: user.username, role: user.role };

    return res.json({ success: true, message: "Login successful", user: toPublicUser(user) });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed. Try again." });
  }
});

/* ---------------------------------- Me ---------------------------------- */
router.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.session.user }); // {id, username, role}
});

/* -------------------------------- Logout -------------------------------- */
router.post("/logout", (req, res) => {
  if (!req.session) return res.json({ success: true });
  req.session.destroy(() => {
    res.clearCookie("sid");
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

/* ------------------------------ Users (list) ----------------------------- */
router.get("/users-sql", requireAdmin, async (_req, res) => {
  try {
    const result = await sqlPool.query(`
      SELECT id, username, role, email, is_active, last_login, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    return res.json({ users: result.rows });
  } catch (error) {
    console.error("PostgreSQL get users error:", error);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

/* ------------------------------ User info --------------------------------
   Prefer session, but fall back to body.userId for legacy callers.
--------------------------------------------------------------------------- */
router.post("/user-info", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const result = await sqlPool.query(
      "SELECT id, username, role, email, is_active, last_login FROM users WHERE id = $1",
      [userId],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });

    const user = result.rows[0];
    if (user.is_active === false) return res.status(401).json({ error: "Account deactivated" });

    return res.json({ user: toPublicUser(user) });
  } catch (error) {
    console.error("User info error:", error);
    return res.status(500).json({ error: "Failed to fetch user info" });
  }
});

/* ------------------------------ Role update ------------------------------ */
router.put(
  "/users/:id/role",
  requireAdmin,
  validateParams(idParamSchema),
  validateBody(roleUpdateSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      const result = await sqlPool.query(
        "UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, role",
        [role, id],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });

      return res.json({ message: "User role updated", user: result.rows[0] });
    } catch (error) {
      console.error("Role update error:", error);
      return res.status(500).json({ error: "Failed to update user role" });
    }
  },
);

/* ------------------------------- Delete user ----------------------------- */
router.delete("/users/:id", requireAdmin, validateParams(idParamSchema), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sqlPool.query("DELETE FROM users WHERE id = $1 RETURNING id, username", [
      id,
    ]);
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });

    return res.json({ message: "User deleted successfully", user: result.rows[0] });
  } catch (error) {
    console.error("Delete user error:", error);
    return res.status(500).json({ error: "Failed to delete user" });
  }
});

module.exports = router;
