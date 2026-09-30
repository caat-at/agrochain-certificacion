"use client";
import { getApiUrl } from "./client";

export interface EspecieOpcion {
  id: string;
  nombreCientifico: string;
  nombreComun: string;
  tipoCiclo: "PERENNE" | "ANUAL";
}

export async function fetchEspecies(tipoCiclo?: "PERENNE" | "ANUAL"): Promise<EspecieOpcion[]> {
  const qs = tipoCiclo ? `?tipoCiclo=${tipoCiclo}` : "";
  const res = await fetch(`${getApiUrl()}/api/catalogo/especies${qs}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.especies ?? [];
}
