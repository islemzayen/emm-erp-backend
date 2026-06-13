// backfill-createdby.js
// ─────────────────────────────────────────────────────────────────────────────
// ONE-TIME migration. Attributes every pre-existing Online Sales record that has
// no `createdBy` (created before the field existed, or seeded) to the Sales
// Manager, so the new createdBy → User relationship has zero null values.
//
// Placement:  same folder as seed.js  (backend root)
// Run AFTER seeding users:   node seed.js   then   node backfill-createdby.js
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");
const dotenv   = require("dotenv");
dotenv.config();

const User           = require("./models/User");
const OnlineProduct  = require("./models/OnlineProduct");
const OnlineOrder    = require("./models/OnlineOrder");
const OnlineShipment = require("./models/OnlineShipment");
const OnlineReturn   = require("./models/OnlineReturn");
const Reseller       = require("./models/Reseller");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("🔌 Connected");

    const sales = await User.findOne({ email: "sales@erp.com" });
    if (!sales) {
      console.error("❌ Sales Manager (sales@erp.com) not found — run `node seed.js` first.");
      process.exit(1);
    }

    // Match records with no creator yet (missing field OR explicit null)
    const filter = { $or: [{ createdBy: { $exists: false } }, { createdBy: null }] };
    const update = { $set: { createdBy: sales._id } };

    const collections = [
      ["OnlineProduct",  OnlineProduct],
      ["OnlineOrder",    OnlineOrder],
      ["OnlineShipment", OnlineShipment],
      ["OnlineReturn",   OnlineReturn],
      ["Reseller",       Reseller],
    ];

    for (const [name, Model] of collections) {
      const res = await Model.updateMany(filter, update);
      console.log(`🌱 ${name}: ${res.modifiedCount} record(s) backfilled`);
    }

    console.log("✅ Backfill complete — no createdBy is null.");
  } catch (err) {
    console.error("❌ Backfill failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
