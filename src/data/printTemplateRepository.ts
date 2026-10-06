import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { PrintTemplate } from "./types";

function templatesCol(shopId: string) {
  return collection(db, "shops", shopId, "printTemplates");
}

export async function getTemplates(shopId: string): Promise<PrintTemplate[]> {
  const snap = await getDocs(templatesCol(shopId));
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name as string,
        widthMm: data.widthMm as number,
        heightMm: data.heightMm as number,
        mode: data.mode as PrintTemplate["mode"],
        elements: (data.elements ?? []) as PrintTemplate["elements"],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Creates (no id) or overwrites a template; resolves with its id.
 * Offline, Firestore applies the write to the local cache at once but only
 * settles the promise on reconnect — don't hold the editor open for that.
 */
export async function saveTemplate(shopId: string, t: PrintTemplate): Promise<string> {
  const { id, ...rest } = t;
  // Firestore rejects `undefined` anywhere in a document.
  const data = { ...JSON.parse(JSON.stringify(rest)), updatedAt: serverTimestamp() };
  // A new template gets its id generated client-side, so it's known even offline.
  const ref = id ? doc(templatesCol(shopId), id) : doc(templatesCol(shopId));
  const write = setDoc(ref, data);
  if (navigator.onLine) await write;
  else write.catch(() => {});
  return ref.id;
}

export async function deleteTemplate(shopId: string, id: string): Promise<void> {
  const write = deleteDoc(doc(templatesCol(shopId), id));
  if (navigator.onLine) await write;
  else write.catch(() => {});
}
