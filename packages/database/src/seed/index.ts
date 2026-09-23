import pool from "../db/client.js";
import { numeralesNtc5400 } from "./numerales-ntc5400.js";
import { departamentos, municipios } from "./departamentos-colombia.js";
import { stbnSubcriterios } from "./stbn-subcriterios.js";
import { createHash } from "crypto";

async function seed() {
  console.log("🌱 Iniciando seed de AgroChain (PostgreSQL)...\n");

  // ── 1. DEPARTAMENTOS Y MUNICIPIOS ────────────────────────────────────────
  console.log("📍 Cargando departamentos de Colombia...");
  for (const dep of departamentos) {
    await pool.query(
      `INSERT INTO departamentos (codigo, nombre) VALUES ($1, $2)
       ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre`,
      [dep.codigo, dep.nombre]
    );
  }
  console.log(`   ✅ ${departamentos.length} departamentos cargados`);

  console.log("📍 Cargando municipios...");
  for (const mun of municipios) {
    await pool.query(
      `INSERT INTO municipios (codigo, nombre, departamento_cod) VALUES ($1, $2, $3)
       ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, departamento_cod = EXCLUDED.departamento_cod`,
      [mun.codigo, mun.nombre, mun.departamentoCod]
    );
  }
  console.log(`   ✅ ${municipios.length} municipios cargados`);

  // ── 2. NUMERALES NTC 5400 ────────────────────────────────────────────────
  console.log("\n📋 Cargando numerales NTC 5400 (BPA Colombia)...");
  for (const numeral of numeralesNtc5400) {
    await pool.query(
      `INSERT INTO numerales_ntc5400 (codigo, seccion, descripcion, criticidad, aplica)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (codigo) DO UPDATE SET
         seccion = EXCLUDED.seccion, descripcion = EXCLUDED.descripcion,
         criticidad = EXCLUDED.criticidad, aplica = EXCLUDED.aplica`,
      [numeral.codigo, numeral.seccion, numeral.descripcion, numeral.criticidad, numeral.aplica]
    );
  }
  console.log(`   ✅ ${numeralesNtc5400.length} numerales NTC 5400 cargados`);

  // ── 2b. SUBCRITERIOS STBN (PNSS 0000404) ─────────────────────────────────
  console.log("\n📋 Cargando subcriterios STBN (PlanetAI Nature Space)...");
  for (const sub of stbnSubcriterios) {
    await pool.query(
      `INSERT INTO stbn_subcriterios
         (codigo, pilar, nombre, orden, puntaje_alto, puntaje_bajo, descripcion_alto, descripcion_bajo,
          nombre_es, descripcion_alto_es, descripcion_bajo_es)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (codigo) DO UPDATE SET
         pilar = EXCLUDED.pilar, nombre = EXCLUDED.nombre, orden = EXCLUDED.orden,
         puntaje_alto = EXCLUDED.puntaje_alto, puntaje_bajo = EXCLUDED.puntaje_bajo,
         descripcion_alto = EXCLUDED.descripcion_alto, descripcion_bajo = EXCLUDED.descripcion_bajo,
         nombre_es = EXCLUDED.nombre_es, descripcion_alto_es = EXCLUDED.descripcion_alto_es,
         descripcion_bajo_es = EXCLUDED.descripcion_bajo_es`,
      [
        sub.codigo, sub.pilar, sub.nombre, sub.orden,
        sub.puntajeAlto, sub.puntajeBajo, sub.descripcionAlto, sub.descripcionBajo,
        sub.nombreEs, sub.descripcionAltoEs, sub.descripcionBajoEs,
      ]
    );
  }
  console.log(`   ✅ ${stbnSubcriterios.length} subcriterios STBN cargados`);

  // ── 3. ORGANIZACION CERTIFICADORA DEMO ───────────────────────────────────
  console.log("\n🏢 Creando organizacion certificadora demo...");
  const { rows: orgRows } = await pool.query(
    `INSERT INTO organizaciones (nombre, nit, tipo, resolucion, vigencia, direccion, departamento, municipio)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (nit) DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING id`,
    [
      "AgroCert Colombia S.A.S",
      "900123456-7",
      "CERTIFICADORA",
      "ICA-RES-2024-001234",
      "2026-12-31",
      "Cra 7 # 32-16 Of 501",
      "11",
      "11001",
    ]
  );
  const orgId = orgRows[0].id;
  console.log("   ✅ Organizacion demo creada");

  // Contraseña demo: "password123" → SHA256 (bcrypt llega en Fase 2 de auth)
  const passDemo = createHash("sha256").update("password123", "utf8").digest("hex");

  console.log("\n👤 Creando usuarios...");

  const adminId = await pool
    .query(
      `INSERT INTO usuarios (nombres, apellidos, tipo_documento, numero_documento, email, telefono, rol, password_hash)
       VALUES ('Admin','AgroChain','CC','1000000001','admin@agrochain.co','3001234567','ADMIN',$1)
       ON CONFLICT (numero_documento) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [passDemo]
    )
    .then((r) => r.rows[0].id as string);
  console.log("   ✅ admin  (admin@agrochain.co)");

  const agricultorId = await pool
    .query(
      `INSERT INTO usuarios (nombres, apellidos, tipo_documento, numero_documento, email, telefono, rol, password_hash)
       VALUES ('Carlos Alberto','Gomez Zapata','CC','1032456789','agricultor@agrochain.co','3112345678','AGRICULTOR',$1)
       ON CONFLICT (numero_documento) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [passDemo]
    )
    .then((r) => r.rows[0].id as string);
  console.log("   ✅ agricultor  (agricultor@agrochain.co)");

  const inspectorId = await pool
    .query(
      `INSERT INTO usuarios (nombres, apellidos, tipo_documento, numero_documento, email, telefono, rol, password_hash)
       VALUES ('Maria Fernanda','Torres Rincon','CC','79865432','inspector@agrochain.co','3209876543','INSPECTOR_BPA',$1)
       ON CONFLICT (numero_documento) DO UPDATE SET password_hash = EXCLUDED.password_hash, email = EXCLUDED.email
       RETURNING id`,
      [passDemo]
    )
    .then((r) => r.rows[0].id as string);
  await pool.query(
    `INSERT INTO usuario_organizacion (usuario_id, organizacion_id, cargo) VALUES ($1,$2,$3)
     ON CONFLICT (usuario_id, organizacion_id) DO NOTHING`,
    [inspectorId, orgId, "Inspector BPA Senior"]
  );
  console.log("   ✅ inspector_bpa  (inspector@agrochain.co)");

  const certificadoraId = await pool
    .query(
      `INSERT INTO usuarios (nombres, apellidos, tipo_documento, numero_documento, email, telefono, rol, password_hash)
       VALUES ('Sandra Milena','Ospina Vargas','CC','52789012','certificador@agrochain.co','3156789012','CERTIFICADORA',$1)
       ON CONFLICT (numero_documento) DO UPDATE SET password_hash = EXCLUDED.password_hash, email = EXCLUDED.email
       RETURNING id`,
      [passDemo]
    )
    .then((r) => r.rows[0].id as string);
  await pool.query(
    `INSERT INTO usuario_organizacion (usuario_id, organizacion_id, cargo) VALUES ($1,$2,$3)
     ON CONFLICT (usuario_id, organizacion_id) DO NOTHING`,
    [certificadoraId, orgId, "Certificadora BPA Senior"]
  );
  console.log("   ✅ certificadora  (certificador@agrochain.co)");

  // ── TÉCNICOS (4) ─────────────────────────────────────────────────────────
  const tecnicosData = [
    { nombres: "Juan Carlos",   apellidos: "Perez Lopez",  doc: "1001001001", email: "tecnico1@agrochain.co" },
    { nombres: "Maria Isabel",  apellidos: "Gomez Ruiz",   doc: "1001001002", email: "tecnico2@agrochain.co" },
    { nombres: "Luis Fernando", apellidos: "Torres Silva", doc: "1001001003", email: "tecnico3@agrochain.co" },
    { nombres: "Ana Patricia",  apellidos: "Diaz Moreno",  doc: "1001001004", email: "tecnico4@agrochain.co" },
  ];
  const tecnicoIds: string[] = [];
  for (const t of tecnicosData) {
    const id = await pool
      .query(
        `INSERT INTO usuarios (nombres, apellidos, tipo_documento, numero_documento, email, rol, password_hash)
         VALUES ($1,$2,'CC',$3,$4,'TECNICO',$5)
         ON CONFLICT (numero_documento) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id`,
        [t.nombres, t.apellidos, t.doc, t.email, passDemo]
      )
      .then((r) => r.rows[0].id as string);
    tecnicoIds.push(id);
    console.log(`   ✅ ${t.email}`);
  }

  // ── PREDIO DEMO ──────────────────────────────────────────────────────────
  console.log("\n🏡 Creando predio demo...");
  const predioId = await pool
    .query(
      `INSERT INTO predios
         (agricultor_id, nombre_predio, codigo_ica, departamento, municipio, vereda,
          latitud, longitud, altitud_msnm, area_total_ha, area_productiva_ha,
          fuente_agua, tipo_suelo, uso_previo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (codigo_ica) DO UPDATE SET nombre_predio = EXCLUDED.nombre_predio
       RETURNING id`,
      [
        agricultorId,
        "Finca El Paraiso",
        "ANT-05-2024-00001",
        "05",
        "05615",
        "La Quiebra",
        6.1538,
        -75.3741,
        2150,
        8.5,
        6.0,
        "RIO",
        "Franco arcilloso",
        "Pastizal",
      ]
    )
    .then((r) => r.rows[0].id as string);
  console.log("   ✅ Finca El Paraíso — Rionegro, Antioquia");

  // ── LOTE 1 — Café Castillo ───────────────────────────────────────────────
  console.log("\n🌿 Creando lotes...");
  const loteData1 = {
    codigoLote: "COL-05-2024-00001", predioId, agricultorId,
    especie: "Coffea arabica", variedad: "Castillo Colombia",
    areaHa: 2.5, fechaCreacion: new Date("2024-03-01").toISOString(),
  };
  const dataHash1 = createHash("sha256").update(JSON.stringify(loteData1)).digest("hex");

  const lote1Id = await pool
    .query(
      `INSERT INTO lotes
         (predio_id, agricultor_id, codigo_lote, especie, variedad, area_ha,
          fecha_siembra, fecha_cosecha_est, destino_produccion, estado, data_hash, sync_estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'EXPORTACION','EN_PRODUCCION',$9,'VERIFICADO')
       ON CONFLICT (codigo_lote) DO UPDATE SET especie = EXCLUDED.especie
       RETURNING id`,
      [
        predioId, agricultorId, "COL-05-2024-00001", "Coffea arabica", "Castillo Colombia", 2.5,
        "2024-03-01", "2024-11-01", dataHash1,
      ]
    )
    .then((r) => r.rows[0].id as string);
  console.log("   ✅ lote_001 — Café Castillo Colombia");

  // ── LOTE 2 — Aguacate Hass ───────────────────────────────────────────────
  const loteData2 = {
    codigoLote: "COL-05-2024-00002", predioId, agricultorId,
    especie: "Persea americana", variedad: "Hass",
    areaHa: 1.8, fechaCreacion: new Date("2024-05-15").toISOString(),
  };
  const dataHash2 = createHash("sha256").update(JSON.stringify(loteData2)).digest("hex");

  const lote2Id = await pool
    .query(
      `INSERT INTO lotes
         (predio_id, agricultor_id, codigo_lote, especie, variedad, area_ha,
          fecha_siembra, fecha_cosecha_est, destino_produccion, sistema_riego, estado, data_hash, sync_estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'EXPORTACION','GOTEO','EN_PRODUCCION',$9,'VERIFICADO')
       ON CONFLICT (codigo_lote) DO UPDATE SET especie = EXCLUDED.especie
       RETURNING id`,
      [
        predioId, agricultorId, "COL-05-2024-00002", "Persea americana", "Hass", 1.8,
        "2024-05-15", "2026-05-01", dataHash2,
      ]
    )
    .then((r) => r.rows[0].id as string);
  console.log("   ✅ lote_002 — Aguacate Hass");

  // ── PLANTAS LOTE 1 (10 plantas) ──────────────────────────────────────────
  console.log("\n🌱 Creando 10 plantas para lote_001...");
  for (let i = 1; i <= 10; i++) {
    const num = String(i).padStart(3, "0");
    await pool.query(
      `INSERT INTO plantas
         (lote_id, codigo_planta, numero_planta, especie, variedad, origen_material, procedencia_vivero,
          fecha_siembra, altura_cm_inicial, diametro_tallo_cm_inicial, num_hojas_inicial,
          estado_fenologico_inicial, latitud, longitud, altitud_msnm, registrado_por, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true)
       ON CONFLICT (lote_id, codigo_planta) DO NOTHING`,
      [
        lote1Id, `COL-05-2024-00001-P${num}`, String(i), "Coffea arabica", "Castillo Colombia",
        "VIVERO_CERTIFICADO", "Vivero Agroforestal Antioquia — Reg. ICA 2024-VIV-001",
        "2024-03-01", 30.0 + i * 0.5, 0.7 + i * 0.02, 5 + (i % 4), "Plántula",
        6.154 + i * 0.0001, -75.374 - i * 0.0001, 2148.0 + i * 0.5, adminId,
      ]
    );
  }
  console.log("   ✅ 10 plantas lote_001 creadas");

  // ── PLANTAS LOTE 2 (10 plantas) ──────────────────────────────────────────
  console.log("🌱 Creando 10 plantas para lote_002...");
  for (let i = 1; i <= 10; i++) {
    const num = String(i).padStart(3, "0");
    await pool.query(
      `INSERT INTO plantas
         (lote_id, codigo_planta, numero_planta, especie, variedad, origen_material, procedencia_vivero,
          fecha_siembra, altura_cm_inicial, diametro_tallo_cm_inicial, num_hojas_inicial,
          estado_fenologico_inicial, latitud, longitud, altitud_msnm, registrado_por, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true)
       ON CONFLICT (lote_id, codigo_planta) DO NOTHING`,
      [
        lote2Id, `COL-05-2024-00002-P${num}`, String(i), "Persea americana", "Hass",
        "INJERTO", "Vivero El Aguacatal — Reg. ICA 2024-VIV-045",
        "2024-05-15", 44.0 + i * 0.5, 1.1 + i * 0.03, 7 + (i % 3), "Trasplante",
        6.155 + i * 0.0001, -75.3752 - i * 0.0001, 2152.0 + i * 0.5, adminId,
      ]
    );
  }
  console.log("   ✅ 10 plantas lote_002 creadas");

  // ── CAMPAÑA ABIERTA — lote_001 ───────────────────────────────────────────
  console.log("\n📣 Creando campaña ABIERTA para lote_001...");

  const camposRequeridos = [
    "descripcion", "foto", "audio",             // Posición 1
    "alturaCm", "diametroTalloCm", "numHojas",  // Posición 2
    "estadoFenologico", "estadoSanitario",      // Posición 3
    "profundidadCm",                             // Posición 4
  ];

  const campanaId = await pool
    .query(
      `INSERT INTO campanas (lote_id, nombre, descripcion, estado, campos_requeridos, creada_por, fecha_apertura)
       VALUES ($1,$2,$3,'ABIERTA',$4::jsonb,$5,$6)
       RETURNING id`,
      [
        lote1Id,
        "Campaña Siembra Marzo 2026",
        "Registro inicial de siembra — 10 plantas Café Castillo",
        JSON.stringify(camposRequeridos),
        adminId,
        "2026-03-01",
      ]
    )
    .then((r) => r.rows[0].id as string);
  console.log("   ✅ Campaña Siembra Marzo 2026 — ABIERTA");

  // ── ASIGNAR TÉCNICOS A POSICIONES ────────────────────────────────────────
  console.log("👷 Asignando técnicos a posiciones de la campaña...");

  const asignaciones = [
    { posicion: 1, tecnicoId: tecnicoIds[0], campos: ["descripcion", "foto", "audio"] },
    { posicion: 2, tecnicoId: tecnicoIds[1], campos: ["alturaCm", "diametroTalloCm", "numHojas", "foto", "audio"] },
    { posicion: 3, tecnicoId: tecnicoIds[2], campos: ["estadoFenologico", "estadoSanitario", "foto", "audio"] },
    { posicion: 4, tecnicoId: tecnicoIds[3], campos: ["profundidadCm", "foto", "audio"] },
  ];

  for (const a of asignaciones) {
    await pool.query(
      `INSERT INTO campana_tecnicos (campana_id, posicion, tecnico_id, campos_asignados)
       VALUES ($1,$2,$3,$4::jsonb)
       ON CONFLICT (campana_id, posicion) DO UPDATE SET tecnico_id = EXCLUDED.tecnico_id, campos_asignados = EXCLUDED.campos_asignados`,
      [campanaId, a.posicion, a.tecnicoId, JSON.stringify(a.campos)]
    );
  }

  console.log("   ✅ Posición 1 → tecnico1 (descripcion, foto, audio)");
  console.log("   ✅ Posición 2 → tecnico2 (alturaCm, diametroTalloCm, numHojas, foto, audio)");
  console.log("   ✅ Posición 3 → tecnico3 (estadoFenologico, estadoSanitario, foto, audio)");
  console.log("   ✅ Posición 4 → tecnico4 (profundidadCm, foto, audio)");

  // ── lote_002 — SIN CAMPAÑA (intencional para pruebas) ────────────────────
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
  console.log(`   Técnicos asig. : 4  (posiciones 1-4 en campana)`);
  console.log("─────────────────────────────────────────────────────────");
}

seed()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
