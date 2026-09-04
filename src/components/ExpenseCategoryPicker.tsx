import { useState, useEffect } from "react";
import { IonAlert, IonIcon } from "@ionic/react";
import { addOutline, createOutline, trashOutline } from "ionicons/icons";
import type { Category } from "../data/types";
import {
  addExpenseCategory, updateExpenseCategory, deleteExpenseCategory,
  isExpenseCategoryInUse, renameExpenseCategoryInExpenses,
} from "../data/expenseCategoryRepository";

interface CategoryStyle { label: string; chipLabel: string; color: string }

interface Props {
  shopId: string;
  isOwner: boolean;
  value: string;
  onChange: (v: string) => void;
  defaultOrder: readonly string[];
  categoryStyle: Record<string, CategoryStyle>;
  categories: Category[];
  onCategoriesChanged: (next: Category[]) => void;
  /** Fired after a rename actually changed existing expense records — parent should refresh its list. */
  onRenamed?: () => void;
}

const CUSTOM_CHIP_COLOR = "#6b7280";

export default function ExpenseCategoryPicker({
  shopId, isOwner, value, onChange, defaultOrder, categoryStyle, categories, onCategoriesChanged, onRenamed,
}: Props) {
  const [manageMode, setManageMode] = useState(false);

  // Deleting the last custom category while managing would otherwise strand
  // manageMode stuck "on" (the toggle button below only renders when there's
  // something to manage), permanently disabling the default chips with no
  // way left to turn it back off.
  useEffect(() => {
    if (categories.length === 0) setManageMode(false);
  }, [categories.length]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [catError, setCatError] = useState<string | null>(null);

  function isDuplicateName(name: string, excludeId?: string): boolean {
    const lower = name.toLowerCase();
    return (
      Object.values(categoryStyle).some((s) => s.label.toLowerCase() === lower) ||
      categories.some((c) => c.id !== excludeId && c.name.toLowerCase() === lower)
    );
  }

  async function handleCreate(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (isDuplicateName(trimmed)) {
      setCatError(`ໝວດໝູ່ "${trimmed}" ມີຢູ່ແລ້ວ — ກະລຸນາໃຊ້ຊື່ອື່ນ`);
      return;
    }
    try {
      const id = await addExpenseCategory(shopId, trimmed);
      onCategoriesChanged([...categories, { id, name: trimmed }]);
      onChange(trimmed);
    } catch {
      setCatError("ສ້າງໝວດໝູ່ບໍ່ສຳເລັດ — ກວດສິດທິ ຫຼືລອງໃໝ່");
    }
  }

  async function handleEdit(target: Category, data: Record<string, string>) {
    const trimmed = (data[0] ?? "").trim();
    if (!trimmed) { setEditTarget(null); return; }
    if (isDuplicateName(trimmed, target.id)) {
      setCatError(`ໝວດໝູ່ "${trimmed}" ມີຢູ່ແລ້ວ — ກະລຸນາໃຊ້ຊື່ອື່ນ`);
      setEditTarget(null);
      return;
    }
    const oldName = target.name;
    try {
      await updateExpenseCategory(shopId, target.id, trimmed);
      await renameExpenseCategoryInExpenses(shopId, oldName, trimmed);
      onCategoriesChanged(categories.map((c) => (c.id === target.id ? { ...c, name: trimmed } : c)));
      if (value === oldName) onChange(trimmed);
      setEditTarget(null);
      onRenamed?.();
    } catch {
      setCatError("ແກ້ໄຂໝວດໝູ່ບໍ່ສຳເລັດ — ລອງໃໝ່");
      setEditTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      const inUse = await isExpenseCategoryInUse(shopId, target.name);
      if (inUse) {
        setCatError(`ບໍ່ສາມາດລຶບ "${target.name}" ເພາະມີລາຍຈ່າຍທີ່ໃຊ້ໝວດນີ້ຢູ່`);
        return;
      }
      await deleteExpenseCategory(shopId, target.id);
      onCategoriesChanged(categories.filter((c) => c.id !== target.id));
      if (value === target.name) onChange(defaultOrder[0]);
    } catch {
      setCatError("ລຶບໝວດໝູ່ບໍ່ສຳເລັດ — ລອງໃໝ່");
    }
  }

  const chipBase: React.CSSProperties = {
    flexShrink: 0, padding: "8px 14px", borderRadius: 20, border: "none",
    fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
    display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
          ປະເພດລາຍຈ່າຍ
        </p>
        {isOwner && categories.length > 0 && (
          <button
            type="button"
            onClick={() => setManageMode((m) => !m)}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              fontSize: "0.75rem", fontWeight: 700,
              color: manageMode ? "var(--app-warning)" : "var(--ion-color-primary)",
            }}
          >
            {manageMode ? "✓ ບັນທຶກ" : "✏️ ຈັດການ"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        {defaultOrder.map((v) => {
          const style = categoryStyle[v];
          if (!style) return null;
          const selected = value === v;
          return (
            <button
              key={v}
              type="button"
              disabled={manageMode}
              onClick={() => onChange(v)}
              style={{
                ...chipBase,
                background: selected ? style.color : "var(--app-surface-alt)",
                color: selected ? "#fff" : "var(--app-text-secondary)",
                opacity: manageMode ? 0.5 : 1,
              }}
            >
              {style.chipLabel}
            </button>
          );
        })}

        {categories.map((c) => {
          const selected = value === c.name;
          return (
            <div key={c.id} style={{ ...chipBase, background: selected && !manageMode ? CUSTOM_CHIP_COLOR : "var(--app-surface-alt)", color: selected && !manageMode ? "#fff" : "var(--app-text-secondary)", padding: manageMode ? "6px 8px 6px 14px" : chipBase.padding }}>
              <span onClick={() => !manageMode && onChange(c.name)} style={{ cursor: manageMode ? "default" : "pointer" }}>
                🏷️ {c.name}
              </span>
              {manageMode && (
                <>
                  <button type="button" onClick={() => setEditTarget(c)}
                    style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: "inherit", display: "flex" }}>
                    <IonIcon icon={createOutline} style={{ fontSize: 15 }} />
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(c)}
                    style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: "var(--app-danger)", display: "flex" }}>
                    <IonIcon icon={trashOutline} style={{ fontSize: 15 }} />
                  </button>
                </>
              )}
            </div>
          );
        })}

        {!manageMode && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            style={{ ...chipBase, background: "var(--app-surface-alt)", color: "var(--ion-color-primary)", border: "1.5px dashed var(--ion-color-primary)" }}
          >
            <IonIcon icon={addOutline} style={{ fontSize: 15 }} /> ໃໝ່
          </button>
        )}
      </div>

      <IonAlert
        isOpen={createOpen}
        header="ສ້າງໝວດໝູ່ລາຍຈ່າຍໃໝ່"
        inputs={[{ name: "name", type: "text", placeholder: "ເຊັ່ນ: ຄ່ານ້ຳຄ່າໄຟ" }]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel" },
          { text: "ສ້າງ", handler: (data) => { if (data.name?.trim()) handleCreate(data.name); } },
        ]}
        onDidDismiss={() => setCreateOpen(false)}
      />

      <IonAlert
        isOpen={!!editTarget}
        header="ແກ້ໄຂໝວດໝູ່"
        inputs={[{ type: "text", value: editTarget?.name, placeholder: "ຊື່ໝວດ" }]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setEditTarget(null) },
          { text: "ບັນທຶກ", handler: (data) => { if (editTarget) handleEdit(editTarget, data); } },
        ]}
        onDidDismiss={() => setEditTarget(null)}
      />

      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບໝວດໝູ່"
        message={`ລຶບ "${deleteTarget?.name}" ແມ່ນບໍ?`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteTarget(null) },
          { text: "ລຶບ", role: "destructive", handler: handleDelete },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />

      <IonAlert
        isOpen={!!catError}
        header="ຂໍ້ຜິດພາດ"
        message={catError ?? ""}
        buttons={["ຕົກລົງ"]}
        onDidDismiss={() => setCatError(null)}
      />
    </div>
  );
}
