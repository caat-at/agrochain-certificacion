async function main() {
  const { db } = await import('./src/index');
  
  // Borrar aportes primero (FK), luego el registro
  const deleted = await db.aporteTecnico.deleteMany({
    where: { registroPlantaId: 'cmmxqqvg00003blh8agn9f4jo' },
  });
  console.log('Aportes eliminados:', deleted.count);

  const reg = await db.registroPlanta.delete({
    where: { id: 'cmmxqqvg00003blh8agn9f4jo' },
  });
  console.log('Registro eliminado:', reg.id, reg.estado);
}
main().catch(console.error);
