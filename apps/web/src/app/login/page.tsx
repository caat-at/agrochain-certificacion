export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/lotes");

  return (
    <div className="min-h-screen bg-gradient-to-br from-verde-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-verde-500 rounded-2xl mb-4">
            <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20c5 0 8-3.58 8-8 0-.5-.03-1.02-.1-1.55-.93.93-2.03 1.55-3.22 1.55-2.21 0-4-1.79-4-4 0-1.19.62-2.29 1.55-3.22C9.02 4.03 8.5 4 8 4c-4.42 0-8 3.58-8 8 0 4.22 3.24 7.68 7.34 7.97L17 8z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-verde-500">AgroChain</h1>
          <p className="text-gray-500 mt-1 text-sm">Portal de Certificación Agrícola</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Iniciar sesión</h2>
          <LoginForm />
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Colombia · Normas ICA · NTC 5400 BPA · INVIMA · Polygon Amoy
        </p>
      </div>
    </div>
  );
}
