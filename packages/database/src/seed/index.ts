import { db } from "../lib/client.js";
import { numeralesNtc5400 } from "./numerales-ntc5400.js";
import { departamentos, municipios } from "./departamentos-colombia.js";
import { createHash } from "crypto";

async function seed() {
  console.log("🌱 Iniciando seed de AgroChain...\n");

  // ── 1. DEPARTAMENTOS Y MUNICIPIOS ────────────────────────────────────────
  console.log("📍 Cargando departamentos de Colombia...");
  for (const dep of departamentos) {
    await db.departamento.upsert({
      where: { codigo: dep.codigo },
      update: { nombre: dep.nombre },
      create: { codigo: dep.codigo, nombre: dep.nombre },
    });
  }
  console.log(`   ✅ ${departamentos.length} departamentos cargados`);

  console.log("📍 Cargando municipios...");
  for (const mun of municipios) {
    await db.municipio.upsert({
      where: { codigo: mun.codigo },
      update: { nombre: mun.nombre, departamentoCod: mun.departamentoCod },
      create: {
        codigo: mun.codigo,
        nombre: mun.nombre,
        departamentoCod: mun.departamentoCod,
      },
    });
  }
  console.log(`   ✅ ${municipios.length} municipios cargados`);

  // ── 2. NUMERALES NTC 5400 ────────────────────────────────────────────────
  console.log("\n📋 Cargando numerales NTC 5400 (BPA Colombia)...");
  for (const numeral of numeralesNtc5400) {
    await db.numeralNtc5400.upsert({
      where: { codigo: numeral.codigo },
      update: {
        seccion: numeral.seccion,
        descripcion: numeral.descripcion,
        criticidad: numeral.criticidad as "CRITICO" | "MAYOR" | "MENOR",
        aplica: numeral.aplica,
      },
      create: {
        codigo: numeral.codigo,
        seccion: numeral.seccion,
        descripcion: numeral.descripcion,
        criticidad: numeral.criticidad as "CRITICO" | "MAYOR" | "MENOR",
        aplica: numeral.aplica,
      },
    });
  }
  console.log(`   ✅ ${numeralesNtc5400.length} numerales NTC 5400 cargados`);

  // ── 3. ORGANIZACION CERTIFICADORA DEMO ───────────────────────────────────
  console.log("\n🏢 Creando organizacion certificadora demo...");
  const orgId = "org_certificadora_demo";
  await db.organizacion.upsert({
    where: { nit: "900123456-7" },
    update: {},
    create: {
      id: orgId,
      nombre: "AgroCert Colombia S.A.S",
      nit: "900123456-7",
      tipo: "CERTIFICADORA",
      resolucion: "ICA-RES-2024-001234",
      vigencia: new Date("2026-12-31"),
      direccion: "Cra 7 # 32-16 Of 501",
      departamento: "11",
      municipio: "11001",
    },
  });
  console.log("   ✅ Organizacion demo creada");

  // Contraseña demo: "password123" → SHA256
  const passDemo = createHash("sha256").update("password123", "utf8").digest("hex");

  // ── 4. USUARIO ADMIN ─────────────────────────────────────────────────────
  console.log("\n👤 Creando usuarios...");
  const adminId = "usr_admin_001";
  await db.usuario.upsert({
    where: { numeroDocumento: "1000000001" },
    update: { passwordHash: passDemo },
    create: {
      id: adminId,
      nombres: "Admin",
      apellidos: "AgroChain",
      tipoDocumento: "CC",
      numeroDocumento: "1000000001",
      email: "admin@agrochain.co",
      telefono: "3001234567",
      rol: "ADMIN",
      passwordHash: passDemo,
    },
  });
  console.log("   ✅ admin  (admin@agrochain.co)");

  // ── 5. AGRICULTOR DEMO ───────────────────────────────────────────────────
  const agricultorId = "usr_agricultor_001";
  await db.usuario.upsert({
    where: { numeroDocumento: "1032456789" },
    update: { passwordHash: passDemo },
    create: {
      id: agricultorId,
      nombres: "Carlos Alberto",
      apellidos: "Gomez Zapata",
      tipoDocumento: "CC",
      numeroDocumento: "1032456789",
      email: "agricultor@agrochain.co",
      telefono: "3112345678",
      rol: "AGRICULTOR",
      passwordHash: passDemo,
    },
  });
  console.log("   ✅ agricultor  (agricultor@agrochain.co)");

  // ── 6. INSPECTOR DEMO ────────────────────────────────────────────────────
  const inspectorId = "usr_inspector_001";
  await db.usuario.upsert({
    where: { numeroDocumento: "79865432" },
    update: { passwordHash: passDemo, email: "inspector@agrochain.co" },
    create: {
      id: inspectorId,
      nombres: "Maria Fernanda",
      apellidos: "Torres Rincon",
      tipoDocumento: "CC",
      numeroDocumento: "79865432",
      email: "inspector@agrochain.co",
      telefono: "3209876543",
      rol: "INSPECTOR_BPA",
      passwordHash: passDemo,
    },
  });
  await db.usuarioOrganizacion.upsert({
    where: { usuarioId_organizacionId: { usuarioId: inspectorId, organizacionId: orgId } },
    update: {},
    create: { usuarioId: inspectorId, organizacionId: orgId, cargo: "Inspector BPA Senior" },
  });
  console.log("   ✅ inspector_bpa  (inspector@agrochain.co)");

  // ── 7. USUARIO CERTIFICADORA ─────────────────────────────────────────────
  const certificadoraId = "usr_certificadora_001";
  await db.usuario.upsert({
    where: { numeroDocumento: "52789012" },
    update: { passwordHash: passDemo, email: "certificador@agrochain.co" },
    create: {
      id: certificadoraId,
      nombres: "Sandra Milena",
      apellidos: "Ospina Vargas",
      tipoDocumento: "CC",
      numeroDocumento: "52789012",
      email: "certificador@agrochain.co",
      telefono: "3156789012",
      rol: "CERTIFICADORA",
      passwordHash: passDemo,
    },
  });
  await db.usuarioOrganizacion.upsert({
    where: { usuarioId_organizacionId: { usuarioId: certificadoraId, organizacionId: orgId } },
    update: {},
    create: { usuarioId: certificadoraId, organizacionId: orgId, cargo: "Certificadora BPA Senior" },
  });
  console.log("   ✅ certificadora  (certificador@agrochain.co)");

  // ── 8. TÉCNICOS (4) ──────────────────────────────────────────────────────
  const tecnicoIds = [
    "usr_tecnico_001",
    "usr_tecnico_002",
    "usr_tecnico_003",
    "usr_tecnico_004",
  ];
  const tecnicos = [
    { id: "usr_tecnico_001", nombres: "Juan Carlos",    apellidos: "Perez Lopez",    doc: "1001001001", email: "tecnico1@agrochain.co" },
    { id: "usr_tecnico_002", nombres: "Maria Isabel",   apellidos: "Gomez Ruiz",     doc: "1001001002", email: "tecnico2@agrochain.co" },
    { id: "usr_tecnico_003", nombres: "Luis Fernando",  apellidos: "Torres Silva",   doc: "1001001003", email: "tecnico3@agrochain.co" },
    { id: "usr_tecnico_004", nombres: "Ana Patricia",   apellidos: "Diaz Moreno",    doc: "1001001004", email: "tecnico4@agrochain.co" },
  ];
  for (const t of tecnicos) {
    await db.usuario.upsert({
      where: { numeroDocumento: t.doc },
      update: { passwordHash: passDemo },
      create: {
        id:              t.id,
        nombres:         t.nombres,
        apellidos:       t.apellidos,
        tipoDocumento:   "CC",
        numeroDocumento: t.doc,
        email:           t.email,
        rol:             "TECNICO",
        passwordHash:    passDemo,
      },
    });
    console.log(`   ✅ ${t.email}`);
  }

  // ── 8. PREDIO DEMO ───────────────────────────────────────────────────────
  console.log("\n🏡 Creando predio demo...");
  const predioId = "pred_001";
  await db.predio.upsert({
    where: { id: predioId },
    update: {},
    create: {
      id: predioId,
      agricultorId,
      nombrePredio: "Finca El Paraiso",
      codigoIca: "ANT-05-2024-00001",
      departamento: "05",
      municipio: "05615",
      vereda: "La Quiebra",
      latitud: 6.1538,
      longitud: -75.3741,
      altitudMsnm: 2150,
      areaTotalHa: 8.5,
      areaProductivaHa: 6.0,
      fuenteAgua: "RIO",
      tipoSuelo: "Franco arcilloso",
      usoPrevio: "Pastizal",
    },
  });
  console.log("   ✅ Finca El Paraíso — Rionegro, Antioquia");

  // ── 9. LOTE 1 — Café Castillo ─────────────────────────────────────────────
  console.log("\n🌿 Creando lotes...");
  const loteData1 = {
    codigoLote: "COL-05-2024-00001", predioId, agricultorId,
    especie: "Coffea arabica", variedad: "Castillo Colombia",
    areaHa: 2.5, fechaCreacion: new Date("2024-03-01").toISOString(),
  };
  const dataHash1 = createHash("sha256").update(JSON.stringify(loteData1)).digest("hex");

  await db.lote.upsert({
    where: { codigoLote: "COL-05-2024-00001" },
    update: {},
    create: {
      id: "lote_001", predioId, agricultorId,
      codigoLote: "COL-05-2024-00001",
      especie: "Coffea arabica", variedad: "Castillo Colombia",
      areaHa: 2.5, fechaSiembra: new Date("2024-03-01"),
      fechaCosechaEst: new Date("2024-11-01"),
      destinoProduccion: "EXPORTACION", estado: "EN_PRODUCCION",
      dataHash: dataHash1, syncEstado: "VERIFICADO",
    },
  });
  console.log("   ✅ lote_001 — Café Castillo Colombia");

  // ── 10. LOTE 2 — Aguacate Hass ────────────────────────────────────────────
  const loteData2 = {
    codigoLote: "COL-05-2024-00002", predioId, agricultorId,
    especie: "Persea americana", variedad: "Hass",
    areaHa: 1.8, fechaCreacion: new Date("2024-05-15").toISOString(),
  };
  const dataHash2 = createHash("sha256").update(JSON.stringify(loteData2)).digest("hex");

  await db.lote.upsert({
    where: { codigoLote: "COL-05-2024-00002" },
    update: {},
    create: {
      id: "lote_002", predioId, agricultorId,
      codigoLote: "COL-05-2024-00002",
      especie: "Persea americana", variedad: "Hass",
      areaHa: 1.8, fechaSiembra: new Date("2024-05-15"),
      fechaCosechaEst: new Date("2026-05-01"),
      destinoProduccion: "EXPORTACION", sistemaRiego: "GOTEO",
      estado: "EN_PRODUCCION",
      dataHash: dataHash2, syncEstado: "VERIFICADO",
    },
  });
  console.log("   ✅ lote_002 — Aguacate Hass");

  // ── 11. PLANTAS LOTE 1 (10 plantas) ──────────────────────────────────────
  console.log("\n🌱 Creando 10 plantas para lote_001...");
  for (let i = 1; i <= 10; i++) {
    const pid = `planta_l1_${String(i).padStart(3, "0")}`;
    const num = String(i).padStart(3, "0");
    await db.planta.upsert({
      where: { id: pid },
      update: {},
      create: {
        id:                      pid,
        loteId:                  "lote_001",
        codigoPlanta:            `COL-05-2024-00001-P${num}`,
        numeroPlanta:            String(i),
        especie:                 "Coffea arabica",
        variedad:                "Castillo Colombia",
        origenMaterial:          "VIVERO_CERTIFICADO",
        procedenciaVivero:       "Vivero Agroforestal Antioquia — Reg. ICA 2024-VIV-001",
        fechaSiembra:            new Date("2024-03-01"),
        alturaCmInicial:         30.0 + i * 0.5,
        diametroTalloCmInicial:  0.7 + i * 0.02,
        numHojasInicial:         5 + (i % 4),
        estadoFenologicoInicial: "Plántula",
        latitud:                 6.15400 + i * 0.00010,
        longitud:                -75.37400 - i * 0.00010,
        altitudMsnm:             2148.0 + i * 0.5,
        registradoPor:           adminId,
        activo:                  true,
      },
    });
  }
  console.log("   ✅ 10 plantas lote_001 creadas");

  // ── 12. PLANTAS LOTE 2 (10 plantas) ──────────────────────────────────────
  console.log("🌱 Creando 10 plantas para lote_002...");
  for (let i = 1; i <= 10; i++) {
    const pid = `planta_l2_${String(i).padStart(3, "0")}`;
    const num = String(i).padStart(3, "0");
    await db.planta.upsert({
      where: { id: pid },
      update: {},
      create: {
        id:                      pid,
        loteId:                  "lote_002",
        codigoPlanta:            `COL-05-2024-00002-P${num}`,
        numeroPlanta:            String(i),
        especie:                 "Persea americana",
        variedad:                "Hass",
        origenMaterial:          "INJERTO",
        procedenciaVivero:       "Vivero El Aguacatal — Reg. ICA 2024-VIV-045",
        fechaSiembra:            new Date("2024-05-15"),
        alturaCmInicial:         44.0 + i * 0.5,
        diametroTalloCmInicial:  1.1 + i * 0.03,
        numHojasInicial:         7 + (i % 3),
        estadoFenologicoInicial: "Trasplante",
        latitud:                 6.15500 + i * 0.00010,
        longitud:                -75.37520 - i * 0.00010,
        altitudMsnm:             2152.0 + i * 0.5,
        registradoPor:           adminId,
        activo:                  true,
      },
    });
  }
  console.log("   ✅ 10 plantas lote_002 creadas");

  // ── 13. CAMPAÑA ABIERTA — lote_001 ───────────────────────────────────────
  console.log("\n📣 Creando campaña ABIERTA para lote_001...");
  const campanaId = "campana_001";

  // Campos requeridos para SIEMBRA — todos los campos de los 4 técnicos
  const camposRequeridos = JSON.stringify([
    "descripcion",        // Posición 1
    "foto",               // Posición 1
    "audio",              // Posición 1
    "alturaCm",           // Posición 2
    "diametroTalloCm",    // Posición 2
    "numHojas",           // Posición 2
    "estadoFenologico",   // Posición 3
    "estadoSanitario",    // Posición 3
    "profundidadCm",      // Posición 4
  ]);

  await db.campana.upsert({
    where: { id: campanaId },
    update: {},
    create: {
      id:              campanaId,
      loteId:          "lote_001",
      nombre:          "Campaña Siembra Marzo 2026",
      descripcion:     "Registro inicial de siembra — 10 plantas Café Castillo",
      estado:          "ABIERTA",
      camposRequeridos,
      creadaPor:       adminId,
      fechaApertura:   new Date("2026-03-01"),
    },
  });
  console.log("   ✅ Campaña Siembra Marzo 2026 — ABIERTA");

  // ── 14. ASIGNAR TÉCNICOS A POSICIONES ────────────────────────────────────
  console.log("👷 Asignando técnicos a posiciones de la campaña...");

  const asignaciones = [
    {
      id:        "ct_001_pos1",
      posicion:  1,
      tecnicoId: tecnicoIds[0],
      campos:    JSON.stringify(["descripcion", "foto", "audio"]),
    },
    {
      id:        "ct_001_pos2",
      posicion:  2,
      tecnicoId: tecnicoIds[1],
      campos:    JSON.stringify(["alturaCm", "diametroTalloCm", "numHojas", "foto", "audio"]),
    },
    {
      id:        "ct_001_pos3",
      posicion:  3,
      tecnicoId: tecnicoIds[2],
      campos:    JSON.stringify(["estadoFenologico", "estadoSanitario", "foto", "audio"]),
    },
    {
      id:        "ct_001_pos4",
      posicion:  4,
      tecnicoId: tecnicoIds[3],
      campos:    JSON.stringify(["profundidadCm", "foto", "audio"]),
    },
  ];

  for (const a of asignaciones) {
    await db.campanaTecnico.upsert({
      where: { campanaId_posicion: { campanaId, posicion: a.posicion } },
      update: { tecnicoId: a.tecnicoId, camposAsignados: a.campos },
      create: {
        id:             a.id,
        campanaId,
        posicion:       a.posicion,
        tecnicoId:      a.tecnicoId,
        camposAsignados: a.campos,
      },
    });
  }

  console.log("   ✅ Posición 1 → tecnico1 (descripcion, foto, audio)");
  console.log("   ✅ Posición 2 → tecnico2 (alturaCm, diametroTalloCm, numHojas, foto, audio)");
  console.log("   ✅ Posición 3 → tecnico3 (estadoFenologico, estadoSanitario, foto, audio)");
  console.log("   ✅ Posición 4 → tecnico4 (profundidadCm, foto, audio)");

  // ── 15. lote_002 — SIN CAMPAÑA (intencional para pruebas) ─────────────────
  console.log("\n   ℹ️  lote_002 — sin campaña activa (intencional)");

  // ── RESUMEN ───────────────────────────────────────────────────────────────
  console.log("\n✅ Seed completado exitosamente!");
  console.log("─────────────────────────────────────────────────────────");
  console.log(`   Departamentos  : ${departamentos.length}`);
  console.log(`   Municipios     : ${municipios.length}`);
  console.log(`   Numerales BPA  : ${numeralesNtc5400.length}`);
  console.log(`   Usuarios       : 8`);
  console.log(`     - admin         : admin@agrochain.co`);
  console.log(`     - agricultor    : agricultor@agrochain.co`);
  console.log(`     - inspector     : inspector@agrochain.co`);
  console.log(`     - certificadora : certificador@agrochain.co`);
  console.log(`     - tecnico1      : tecnico1@agrochain.co  (Posición 1)`);
  console.log(`     - tecnico2      : tecnico2@agrochain.co  (Posición 2)`);
  console.log(`     - tecnico3      : tecnico3@agrochain.co  (Posición 3)`);
  console.log(`     - tecnico4      : tecnico4@agrochain.co  (Posición 4)`);
  console.log(`   Password demo  : password123`);
  console.log(`   Predios        : 1  (Finca El Paraíso — Rionegro, Ant.)`);
  console.log(`   Lotes          : 2`);
  console.log(`     - lote_001   : Café Castillo — 10 plantas — campaña ABIERTA`);
  console.log(`     - lote_002   : Aguacate Hass — 10 plantas — sin campaña`);
  console.log(`   Campañas       : 1  (Siembra Marzo 2026 — ABIERTA)`);
  console.log(`   Técnicos asig. : 4  (posiciones 1-4 en campaña_001)`);
  console.log("─────────────────────────────────────────────────────────");
}

seed()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
