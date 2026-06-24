/**
 * Seed script for local Firebase Emulator.
 * Creates a test shop admin user + sample products.
 *
 * Run AFTER `firebase emulators:start --only auth,firestore`:
 *   node scripts/seed.mjs
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";

const USE_EMULATOR = process.env.USE_EMULATOR !== "false";

if (USE_EMULATOR) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}

const SERVICE_ACCOUNT_PATH = "./scripts/service-account.json";

const app = USE_EMULATOR
  ? initializeApp({ projectId: "demo-market-pos" })
  : initializeApp({ credential: cert(JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"))) });
const auth = getAuth(app);
const db = getFirestore(app);

const SHOP_ID = "shop-1";
const EMAIL = "admin@test.com";
const PASSWORD = "password123";

async function seed() {
  console.log("🌱 Seeding emulator...\n");

  let user;
  try {
    user = await auth.getUserByEmail(EMAIL);
    console.log(`  ✓ User already exists: ${EMAIL}`);
  } catch {
    user = await auth.createUser({ email: EMAIL, password: PASSWORD });
    console.log(`  ✓ Created user: ${EMAIL}`);
  }

  await auth.setCustomUserClaims(user.uid, { shopId: SHOP_ID, role: "admin" });
  console.log(`  ✓ Set claims: shopId=${SHOP_ID}, role=admin`);

  await db.doc(`shops/${SHOP_ID}`).set({
    name: "ຮ້ານເສື້ອຜ້າຕະຫຼາດນາດ",
    createdAt: new Date(),
  }, { merge: true });
  console.log(`  ✓ Created shop: ${SHOP_ID}`);

  await db.doc(`shops/${SHOP_ID}/users/${user.uid}`).set({
    role: "admin",
    email: EMAIL,
  }, { merge: true });

  const products = [
    {
      name: "ເສື້ອຍືດ Oversize",
      price: 120000,
      variants: [
        { size: "S", color: "ຂາວ", stock: 5 },
        { size: "M", color: "ຂາວ", stock: 8 },
        { size: "L", color: "ຂາວ", stock: 3 },
        { size: "S", color: "ດຳ", stock: 4 },
        { size: "M", color: "ດຳ", stock: 6 },
        { size: "L", color: "ດຳ", stock: 0 },
      ],
    },
    {
      name: "ກາງເກງຂາສັ້ນ",
      price: 180000,
      variants: [
        { size: "S", color: "ກາກີ", stock: 3 },
        { size: "M", color: "ກາກີ", stock: 5 },
        { size: "L", color: "ກາກີ", stock: 2 },
        { size: "M", color: "ເທົາ", stock: 4 },
      ],
    },
    {
      name: "ເສື້ອເຊີດ Linen",
      price: 250000,
      variants: [
        { size: "S", color: "ຄຣີມ", stock: 2 },
        { size: "M", color: "ຄຣີມ", stock: 4 },
        { size: "L", color: "ຄຣີມ", stock: 1 },
      ],
    },
    {
      name: "ກະໂປງຜ້າຝ້າຍ",
      price: 160000,
      variants: [
        { size: "Free size", color: "ລາຍ A", stock: 6 },
        { size: "Free size", color: "ລາຍ B", stock: 0 },
      ],
    },
  ];

  const col = db.collection(`shops/${SHOP_ID}/products`);
  for (const p of products) {
    await col.add(p);
    console.log(`  ✓ Product: ${p.name}`);
  }

  console.log(`
✅ Seed complete!

Login credentials:
  Email:    ${EMAIL}
  Password: ${PASSWORD}

Open: http://localhost:5173
`);
}

seed().catch((e) => { console.error(e); process.exit(1); });
