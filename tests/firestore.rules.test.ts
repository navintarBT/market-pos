/**
 * Firestore Security Rules tests.
 * Requires the Firebase Emulator to be running:
 *   firebase emulators:start --only firestore
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  addDoc,
  Timestamp,
} from "firebase/firestore";

const PROJECT_ID = "market-pos-test";
const RULES_PATH = resolve(__dirname, "../firestore.rules");

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// --- helpers ---

function shopAUser(role: "admin" | "staff" = "staff") {
  return testEnv.authenticatedContext("user-a", {
    shopId: "shop-a",
    role,
  });
}

function shopBUser() {
  return testEnv.authenticatedContext("user-b", { shopId: "shop-b", role: "staff" });
}

function unauthenticated() {
  return testEnv.unauthenticatedContext();
}

async function seedProduct(shopId: string, productId: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `shops/${shopId}/products/${productId}`), {
      name: "T-Shirt",
      price: 200,
      variants: [{ size: "M", color: "black", stock: 10 }],
    });
  });
}

// =============================================================================
// Unauthenticated access
// =============================================================================

describe("unauthenticated", () => {
  it("cannot read any shop product", async () => {
    await seedProduct("shop-a", "prod-1");
    const db = unauthenticated().firestore();
    await assertFails(getDoc(doc(db, "shops/shop-a/products/prod-1")));
  });

  it("cannot create a sale", async () => {
    const db = unauthenticated().firestore();
    await assertFails(
      addDoc(collection(db, "shops/shop-a/sales"), {
        items: [],
        total: 100,
        paymentType: "cash",
        createdAt: Timestamp.now(),
      })
    );
  });
});

// =============================================================================
// Cross-shop isolation
// =============================================================================

describe("cross-shop isolation", () => {
  it("shop-b user cannot read shop-a products", async () => {
    await seedProduct("shop-a", "prod-1");
    const db = shopBUser().firestore();
    await assertFails(getDoc(doc(db, "shops/shop-a/products/prod-1")));
  });

  it("shop-b user cannot create a sale in shop-a", async () => {
    const db = shopBUser().firestore();
    await assertFails(
      addDoc(collection(db, "shops/shop-a/sales"), {
        items: [],
        total: 100,
        paymentType: "cash",
        createdAt: Timestamp.now(),
      })
    );
  });

  it("shop-a user cannot read shop-b products", async () => {
    await seedProduct("shop-b", "prod-1");
    const db = shopAUser().firestore();
    await assertFails(getDoc(doc(db, "shops/shop-b/products/prod-1")));
  });
});

// =============================================================================
// Shop member (staff) — own shop
// =============================================================================

describe("shop member (staff)", () => {
  it("can read their own shop products", async () => {
    await seedProduct("shop-a", "prod-1");
    const db = shopAUser("staff").firestore();
    await assertSucceeds(getDoc(doc(db, "shops/shop-a/products/prod-1")));
  });

  it("can create a valid sale", async () => {
    const db = shopAUser("staff").firestore();
    await assertSucceeds(
      addDoc(collection(db, "shops/shop-a/sales"), {
        items: [
          {
            productId: "prod-1",
            productName: "T-Shirt",
            variant: { size: "M", color: "black", stock: 10 },
            quantity: 1,
            unitPrice: 200,
          },
        ],
        total: 200,
        paymentType: "cash",
        createdAt: Timestamp.now(),
      })
    );
  });

  it("cannot create a sale with invalid paymentType", async () => {
    const db = shopAUser("staff").firestore();
    await assertFails(
      addDoc(collection(db, "shops/shop-a/sales"), {
        items: [],
        total: 200,
        paymentType: "bitcoin",
        createdAt: Timestamp.now(),
      })
    );
  });

  it("cannot create a sale with total <= 0", async () => {
    const db = shopAUser("staff").firestore();
    await assertFails(
      addDoc(collection(db, "shops/shop-a/sales"), {
        items: [],
        total: 0,
        paymentType: "cash",
        createdAt: Timestamp.now(),
      })
    );
  });

  it("cannot write (create/update/delete) products", async () => {
    await seedProduct("shop-a", "prod-1");
    const db = shopAUser("staff").firestore();
    await assertFails(
      setDoc(doc(db, "shops/shop-a/products/prod-new"), {
        name: "Jeans",
        price: 500,
        variants: [],
      })
    );
  });
});

// =============================================================================
// Shop admin — own shop
// =============================================================================

describe("shop admin", () => {
  it("can create a product", async () => {
    const db = shopAUser("admin").firestore();
    await assertSucceeds(
      setDoc(doc(db, "shops/shop-a/products/prod-new"), {
        name: "Jeans",
        price: 500,
        variants: [{ size: "L", color: "blue", stock: 5 }],
      })
    );
  });

  it("can update a product", async () => {
    await seedProduct("shop-a", "prod-1");
    const db = shopAUser("admin").firestore();
    await assertSucceeds(
      setDoc(
        doc(db, "shops/shop-a/products/prod-1"),
        { price: 250 },
        { merge: true }
      )
    );
  });

  it("can delete a product", async () => {
    await seedProduct("shop-a", "prod-1");
    const db = shopAUser("admin").firestore();
    await assertSucceeds(deleteDoc(doc(db, "shops/shop-a/products/prod-1")));
  });

  it("cannot write products in another shop", async () => {
    const db = shopAUser("admin").firestore();
    await assertFails(
      setDoc(doc(db, "shops/shop-b/products/prod-new"), {
        name: "Jeans",
        price: 500,
        variants: [],
      })
    );
  });
});

// =============================================================================
// Print templates — every member prints with them, only the owner edits.
// Seeds users/{uid} docs, which is what the rules actually read roles from.
// =============================================================================

describe("print templates", () => {
  const TEMPLATE = { name: "ໃບປະໜ້າ", widthMm: 100, heightMm: 150, mode: "label", elements: [] };

  async function seedMembers() {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "users/owner-a"), { role: "customer", shopId: "shop-a" });
      await setDoc(doc(db, "users/staff-a"), { role: "staff", shopId: "shop-a" });
      await setDoc(doc(db, "users/owner-b"), { role: "customer", shopId: "shop-b" });
      await setDoc(doc(db, "shops/shop-a/printTemplates/t1"), TEMPLATE);
    });
  }

  const as = (uid: string) => testEnv.authenticatedContext(uid).firestore();

  it("owner can create, update and delete", async () => {
    await seedMembers();
    const db = as("owner-a");
    await assertSucceeds(setDoc(doc(db, "shops/shop-a/printTemplates/t2"), TEMPLATE));
    await assertSucceeds(setDoc(doc(db, "shops/shop-a/printTemplates/t2"), { ...TEMPLATE, name: "ໃໝ່" }));
    await assertSucceeds(deleteDoc(doc(db, "shops/shop-a/printTemplates/t2")));
  });

  it("staff can read but not write", async () => {
    await seedMembers();
    const db = as("staff-a");
    await assertSucceeds(getDoc(doc(db, "shops/shop-a/printTemplates/t1")));
    await assertFails(setDoc(doc(db, "shops/shop-a/printTemplates/t2"), TEMPLATE));
    await assertFails(deleteDoc(doc(db, "shops/shop-a/printTemplates/t1")));
  });

  it("another shop's owner can neither read nor write", async () => {
    await seedMembers();
    const db = as("owner-b");
    await assertFails(getDoc(doc(db, "shops/shop-a/printTemplates/t1")));
    await assertFails(setDoc(doc(db, "shops/shop-a/printTemplates/t2"), TEMPLATE));
  });

  it("rejects a malformed template", async () => {
    await seedMembers();
    const db = as("owner-a");
    await assertFails(setDoc(doc(db, "shops/shop-a/printTemplates/t2"), { ...TEMPLATE, name: 5 }));
    await assertFails(setDoc(doc(db, "shops/shop-a/printTemplates/t2"), { ...TEMPLATE, elements: "x" }));
  });

  it("a suspended shop's owner cannot edit", async () => {
    await seedMembers();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "tenants/shop-a"), { status: "suspended" });
    });
    await assertFails(setDoc(doc(as("owner-a"), "shops/shop-a/printTemplates/t2"), TEMPLATE));
  });
});
