"use client";
import { getApiUrl } from "./client";

export interface PaisOpcion {
  codigo: string;
  nombre: string;
}

export interface DepartamentoOpcion {
  codigo: string;
  nombre: string;
}

export interface MunicipioOpcion {
  codigo: string;
  nombre: string;
  departamentoCod: string;
}

export async function fetchPaises(): Promise<PaisOpcion[]> {
  const res = await fetch(`${getApiUrl()}/api/catalogo/paises`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.paises ?? [];
}

export async function fetchDepartamentos(paisCod?: string): Promise<DepartamentoOpcion[]> {
  if (!paisCod) return [];
  const res = await fetch(`${getApiUrl()}/api/catalogo/departamentos?pais=${paisCod}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.departamentos ?? [];
}

export async function fetchMunicipios(departamentoCod: string): Promise<MunicipioOpcion[]> {
  if (!departamentoCod) return [];
  const res = await fetch(`${getApiUrl()}/api/catalogo/municipios?departamento=${departamentoCod}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.municipios ?? [];
}
