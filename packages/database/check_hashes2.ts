async function main() {
  const { db } = await import('./src/index');
  const aportes = await db.aporteTecnico.findMany({
    select: { posicion: true, hashVerificado: true, fechaAporte: true, registro: { select: { plantaId: true } } },
    orderBy: { fechaAporte: 'asc' },
  });
  for (const a of aportes) {
    console.log('P'+a.posicion, a.registro.plantaId.slice(-6), 'hashVerificado:', a.hashVerificado);
  }
}
main().catch(console.error);
