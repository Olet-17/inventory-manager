const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    soldBy: {
      type: String, // ✅ CHANGED: Store PostgreSQL user ID as string
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // ✅ ADD: Disable automatic _id if you want to use PostgreSQL-style IDs
    // _id: false // Uncomment if you want to use PostgreSQL IDs for sales too
  },
);

// ✅ ADD: Create a compound index for better query performance
saleSchema.index({ soldBy: 1, date: -1 });

module.exports = mongoose.model("Sale", saleSchema);
