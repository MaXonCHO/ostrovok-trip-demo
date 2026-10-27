"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Hotel } from "@/features/ostrovok/catalog";
const Context = createContext<Hotel[]>([]);
export function CatalogProvider({
  hotels,
  children,
}: {
  hotels: Hotel[];
  children: ReactNode;
}) {
  return <Context.Provider value={hotels}>{children}</Context.Provider>;
}
export const useCatalog = () => useContext(Context);
