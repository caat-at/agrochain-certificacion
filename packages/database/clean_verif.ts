async function main() {
  const { db } = await import('./src/index');
  await db.verificacionAporteDetalle.deleteMany({});
  await db.verificacionIntegridad.deleteMany({});
  console.log('Limpio');
}
main().catch(console.error);
