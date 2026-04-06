async function main() {
  const { db } = await import('./src/index');
  const registro = await db.registroPlanta.findFirst({
    where: { plantaId: 'planta_l1_001', campanaId: 'campana_001' },
    include: { aportes: { select: { id: true, posicion: true, tecnicoId: true, hashVerificado: true } } },
  });
  console.log('Registro ID:', registro?.id);
  console.log('Estado:', registro?.estado);
  console.log('Aportes:', registro?.aportes.length);
  registro?.aportes.forEach(a => console.log(' P'+a.posicion, a.tecnicoId, 'hashVerificado:', a.hashVerificado));
}
main().catch(console.error);
