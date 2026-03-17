export const dynamic = "force-dynamic";
import VerificarForm from "./VerificarForm";

export default function VerificarPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-verde-50 to-white">
      {/* Header público */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-verde-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20c5 0 8-3.58 8-8 0-.5-.03-1.02-.1-1.55-.93.93-2.03 1.55-3.22 1.55-2.21 0-4-1.79-4-4 0-1.19.62-2.29 1.55-3.22C9.02 4.03 8.5 4 8 4c-4.42 0-8 3.58-8 8 0 4.22 3.24 7.68 7.34 7.97L17 8z"/>
              </svg>
            </div>
            <div>
              <span className="font-bold text-gray-900">AgroChain</span>
              <span className="text-gray-400 text-sm ml-2">Verificación de certificados</span>
            </div>
          </div>
          <span className="text-xs text-gray-400 hidden sm:block">Polygon Amoy · Colombia</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Verifica la autenticidad</h1>
          <p className="text-gray-500 mt-2 max-w-xl mx-auto">
            Ingresa el código del lote o escanea el QR del certificado para ver
            toda la trazabilidad registrada en blockchain.
          </p>
        </div>

        <VerificarForm />
      </main>

      <footer className="text-center py-8 text-xs text-gray-400">
        Registros inmutables en Polygon · NTC 5400 BPA · ICA Colombia
      </footer>
    </div>
  );
}
