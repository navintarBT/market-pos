/**
 * Seed script for local Firebase Emulator.
 * Creates a test shop admin user + sample products.
 *
 * Run AFTER `firebase emulators:start`:
 *   node scripts/seed.mjs
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

const app = initializeApp({ projectId: "demo-market-pos" });
const auth = getAuth(app);
const db = getFirestore(app);

const SHOP_ID = "shop-1";
const EMAIL = "admin@test.com";
const PASSWORD = "password123";

async function seed() {
  console.log("🌱 Seeding emulator...\n");

  // 1. Create user
  let user;
  try {
    user = await auth.getUserByEmail(EMAIL);
    console.log(`  ✓ User already exists: ${EMAIL}`);
  } catch {
    user = await auth.createUser({ email: EMAIL, password: PASSWORD });
    console.log(`  ✓ Created user: ${EMAIL}`);
  }

  // 2. Set custom claims (shopId + role)
  await auth.setCustomUserClaims(user.uid, { shopId: SHOP_ID, role: "admin" });
  console.log(`  ✓ Set claims: shopId=${SHOP_ID}, role=admin`);

  // 3. Create shop document
  await db.doc(`shops/${SHOP_ID}`).set({
    name: "ร้านเสื้อผ้าตลาดนัด",
    createdAt: new Date(),
  }, { merge: true });
  console.log(`  ✓ Created shop: ${SHOP_ID}`);

  // 4. Create shop user record
  await db.doc(`shops/${SHOP_ID}/users/${user.uid}`).set({
    role: "admin",
    email: EMAIL,
  }, { merge: true });

  // 5. Seed products
  const products = [
    {
      name: "เสื้อยืด Oversize",
      price: 250,
      variants: [
        { size: "S", color: "ขาว", stock: 5 },
        { size: "M", color: "ขาว", stock: 8 },
        { size: "L", color: "ขาว", stock: 3 },
        { size: "S", color: "ดำ", stock: 4 },
        { size: "M", color: "ดำ", stock: 6 },
        { size: "L", color: "ดำ", stock: 0 },
      ],
    },
    {
      name: "กางเกงขาสั้น",
      price: 350,
      variants: [
        { size: "S", color: "กากี", stock: 3 },
        { size: "M", color: "กากี", stock: 5 },
        { size: "L", color: "กากี", stock: 2 },
        { size: "M", color: "เทา", stock: 4 },
      ],
    },
    {
      name: "เสื้อเชิ้ต Linen",
      price: 490,
      variants: [
        { size: "S", color: "ครีม", stock: 2 },
        { size: "M", color: "ครีม", stock: 4 },
        { size: "L", color: "ครีม", stock: 1 },
      ],
    },
    {
      name: "กระโปรงผ้าฝ้าย",
      price: 320,
      variants: [
        { size: "Free size", color: "ลาย A", stock: 6 },
        { size: "Free size", color: "ลาย B", stock: 0 },
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
