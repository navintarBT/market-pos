import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";

admin.initializeApp();

const db = admin.firestore();

interface CreateStaffRequest {
  email?: string;
  password?: string;
  displayName?: string;
}

export const createStaff = onCall<CreateStaffRequest>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Please sign in first.");
  }

  const ownerSnap = await db.doc(`users/${request.auth.uid}`).get();
  const owner = ownerSnap.data();
  const shopId = owner?.shopId;

  if (owner?.role !== "customer" || typeof shopId !== "string" || !shopId) {
    throw new HttpsError("permission-denied", "Only the shop owner can create staff.");
  }

  const email = request.data.email?.trim().toLowerCase();
  const password = request.data.password ?? "";
  const displayName = request.data.displayName?.trim() ?? "";

  if (!email || !email.includes("@")) {
    throw new HttpsError("invalid-argument", "A valid email is required.");
  }

  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
  }

  try {
    const user = await admin.auth().createUser({
      email,
      password,
      displayName: displayName || undefined,
    });
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db.runTransaction(async (tx) => {
      tx.set(db.doc(`users/${user.uid}`), {
        role: "staff",
        shopId,
        email,
        displayName,
        createdAt: now,
        createdBy: request.auth!.uid,
      });
      tx.set(db.doc(`shops/${shopId}/users/${user.uid}`), {
        role: "staff",
        email,
        displayName,
        createdAt: now,
        createdBy: request.auth!.uid,
      });
    });

    return { uid: user.uid, email, displayName };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "This email is already used.");
    }
    throw err;
  }
});
