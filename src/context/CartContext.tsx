import React, { createContext, useContext, useReducer, useEffect } from "react";
import type { SaleItem } from "../data/types";

type CartItem = SaleItem;

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: "ADD"; item: CartItem }
  | { type: "SET_QTY"; key: string; qty: number }
  | { type: "SET_PRICE"; key: string; price: number }
  | { type: "SPLIT_PRICE"; key: string; price: number }
  | { type: "REMOVE"; key: string }
  | { type: "CLEAR" };

function itemKey(item: Pick<CartItem, "productId" | "variant" | "splitId" | "giftForKey">) {
  const base = `${item.productId}__${item.variant.size}__${item.variant.color}`;
  const withSplit = item.splitId ? `${base}__${item.splitId}` : base;
  return item.giftForKey ? `${withSplit}__gift-for-${item.giftForKey}` : withSplit;
}

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const key = itemKey(action.item);
      const existing = state.items.find((i) => itemKey(i) === key);
      if (existing) {
        return {
          items: state.items.map((i) =>
            itemKey(i) === key ? { ...i, quantity: i.quantity + action.item.quantity } : i
          ),
        };
      }
      return { items: [...state.items, action.item] };
    }
    case "SET_QTY":
      return {
        items: state.items.map((i) =>
          itemKey(i) === action.key ? { ...i, quantity: action.qty } : i
        ),
      };
    case "SET_PRICE":
      return {
        items: state.items.map((i) =>
          itemKey(i) === action.key ? { ...i, unitPrice: action.price } : i
        ),
      };
    case "SPLIT_PRICE": {
      const original = state.items.find((i) => itemKey(i) === action.key);
      if (!original) return state;
      if (original.quantity === 1) {
        return { items: state.items.map((i) => itemKey(i) === action.key ? { ...i, unitPrice: action.price } : i) };
      }
      const splitId = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const splitItem: CartItem = { ...original, quantity: 1, unitPrice: action.price, splitId };
      return {
        items: [
          ...state.items.map((i) => itemKey(i) === action.key ? { ...i, quantity: i.quantity - 1 } : i),
          splitItem,
        ],
      };
    }
    case "REMOVE":
      return { items: state.items.filter((i) => itemKey(i) !== action.key) };
    case "CLEAR":
      return { items: [] };
  }
}

interface CartContextValue {
  items: CartItem[];
  total: number;
  count: number;
  addItem: (item: CartItem) => void;
  setQty: (key: string, qty: number) => void;
  setPrice: (key: string, price: number) => void;
  splitPrice: (key: string, price: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  itemKey: typeof itemKey;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "mpos_cart";

function loadCart(): CartState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { items: [] };
  } catch {
    return { items: [] };
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadCart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const total = state.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const count = state.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        total,
        count,
        addItem: (item) => dispatch({ type: "ADD", item }),
        setQty: (key, qty) => dispatch({ type: "SET_QTY", key, qty }),
        setPrice: (key, price) => dispatch({ type: "SET_PRICE", key, price }),
        splitPrice: (key, price) => dispatch({ type: "SPLIT_PRICE", key, price }),
        removeItem: (key) => dispatch({ type: "REMOVE", key }),
        clear: () => dispatch({ type: "CLEAR" }),
        itemKey,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
