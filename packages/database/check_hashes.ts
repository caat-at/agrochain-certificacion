async function main() {
  const { db } = await import('./src/index');
  const { generarContentHashAporte } = await import('./src/lib/hash');

  const campana = await db.campana.findUnique({
    where: { id: 'campana_001' },
    include: {
      registros: {
        where: { estado: { notIn: ['INVALIDADO'] } },
        include: { aportes: true },
      },
    },
  });

  if (!campana) { console.log('no encontrada'); return; }

  let corregidos = 0;
  let fallidos = 0;
  for (const registro of campana.registros) {
    for (const aporte of registro.aportes) {
      const campos = JSON.parse(aporte.campos as string);
      const recalculado = generarContentHashAporte({
        plantaId:    registro.plantaId,
        campanaId:   'campana_001',
        tecnicoId:   aporte.tecnicoId,
        posicion:    aporte.posicion,
        campos,
        fotoHash:    aporte.fotoHash ?? null,
        audioHash:   aporte.audioHash ?? null,
        latitud:     aporte.latitud ?? null,
        longitud:    aporte.longitud ?? null,
        fechaAporte: aporte.fechaAporte.toISOString(),
      });
      const ok = recalculado === aporte.contentHash;
      console.log('P'+aporte.posicion, registro.plantaId.slice(-6), ok ? 'OK' : 'FALLA');
      if (ok) corregidos++;
      else fallidos++;
    }
  }
  console.log('Coinciden:', corregidos, '| Fallan:', fallidos);
}
main().catch(console.error);
