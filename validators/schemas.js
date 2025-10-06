// validators/schemas.js
const Joi = require("joi");

exports.registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).trim().required(),
  password: Joi.string().min(8).max(128).required(),
  role: Joi.string().valid("admin", "sales").default("sales"),
  email: Joi.string().email().allow(null, "").optional(),
});

exports.loginSchema = Joi.object({
  username: Joi.string().trim().required(),
  password: Joi.string().required(),
});

exports.productCreateSchema = Joi.object({
  name: Joi.string().min(1).max(200).trim().required(),
  sku: Joi.string().min(2).max(50).trim().required(),
  price: Joi.number().min(0).max(1_000_000).required(),
  quantity: Joi.number().integer().min(0).max(1_000_000).required(),
});

exports.productUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(200).trim(),
  sku: Joi.string().min(2).max(50).trim(),
  price: Joi.number().min(0).max(1_000_000),
  quantity: Joi.number().integer().min(0).max(1_000_000),
}).min(1); // require at least one field
