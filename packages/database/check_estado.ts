async function main() {
  const { db } = await import('./src/index');
  // Ver registros activos de la campaña
  const registros = await db.registroPlanta.findMany({
    where: { campanaId: 'campana_001' },
    select: { id: true, plantaId: true, estado: true, aportes: { select: { tecnicoId: true, posicion: true, syncEstado: true } } },
  });
  for (const r of registros) {
    console.log('Planta:', r.plantaId.slice(-8), 'Estado:', r.estado);
    r.aportes.forEach(a => console.log('  P'+a.posicion, a.tecnicoId.slice(-8), a.syncEstado));
  }
  // Ver posición de técnico2 en la campaña
  const tec2 = await db.campanaTecnico.findFirst({
    where: { campanaId: 'campana_001', tecnico: { email: { contains: 'tecnico2' } } },
    include: { tecnico: { select: { email: true } } },
  });
  console.log('Tecnico2 posicion:', tec2?.posicion, 'email:', tec2?.tecnico.email);
}
main().catch(console.error);
