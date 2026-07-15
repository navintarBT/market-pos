/**
 * migrate-capital-to-shop.mjs — ຍ້າຍລາຍຈ່າຍໝວດ "capital" (ທຶນທຸລະກິດ) ໄປເປັນ "shop" (ລາຍຈ່າຍຮ້ານ)
 * ໃນທຸກ shop / ທຸກ expense ທີ່ມີຢູ່ໃນລະບົບ
 * Usage: node scripts/migrate-capital-to-shop.mjs
 * Requires: scripts/service-account.json
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import readline from "readline";

const SERVICE_ACCOUNT_PATH = "./scripts/service-account.json";

if (!existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("❌ ບໍ່ພົບ scripts/service-account.json");
  process.exit(1);
}

const app = initializeApp({
  credential: cert(JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"))),
});
const db = getFirestore(app);

async function confirm(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(msg, (ans) => { rl.close(); resolve(ans.trim().toLowerCase() === "y"); });
  });
}

async function main() {
  const shopsSnap = await db.collection("shops").get();
  console.log(`ພົບ ${shopsSnap.size} shops`);

  // Preview: count matching expenses per shop before writing anything
  let totalToMigrate = 0;
  const perShop = [];
  for (const shopDoc of shopsSnap.docs) {
    const expSnap = await shopDoc.ref.collection("expenses").where("category", "==", "capital").get();
    if (expSnap.size > 0) {
      perShop.push({ shopId: shopDoc.id, docs: expSnap.docs });
      totalToMigrate += expSnap.size;
    }
  }

  if (totalToMigrate === 0) {
    console.log("✅ ບໍ່ມີລາຍຈ່າຍໝວດ 'capital' ໃຫ້ຍ້າຍ — ບໍ່ຕ້ອງເຮັດຫຍັງ");
    process.exit(0);
  }

  console.log(`\nຈະອັບເດດ ${totalToMigrate} ລາຍຈ່າຍ (category: "capital" → "shop") ໃນ ${perShop.length} shop:`);
  for (const { shopId, docs } of perShop) {
    console.log(`  - ${shopId}: ${docs.length} ລາຍການ`);
  }

  const ok = await confirm("\nຢືນຢັນອັບເດດ? ພິມ y ເພື່ອຢືນຢັນ (y/N): ");
  if (!ok) { console.log("\n❌ ຍົກເລີກ — ຂໍ້ມູນຍັງຄົງເດີມ"); process.exit(0); }

  let updated = 0;
  for (const { shopId, docs } of perShop) {
    const batch = db.batch();
    for (const d of docs) {
      batch.update(d.ref, { category: "shop" });
    }
    await batch.commit();
    updated += docs.length;
    console.log(`  ✓ ${shopId}: ອັບເດດ ${docs.length} ລາຍການ`);
  }

  console.log(`\n✅ ອັບເດດສຳເລັດ ${updated} ລາຍການ`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
