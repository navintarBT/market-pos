import React, { createContext, useContext, useReducer } from "react";
import type { SaleItem } from "../data/types";

type CartItem = SaleItem;

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: "ADD"; item: CartItem }
  | { type: "SET_QTY"; key: string; qty: number }
  | { type: "SET_PRICE"; key: string; price: number }
  | { type: "REMOVE"; key: string }
  | { type: "CLEAR" };

function itemKey(item: Pick<CartItem, "productId" | "variant">) {
  return `${item.productId}__${item.variant.size}__${item.variant.color}`;
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
  removeItem: (key: string) => void;
  clear: () => void;
  itemKey: typeof itemKey;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });

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
