const mongoose = require("mongoose");
const dotenv   = require("dotenv");
const User     = require("./models/User");

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    await User.deleteMany({});
    console.log("🗑️  Deleted old users");

    await User.create({
      name:          "Admin User",
      email:         "admin@erp.com",
      password:      "123456",
      role:          "ADMIN",
      department:    "None",
      accountStatus: "approved",
    });
    console.log("🌱 Admin created: admin@erp.com");

    console.log("✅ Done!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed error:", err.message);
    process.exit(1);
  }
};

seed();