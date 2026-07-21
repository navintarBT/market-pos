import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const SERVICE_ACCOUNT_PATH = "./scripts/service-account.json";

initializeApp({
  credential: cert(JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"))),
});

const auth = getAuth();
const db = getFirestore();

const EMAIL    = "marketposshop@gmail.com";
const PASSWORD = "12345678";

async function run() {
  console.log("Creating superadmin...\n");

  let user;
  try {
    user = await auth.getUserByEmail(EMAIL);
    console.log(`  ✓ User already exists: ${EMAIL}`);
  } catch {
    user = await auth.createUser({ email: EMAIL, password: PASSWORD });
    console.log(`  ✓ Created user: ${EMAIL}`);
  }

  // เก็บ role ใน Firestore แทน custom claims
  await db.doc(`users/${user.uid}`).set({ role: "superadmin" }, { merge: true });
  console.log(`  ✓ Firestore users/${user.uid} → { role: "superadmin" }`);

  console.log(`
  ✅ Done!
  Login credentials for Control Panel (http://localhost:5175):
  Email:    ${EMAIL}
  Password: ${PASSWORD}
⚠️  เปลี่ยน password หลัง login ครั้งแรกด้วยนะครับ
`);
}

run().catch((e) => { console.error(e); process.exit(1); });
