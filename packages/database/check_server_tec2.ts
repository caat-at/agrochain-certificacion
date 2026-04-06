async function main() {
  const { db } = await import('./src/index');
  // Simular lo que hace el servidor para tecnico2 en planta l1_001
  const tecnicoId = 'usr_tecnico_002';
  const registro = await db.registroPlanta.findFirst({
    where: { campanaId: 'campana_001', plantaId: 'planta_l1_001' },
    include: { aportes: true },
  });
  console.log('Registro estado:', registro?.estado);
  const yaAporto = registro?.aportes.some(a => a.tecnicoId === tecnicoId);
  console.log('yaTecnicoAporto para tecnico2:', yaAporto);
  console.log('Aportes existentes:', registro?.aportes.map(a => a.tecnicoId));
}
main().catch(console.error);
