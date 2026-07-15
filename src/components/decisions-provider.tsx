"use client";
import { createContext, useContext } from "react";
import type { Decision } from "@/types";

const DecisionsContext = createContext<Decision[]>([]);
export function DecisionsProvider({ decisions, children }:{ decisions:Decision[]; children:React.ReactNode }) { return <DecisionsContext.Provider value={decisions}>{children}</DecisionsContext.Provider>; }
export const useDecisions = () => useContext(DecisionsContext);
