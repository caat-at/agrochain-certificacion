"use client";
import { useState } from "react";
import { VerificarIntegridadBtn, VerificarHashCampanaBtn } from "./AccionesCampana";
import { HistorialVerificaciones } from "./HistorialVerificaciones";
import { HistorialHashCampana } from "./HistorialHashCampana";

export function VerificacionPanel({ campanaId, campanaCerrada }: { campanaId: string; campanaCerrada: boolean }) {
  const [refrescadoEn, setRefrescadoEn]         = useState(0);
  const [refrescadoHashEn, setRefrescadoHashEn] = useState(0);

  return (
    <div className="space-y-3">
      <VerificarIntegridadBtn
        campanaId={campanaId}
        onVerificado={() => setRefrescadoEn(Date.now())}
      />
      <HistorialVerificaciones campanaId={campanaId} refrescadoEn={refrescadoEn} />

      {campanaCerrada && (
        <>
          <VerificarHashCampanaBtn
            campanaId={campanaId}
            onVerificado={() => setRefrescadoHashEn(Date.now())}
          />
          <HistorialHashCampana campanaId={campanaId} refrescadoEn={refrescadoHashEn} />
        </>
      )}
    </div>
  );
}
