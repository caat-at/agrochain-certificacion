// Utilidades para uso en Client Components ("use client")
// No importar nada de next/headers aquí

export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}
