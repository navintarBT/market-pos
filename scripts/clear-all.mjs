/**
 * clear-all.mjs — ລຶບທຸກຢ່າງໃນລະບົບ (Firestore + Firebase Auth)
 * Usage: node scripts/clear-all.mjs
 * Requires: scripts/service-account.json
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync, existsSync } from "fs";
import readline from "readline";

const SERVICE_ACCOUNT_PATH = "./scripts/service-account.json";

if (!existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("❌ ບໍ່ພົບ scripts/service-account.json");
  console.error("   Firebase Console → Project Settings → Service Accounts → Generate new private key");
  process.exit(1);
}

const app = initializeApp({
  credential: cert(JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"))),
});
const db  = getFirestore(app);
const auth = getAuth(app);

async function confirm(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(msg, (ans) => { rl.close(); resolve(ans.trim().toLowerCase() === "y"); });
  });
}

async function deleteAllAuthUsers() {
  let deleted = 0;
  let pageToken;
  do {
    const result = await auth.listUsers(1000, pageToken);
    if (result.users.length === 0) break;
    const uids = result.users.map(u => u.uid);
    await auth.deleteUsers(uids);
    deleted += uids.length;
    console.log(`  ✓ Auth: ລຶບ ${deleted} accounts...`);
    pageToken = result.pageToken;
  } while (pageToken);
  console.log(`  ✅ Auth users: ລຶບທັງໝົດ ${deleted} accounts`);
}

async function deleteCollection(colPath) {
  const ref = db.collection(colPath);
  await db.recursiveDelete(ref);
  console.log(`  ✅ Firestore: ລຶບ ${colPath} ແລ້ວ`);
}

async function main() {
  console.log("\n⚠️  ⚠️  ⚠️  WARNING  ⚠️  ⚠️  ⚠️");
  console.log("ຈະລຶບທຸກຢ່າງໃນລະບົບ:");
  console.log("  - Firebase Auth: ທຸກ account");
  console.log("  - Firestore: users, shops, tenants (ທຸກ subcollection)");
  console.log("  ⚠️  ກູ້ຄືນບໍ່ໄດ້!\n");

  const ok = await confirm("ຢືນຢັນລຶບທຸກຢ່າງ? ພິມ y ເພື່ອຢືນຢັນ (y/N): ");
  if (!ok) { console.log("\n❌ ຍົກເລີກ — ຂໍ້ມູນຍັງຄົງຢູ່"); process.exit(0); }

  console.log("\n🗑️  ກຳລັງລຶບ...\n");

  await deleteAllAuthUsers();
  await deleteCollection("users");
  await deleteCollection("tenants");
  await deleteCollection("shops");

  console.log("\n✅ ລຶບທຸກຢ່າງສຳເລັດ — ລະບົບ reset ສົມບູນ");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
