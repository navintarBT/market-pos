/**
 * Clear script — deletes all data from Firestore (production)
 * Usage:
 *   node scripts/clear.mjs            (auto-detect shopId)
 *   node scripts/clear.mjs shop-abc   (specify shopId)
 *
 * Requires: scripts/service-account.json
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import readline from "readline";

const SERVICE_ACCOUNT_PATH = "./scripts/service-account.json";

if (!existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("❌ ບໍ່ພົບ scripts/service-account.json");
  console.error("   ໄປ Firebase Console → Project Settings → Service Accounts → Generate new private key");
  process.exit(1);
}

const app = initializeApp({
  credential: cert(JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"))),
});
const db = getFirestore(app);

const COLLECTIONS = ["products", "sales", "expenses", "categories"];

async function deleteCollection(shopId, colName) {
  const col = db.collection(`shops/${shopId}/${colName}`);
  let total = 0;
  while (true) {
    const snap = await col.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.docs.length;
  }
  console.log(`  ✓ ${colName}: ລຶບ ${total} ລາຍການ`);
}

async function confirm(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(msg, (ans) => { rl.close(); resolve(ans.trim().toLowerCase() === "y"); });
  });
}

async function main() {
  let shopId = process.argv[2];

  if (!shopId) {
    const snap = await db.collection("shops").limit(1).get();
    if (snap.empty) { console.error("❌ ບໍ່ພົບ shop ໃດໃນ Firestore"); process.exit(1); }
    shopId = snap.docs[0].id;
    console.log(`🔍 ພົບ shopId: ${shopId}`);
  }

  console.log(`\n⚠️  ຈະລຶບຂໍ້ມູນທັງໝົດຈາກ shop: "${shopId}"`);
  console.log(`   Collections: ${COLLECTIONS.join(", ")}`);
  console.log(`   ⚠️  ກູ້ຄືນບໍ່ໄດ້!\n`);

  const ok = await confirm("ຢືນຢັນລຶບ? ພິມ y ເພື່ອຢືນຢັນ (y/N): ");
  if (!ok) { console.log("\n❌ ຍົກເລີກ — ຂໍ້ມູນຍັງຄົງຢູ່"); process.exit(0); }

  console.log("\n🗑️  ກຳລັງລຶບ...\n");
  for (const col of COLLECTIONS) {
    await deleteCollection(shopId, col);
  }

  console.log("\n✅ ລຶບຂໍ້ມູນທັງໝົດສຳເລັດ");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
