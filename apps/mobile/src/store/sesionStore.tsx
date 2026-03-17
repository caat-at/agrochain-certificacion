import React, { createContext, useContext, useState, useEffect } from "react";
import { obtenerSesion, guardarSesion, cerrarSesion, Sesion } from "../services/db";

interface SesionContextType {
  sesion: Sesion | null;
  cargando: boolean;
  iniciarSesion: (s: Sesion) => Promise<void>;
  salir: () => Promise<void>;
}

const SesionContext = createContext<SesionContextType>({
  sesion: null,
  cargando: true,
  iniciarSesion: async () => {},
  salir: async () => {},
});

export function SesionProvider({ children }: { children: React.ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerSesion()
      .then(setSesion)
      .finally(() => setCargando(false));
  }, []);

  async function iniciarSesion(s: Sesion) {
    await guardarSesion(s);
    setSesion(s);
  }

  async function salir() {
    await cerrarSesion();
    setSesion(null);
  }

  return (
    <SesionContext.Provider value={{ sesion, cargando, iniciarSesion, salir }}>
      {children}
    </SesionContext.Provider>
  );
}

export function useSesion() {
  return useContext(SesionContext);
}
