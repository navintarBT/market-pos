import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";

admin.initializeApp();

/**
 * Callable function: assign a user to a shop with a role.
 * Only existing shop admins (or a super-admin service account) may call this.
 *
 * Request: { uid: string, shopId: string, role: "admin" | "staff" }
 */
export const assignUserToShop = functions.https.onCall(async (request) => {
  const caller = request.auth;
  if (!caller) throw new functions.https.HttpsError("unauthenticated", "Login required");

  const { uid, shopId, role } = request.data as {
    uid: string;
    shopId: string;
    role: "admin" | "staff";
  };

  if (!uid || !shopId || !["admin", "staff"].includes(role)) {
    throw new functions.https.HttpsError("invalid-argument", "uid, shopId, role are required");
  }

  // Only an admin of the same shop (or a super-admin) can assign users
  const callerClaims = caller.token;
  const isSuperAdmin = callerClaims.superAdmin === true;
  const isShopAdmin =
    callerClaims.shopId === shopId && callerClaims.role === "admin";

  if (!isSuperAdmin && !isShopAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Not authorized");
  }

  // Set custom claims on the target user's token
  await admin.auth().setCustomUserClaims(uid, { shopId, role });

  // Write user record into the shop's subcollection
  await admin.firestore().doc(`shops/${shopId}/users/${uid}`).set(
    { role, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

  return { success: true };
});
