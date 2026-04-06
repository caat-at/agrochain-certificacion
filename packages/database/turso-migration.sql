-- AgroChain migration from dev.db to Turso
-- Generated: 2026-04-03T14:27:50.827Z

PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

-- Tabla: analisis_suelo
DROP TABLE IF EXISTS "analisis_suelo";
CREATE TABLE "analisis_suelo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "predioId" TEXT NOT NULL,
    "fechaMuestreo" DATETIME NOT NULL,
    "laboratorio" TEXT NOT NULL,
    "ph" REAL,
    "materiaOrganica" REAL,
    "nitrogeno" REAL,
    "fosforo" REAL,
    "potasio" REAL,
    "calcio" REAL,
    "magnesio" REAL,
    "resultadoCid" TEXT,
    "resultadoHash" TEXT,
    "txHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analisis_suelo_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "predios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);


-- Tabla: aplicaciones_agroquimicos
DROP TABLE IF EXISTS "aplicaciones_agroquimicos";
CREATE TABLE "aplicaciones_agroquimicos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventoId" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "nombreProducto" TEXT NOT NULL,
    "registroIca" TEXT NOT NULL,
    "ingredienteActivo" TEXT NOT NULL,
    "categoriaToxicologica" TEXT NOT NULL,
    "dosisAplicada" REAL NOT NULL,
    "unidadDosis" TEXT NOT NULL,
    "periodoCarenciaDias" INTEGER NOT NULL,
    "fechaUltimaAplicacion" DATETIME NOT NULL,
    "fechaCosechaPosible" DATETIME NOT NULL,
    "operarioId" TEXT,
    "eppUtilizado" TEXT,
    "justificacion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "aplicaciones_agroquimicos_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos_produccion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "aplicaciones_agroquimicos_eventoId_key" ON "aplicaciones_agroquimicos"("eventoId");

-- Tabla: aportes_tecnicos
DROP TABLE IF EXISTS "aportes_tecnicos";
CREATE TABLE "aportes_tecnicos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registroPlantaId" TEXT NOT NULL,
    "campanaId" TEXT NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "posicion" INTEGER NOT NULL,
    "campos" TEXT NOT NULL,
    "fotoHash" TEXT,
    "fotoUri" TEXT,
    "audioHash" TEXT,
    "audioUri" TEXT,
    "contentHash" TEXT NOT NULL,
    "hashVerificado" BOOLEAN NOT NULL DEFAULT false,
    "hashRechazMotivo" TEXT,
    "latitud" REAL,
    "longitud" REAL,
    "fechaAporte" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncEstado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "aportes_tecnicos_registroPlantaId_fkey" FOREIGN KEY ("registroPlantaId") REFERENCES "registros_planta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "aportes_tecnicos_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "aportes_tecnicos_contentHash_key" ON "aportes_tecnicos"("contentHash");
CREATE UNIQUE INDEX "aportes_tecnicos_registroPlantaId_tecnicoId_key" ON "aportes_tecnicos"("registroPlantaId", "tecnicoId");
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmxtlspr0003blccluusczs3', 'cmmxtlsp70001blcceujlu038', 'campana_001', 'usr_tecnico_004', 4, '{"profundidadCm":7}', '40938626ff487b8cf65c72b9177d2ff8717aa174f7bd3f557ab017bc522b7fe8', NULL, '5e636a4028020259c94f16942c46b675654a10a9a1d16c0b46f3da238a9fd287', NULL, 'ac92919e5902e11977c7b78e810bc56d491d018369443afe9b5ffdb46ac283ec', 1, NULL, 6.2776924, -75.5652014, 1773945931126, 'SINCRONIZADO', 1773945931167);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmxtnnnk0005blcc7xzzrjcp', 'cmmxtlsp70001blcceujlu038', 'campana_001', 'usr_tecnico_003', 3, '{"estadoFenologico":"Vegetativo","estadoSanitario":"Sano"}', '0fd7046ecc191f5af091b1cd18d660d797bc83e15ae05eeabd88bad071c40656', NULL, '4237cdaf54de1e9c2b538b495b8ee771462f1826f356c61736f822fbf17087b0', NULL, '5cfc7f91bc538dd032cc508e6720080b1d334682264f09695f39b6d5921bd5ea', 1, NULL, 6.2776743, -75.5652257, 1773946017922, 'SINCRONIZADO', 1773946017920);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmxtpqms0007blccm8fwnf7u', 'cmmxtlsp70001blcceujlu038', 'campana_001', 'usr_tecnico_002', 2, '{"alturaCm":130,"diametroTalloCm":6,"numHojas":20}', '98ddf431c76542cbdd1eac1c62d96e8754632a820935e2f2ba0560b3292369d0', NULL, '434b21aee04293644752a2b6287dee52bf1907794fd4a0a3567f5100ec4dd3f7', NULL, '646940173d89e1b9aa828b806d85835160c28f72ccd916640207e6d694688831', 1, NULL, 6.2776839, -75.5651661, 1773946115050, 'SINCRONIZADO', 1773946115092);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmxtscwm0009blccl9ba7duc', 'cmmxtlsp70001blcceujlu038', 'campana_001', 'usr_tecnico_001', 1, '{"descripcion":"Planta con buen estado de salud"}', '895cb0b305f0d4b94929aade5057db77da6464948aab6e78cba9476dfcb4851f', NULL, 'a1905614694b1b2dbeb425f4a088a07ae7f4bc4f3be36139da2d879f88ac221f', NULL, '5f488815057c4fbf3250ea91c01794bbc34234eb198ed78762f5c4463d59ed73', 1, NULL, 6.2776911, -75.5651673, 1773946237247, 'SINCRONIZADO', 1773946237270);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmxyce1p0006bli8kcdt7f3j', 'cmmxyce170004bli83hkp8cz9', 'campana_001', 'usr_tecnico_001', 1, '{"descripcion":"Planta con buen estado de salud"}', '4d407870066aef5a7debb47891e7da5adb7089eafa4c8a196a3f8b40b0887b52', NULL, 'ba6ac4e2ef2eb57b879552da36a6c8250ec2b98c7d48db2a826c1dc957a8309e', NULL, 'f974946a888b629093960059467fc89b596332c9bfc41f1d638c437412f2e141', 1, NULL, 6.2776859, -75.5651678, 1773953890170, 'SINCRONIZADO', 1773953890333);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmxyrr700008bli8rlbughoj', 'cmmxyce170004bli83hkp8cz9', 'campana_001', 'usr_tecnico_004', 4, '{"profundidadCm":5}', '78700130928dcd9d791cdca3ce35d677ccf39a325dd919d4522054071cdd1c07', NULL, '7a2fbe05b2c7c104964a59f994cd6187199b090671dbea6a0398e5789a24f21e', NULL, '40994d1994f388bd3b24de9588850cb6a67b98c380940c0a40160e4736a3c731', 1, NULL, 6.2776845, -75.5651737, 1773954607052, 'SINCRONIZADO', 1773954607213);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmxyt85p000abli8w9fcgpul', 'cmmxyce170004bli83hkp8cz9', 'campana_001', 'usr_tecnico_002', 2, '{"alturaCm":125,"diametroTalloCm":5,"numHojas":15}', '1c3640be0702b8a6e556a3e056e3e58ed5800a9c65c6330b4f3b09f49b1acc38', NULL, '93faca79b674df94b129d5d81503e174000fa5fe3caddca57396b9fb900122bd', NULL, '56f890b9d0d6f1b8178518ab84fb6ffb398daf450b1a0794f8f5fe7f916b7608', 1, NULL, 6.2776915, -75.5651704, 1773954675733, 'SINCRONIZADO', 1773954675853);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmxyun3w000cbli8kx20oybt', 'cmmxyce170004bli83hkp8cz9', 'campana_001', 'usr_tecnico_003', 3, '{"estadoFenologico":"Vegetativo","estadoSanitario":"Sano"}', '51ec0e4e46a351035d59656c8efbe7a800c597786e347aad75ddbb4755ab4bd9', NULL, 'e95aae593da6bbdfe10e81d77151e15026112e1604a1870824500cbd10a4a6bb', NULL, '0704322d5644725d40df2c7701306bff7da7b35bdf6b3b853a7cd4b981c48c6b', 1, NULL, 6.2776881, -75.5651696, 1773954741749, 'SINCRONIZADO', 1773954741885);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmy5fdp60003bl0c7ovi1rjq', 'cmmy5fdot0001bl0carboxv2v', 'campana_001', 'usr_tecnico_003', 3, '{"estadoFenologico":"Madurez","estadoSanitario":"Con deficiencia"}', '6520565bd2faccf010bae363b0c1fe1b90934aec4c7c140cc4d7c6170e566d9e', NULL, '903b5a3df13d3a0408eeff94682d8584771a36bd0922d57435869575c5980903', NULL, '533e2a59e577c396ebaa8c64ae1032591f8a662c53ffbbccf6e036d8ceb72bb4', 1, NULL, 6.2776784, -75.565173, 1773965786684, 'SINCRONIZADO', 1773965787162);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmy5gzg60005bl0cg1ow4d2c', 'cmmy5fdot0001bl0carboxv2v', 'campana_001', 'usr_tecnico_002', 2, '{"alturaCm":150,"diametroTalloCm":6.5,"numHojas":50}', '535033dc8f23f08bfe4e38b9b9a41118a4eea01a236fe4ec3a4f5035f06fe365', NULL, 'e188ac8ad96dbe892c1a914c702800612b81f62b7900618662e4ac2a5b42ead6', NULL, '71f5fd11babfbd1cecd1e8bcd096e4dd4af75723dc2145cf26bb150a9a2ac0c2', 1, NULL, 6.2777187, -75.5651378, 1773965861608, 'SINCRONIZADO', 1773965862006);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmy5i8kz0007bl0c95he7khx', 'cmmy5fdot0001bl0carboxv2v', 'campana_001', 'usr_tecnico_004', 4, '{"profundidadCm":15}', '56860095e08a544d32f78ec0cc7c48e7c4b01a05e2563ff62589ef5ce0de8ab7', NULL, 'fa96bfc55175ae272f1cf739efe4b490ed6daa72d10164c39b8988387100ee3a', NULL, 'bcd2ff8a827a51b1608ebae3d6b46a15c8d333cd9d67845eef17a710e1a0e7be', 1, NULL, 6.2776769, -75.5651729, 1773965920134, 'SINCRONIZADO', 1773965920500);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmy6r03q0003blooyuukfa0r', 'cmmy5fdot0001bl0carboxv2v', 'campana_001', 'usr_tecnico_001', 1, '{"descripcion":"Planta en estado de salud. un poco regular"}', '2043eae2457e2a5da9803f50f37c6260b498b16eec70889205d9c22897265cc8', NULL, '6403c2b17ba599296e59a731dc372cd10034df88090ebed63396f773cdd97480', NULL, '9b68e746425c4a0a945063be88e3085d4f77d74bd323b67bc02e7bbc6d75ceba', 1, NULL, 6.2776879, -75.565169, 1773968008623, 'SINCRONIZADO', 1773968009031);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmy74pwv0007bloo627m6724', 'cmmy74pwa0005bloo46kwarug', 'campana_001', 'usr_tecnico_001', 1, '{"descripcion":"Planta marchita. con poca probabilidad de florecer."}', '5e0ee65941d474f10d458cb88a2eabe0018c0b2e7de6d9b4bad5f923c644e4ee', NULL, '2aaa2d80be21d68bece811b783f7fe62cbcde19c6bf48ee8497769cf96cfcdcf', NULL, '1adf5da4b3a7024ff3d07bb8fd1b470aaef998c2e7f308888e58a5a5b7bf0c10', 1, NULL, 6.2776884, -75.5651718, 1773968648572, 'SINCRONIZADO', 1773968649007);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmy765ri0009bloooz6as3j2', 'cmmy74pwa0005bloo46kwarug', 'campana_001', 'usr_tecnico_002', 2, '{"alturaCm":100,"diametroTalloCm":3,"numHojas":3}', '5a429a405694bd3fd486a3221ccf2186b0f35783c6a0bd179de7a3dd16aab437', NULL, '94394866d8c2fdd05e1f9dc3fdb36b0051f2afec19f1d5782d408a5c46d80f84', NULL, '17bc8c4aacda43468dd628dc355b99735847548da202977ada5cc493c227aa58', 1, NULL, 6.2777357, -75.5651579, 1773968715756, 'SINCRONIZADO', 1773968716206);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmy77nuy000dbloo56r7g80o', 'cmmy77nul000bbloo1rvbpxz4', 'campana_001', 'usr_tecnico_002', 2, '{"alturaCm":250,"diametroTalloCm":6.5,"numHojas":80}', '5a78e005d4bffc4161b40bb4a61205c829572a697d873fce4313ee9055543f5d', NULL, '6abdc3bfb72be36d9f1502b613b1c5c4ec01c909ee9d2fe0f0b6b17a9377ab0c', NULL, '649ca9112aeeb11afb9d9ec13b636a8831c87ac29f1a8e135ec6344f55429a5f', 1, NULL, 6.2776944, -75.5651697, 1773968785817, 'SINCRONIZADO', 1773968786315);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmy79a7m000fbloofj5e5bgh', 'cmmy74pwa0005bloo46kwarug', 'campana_001', 'usr_tecnico_004', 4, '{"profundidadCm":10}', 'cefdf77b3aae406db234c5c000ebbf4df652a3a965f8ab1337afdf847e47bab7', NULL, '4fa603b1fc8909e888a1c51545269c0ad7a361af4fda1931a6f6e8f19d35f00c', NULL, '8a67281c0c6ae27df838ed19407a1a1cbb1acce36d5bd599fe7c39f43f019b75', 1, NULL, 6.2776898, -75.5651715, 1773968861495, 'SINCRONIZADO', 1773968861938);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmy7ayhy000hbloomlqdbsf1', 'cmmy77nul000bbloo1rvbpxz4', 'campana_001', 'usr_tecnico_001', 1, '{"descripcion":"Planta con Mu buena salud."}', '148a343880a85b14cf2624174c293de7c6b3607ecb88952b9d3016da5f47f913', NULL, 'a255a0f36d62b0ee88425b6564239c699519c26feda68b8da75b85da456e2447', NULL, '467f2c5d201c0d5aa54e515d9f81aeb239b4f28b98f24f0b8fba9561e6abb11f', 1, NULL, 6.2777023, -75.5651536, 1773968939644, 'SINCRONIZADO', 1773968940070);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmy7ceoc000jbloop9emfjz9', 'cmmy77nul000bbloo1rvbpxz4', 'campana_001', 'usr_tecnico_004', 4, '{"profundidadCm":5}', '77b84b1719ddf2226e0559a6f0f078a0a7a6bc3d910dec0805b4d85627ec8fd7', NULL, '1a92b22828a81b6c689dbce23e4efdef128c67e9b26a80421ba996ef6667ceb1', NULL, 'f17126ae8f5844016dd26d31335edc77722f6299aeaea2d55d70c00fc1d9d1e6', 1, NULL, 6.2776868, -75.5651815, 1773969007277, 'SINCRONIZADO', 1773969007692);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmy7e1ut000lbloo3gf4mt5p', 'cmmy77nul000bbloo1rvbpxz4', 'campana_001', 'usr_tecnico_003', 3, '{"estadoFenologico":"Madurez","estadoSanitario":"Con enfermedad"}', '3174e203351bb68030d291b8552aa6a2f53bcbf002e8d278cf111c0655f8e86d', NULL, '19d2721777285ad7e6c6adb4cc02fd9363b6f0943d6ceb76aeb7c27422d24b1e', NULL, 'a3f72a97ad507cf1be5358d8d8b06591c04ff321792c1d20c6b134299f17530e', 1, NULL, 6.2776837, -75.5651766, 1773969083961, 'SINCRONIZADO', 1773969084390);
INSERT INTO "aportes_tecnicos" ("id", "registroPlantaId", "campanaId", "tecnicoId", "posicion", "campos", "fotoHash", "fotoUri", "audioHash", "audioUri", "contentHash", "hashVerificado", "hashRechazMotivo", "latitud", "longitud", "fechaAporte", "syncEstado", "createdAt") VALUES ('cmmy7f45r000nblool7lybpv1', 'cmmy74pwa0005bloo46kwarug', 'campana_001', 'usr_tecnico_003', 3, '{"estadoFenologico":"Fructificación","estadoSanitario":"Con deficiencia"}', 'ae4aa6eb22e5fdad91933f0b9a1c8f9f8859e2ac8fe16a224dea2820e726a143', NULL, 'cb030c1bc2393ede202bb3a27de0458a61bfbd41b47dd620d66a1bc00e757f65', NULL, '0ead20f89f3508eb29a6afa810fdb4cc7a104e221d7416fdec31a30453e22a59', 1, NULL, 6.2777517, -75.5651618, 1773969133608, 'SINCRONIZADO', 1773969134032);

-- Tabla: blockchain_txs
DROP TABLE IF EXISTS "blockchain_txs";
CREATE TABLE "blockchain_txs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "txHash" TEXT NOT NULL,
    "red" TEXT NOT NULL DEFAULT 'polygon-amoy',
    "contrato" TEXT NOT NULL,
    "metodo" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "bloque" INTEGER,
    "gasUsado" INTEGER,
    "errorMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "blockchain_txs_txHash_key" ON "blockchain_txs"("txHash");
CREATE INDEX "blockchain_txs_entidad_entidadId_idx" ON "blockchain_txs"("entidad", "entidadId");

-- Tabla: campana_tecnicos
DROP TABLE IF EXISTS "campana_tecnicos";
CREATE TABLE "campana_tecnicos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campanaId" TEXT NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "posicion" INTEGER NOT NULL,
    "camposAsignados" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campana_tecnicos_campanaId_fkey" FOREIGN KEY ("campanaId") REFERENCES "campanas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "campana_tecnicos_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "campana_tecnicos_campanaId_posicion_key" ON "campana_tecnicos"("campanaId", "posicion");
CREATE UNIQUE INDEX "campana_tecnicos_campanaId_tecnicoId_key" ON "campana_tecnicos"("campanaId", "tecnicoId");
INSERT INTO "campana_tecnicos" ("id", "campanaId", "tecnicoId", "posicion", "camposAsignados", "createdAt") VALUES ('ct_001_pos1', 'campana_001', 'usr_tecnico_001', 1, '["descripcion","foto","audio"]', 1773253116269);
INSERT INTO "campana_tecnicos" ("id", "campanaId", "tecnicoId", "posicion", "camposAsignados", "createdAt") VALUES ('ct_001_pos2', 'campana_001', 'usr_tecnico_002', 2, '["alturaCm","diametroTalloCm","numHojas","foto","audio"]', 1773253116276);
INSERT INTO "campana_tecnicos" ("id", "campanaId", "tecnicoId", "posicion", "camposAsignados", "createdAt") VALUES ('ct_001_pos3', 'campana_001', 'usr_tecnico_003', 3, '["estadoFenologico","estadoSanitario","foto","audio"]', 1773253116282);
INSERT INTO "campana_tecnicos" ("id", "campanaId", "tecnicoId", "posicion", "camposAsignados", "createdAt") VALUES ('ct_001_pos4', 'campana_001', 'usr_tecnico_004', 4, '["profundidadCm","foto","audio"]', 1773253116289);

-- Tabla: campanas
DROP TABLE IF EXISTS "campanas";
CREATE TABLE "campanas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
    "camposRequeridos" TEXT NOT NULL,
    "campanaHash" TEXT,
    "txHash" TEXT,
    "syncEstado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "cierreConAdvertencia" BOOLEAN NOT NULL DEFAULT false,
    "motivoCierre" TEXT,
    "creadaPor" TEXT NOT NULL,
    "cerradaPor" TEXT,
    "fechaApertura" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "codigo" TEXT,
    CONSTRAINT "campanas_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "campanas_creadaPor_fkey" FOREIGN KEY ("creadaPor") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "campanas_cerradaPor_fkey" FOREIGN KEY ("cerradaPor") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "campanas" ("id", "loteId", "nombre", "descripcion", "estado", "camposRequeridos", "campanaHash", "txHash", "syncEstado", "cierreConAdvertencia", "motivoCierre", "creadaPor", "cerradaPor", "fechaApertura", "fechaCierre", "createdAt", "updatedAt", "codigo") VALUES ('campana_001', 'lote_001', 'Campaña Siembra Marzo 2026', 'Registro inicial de siembra — 10 plantas Café Castillo', 'CERRADA', '["descripcion","foto","audio","alturaCm","diametroTalloCm","numHojas","estadoFenologico","estadoSanitario","profundidadCm"]', 'f3dec08dc006c87d6404deeac6c79eb047b6438265b0efdff522196387224faa', '0x5b1fee3538f077a031718a4fb56862c1fa270c5e71ca12069c7a048103a52c1c', 'PENDIENTE', 0, NULL, 'usr_admin_001', NULL, 1772323200000, 1773969134064, 1773253116261, 1774573966994, NULL);

-- Tabla: certificados
DROP TABLE IF EXISTS "certificados";
CREATE TABLE "certificados" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loteId" TEXT NOT NULL,
    "inspeccionId" TEXT,
    "certificadoraId" TEXT,
    "aprobadoPorId" TEXT,
    "tipo" TEXT NOT NULL,
    "numeroCertificado" TEXT NOT NULL,
    "fechaEmision" DATETIME NOT NULL,
    "fechaVencimiento" DATETIME NOT NULL,
    "revocado" BOOLEAN NOT NULL DEFAULT false,
    "ipfsUri" TEXT,
    "nftTokenId" TEXT,
    "txEmision" TEXT,
    "qrCodeUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "certificados_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "certificados_inspeccionId_fkey" FOREIGN KEY ("inspeccionId") REFERENCES "inspecciones" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "certificados_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "certificados_loteId_key" ON "certificados"("loteId");
CREATE UNIQUE INDEX "certificados_inspeccionId_key" ON "certificados"("inspeccionId");
CREATE UNIQUE INDEX "certificados_numeroCertificado_key" ON "certificados"("numeroCertificado");
INSERT INTO "certificados" ("id", "loteId", "inspeccionId", "certificadoraId", "aprobadoPorId", "tipo", "numeroCertificado", "fechaEmision", "fechaVencimiento", "revocado", "ipfsUri", "nftTokenId", "txEmision", "qrCodeUrl", "createdAt") VALUES ('cmn8bsrv80001bl4ceaqyavf6', 'lote_001', NULL, NULL, 'usr_certificadora_001', 'BPA_ICA', 'BPA-ANT-2026-00001', 1774581151490, 1806117151490, 0, 'ipfs://QmDemo123', '1', '0x713558a1fe0052af72db2c181aa5a2170ee880a0531a3d79134c43b132973acd', NULL, 1774581151508);

-- Tabla: checklist_bpa
DROP TABLE IF EXISTS "checklist_bpa";
CREATE TABLE "checklist_bpa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspeccionId" TEXT NOT NULL,
    "numeralNtc" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "aplica" BOOLEAN NOT NULL DEFAULT true,
    "cumple" BOOLEAN,
    "criticidad" TEXT,
    "evidenciaCid" TEXT,
    "observacion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "checklist_bpa_inspeccionId_fkey" FOREIGN KEY ("inspeccionId") REFERENCES "inspecciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "checklist_bpa_numeralNtc_fkey" FOREIGN KEY ("numeralNtc") REFERENCES "numerales_ntc5400" ("codigo") ON DELETE RESTRICT ON UPDATE CASCADE
);


-- Tabla: departamentos
DROP TABLE IF EXISTS "departamentos";
CREATE TABLE "departamentos" (
    "codigo" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL
);

INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('05', 'Antioquia');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('08', 'Atlantico');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('11', 'Bogota D.C.');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('13', 'Bolivar');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('15', 'Boyaca');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('17', 'Caldas');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('18', 'Caqueta');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('19', 'Cauca');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('20', 'Cesar');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('23', 'Cordoba');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('25', 'Cundinamarca');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('27', 'Choco');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('41', 'Huila');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('44', 'La Guajira');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('47', 'Magdalena');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('50', 'Meta');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('52', 'Narino');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('54', 'Norte de Santander');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('63', 'Quindio');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('66', 'Risaralda');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('68', 'Santander');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('70', 'Sucre');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('73', 'Tolima');
INSERT INTO "departamentos" ("codigo", "nombre") VALUES ('76', 'Valle del Cauca');

-- Tabla: documentos
DROP TABLE IF EXISTS "documentos";
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ipfsCid" TEXT NOT NULL,
    "tamanoKb" INTEGER,
    "hashSha256" TEXT NOT NULL,
    "txHash" TEXT,
    "subidoPor" TEXT NOT NULL,
    "loteId" TEXT,
    "eventoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documentos_subidoPor_fkey" FOREIGN KEY ("subidoPor") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "documentos_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documentos_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos_produccion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "documentos_ipfsCid_key" ON "documentos"("ipfsCid");

-- Tabla: eventos_produccion
DROP TABLE IF EXISTS "eventos_produccion";
CREATE TABLE "eventos_produccion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loteId" TEXT NOT NULL,
    "plantaId" TEXT,
    "creadoPor" TEXT NOT NULL,
    "tipoEvento" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fechaEvento" DATETIME NOT NULL,
    "latitud" REAL,
    "longitud" REAL,
    "altitudMsnm" REAL,
    "contentHash" TEXT NOT NULL,
    "hashVerificado" BOOLEAN NOT NULL DEFAULT false,
    "rechazMotivo" TEXT,
    "syncEstado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "ipfsCid" TEXT,
    "evidenciaHash" TEXT,
    "txHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "eventos_produccion_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "eventos_produccion_plantaId_fkey" FOREIGN KEY ("plantaId") REFERENCES "plantas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "eventos_produccion_creadoPor_fkey" FOREIGN KEY ("creadoPor") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "eventos_produccion_contentHash_key" ON "eventos_produccion"("contentHash");

-- Tabla: inspecciones
DROP TABLE IF EXISTS "inspecciones";
CREATE TABLE "inspecciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loteId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "tipoInspeccion" TEXT NOT NULL,
    "fechaSolicitud" DATETIME NOT NULL,
    "fechaProgramada" DATETIME,
    "fechaRealizada" DATETIME,
    "resultado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "puntaje" REAL,
    "hallazgosCriticos" INTEGER NOT NULL DEFAULT 0,
    "hallazgosMayores" INTEGER NOT NULL DEFAULT 0,
    "hallazgosMenores" INTEGER NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "planMejora" TEXT,
    "fechaLimiteMejora" DATETIME,
    "reporteCid" TEXT,
    "reporteHash" TEXT,
    "txHash" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PROGRAMADA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "inspecciones_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inspecciones_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inspecciones_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "inspecciones" ("id", "loteId", "inspectorId", "organizacionId", "tipoInspeccion", "fechaSolicitud", "fechaProgramada", "fechaRealizada", "resultado", "puntaje", "hallazgosCriticos", "hallazgosMayores", "hallazgosMenores", "observaciones", "planMejora", "fechaLimiteMejora", "reporteCid", "reporteHash", "txHash", "estado", "createdAt", "updatedAt") VALUES ('cmn89f4ra0001blik8z0kl2tu', 'lote_001', 'usr_inspector_001', 'org_certificadora_demo', 'BPA_CERTIFICACION', 1774577155787, NULL, 1774577155831, 'APROBADO', 90, 0, 0, 0, 'Cumple', NULL, NULL, NULL, '0x961f3882db296e2304e2bdab1409b6c20a7b39c033b52393c3b6b0d061818a79', '0x9569a76a343d3f201891edba4a05ef1d9d79cd60fe5dc9a29794935e1b38ccf1', 'COMPLETADA', 1774577155798, 1774580538707);

-- Tabla: lotes
DROP TABLE IF EXISTS "lotes";
CREATE TABLE "lotes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "predioId" TEXT NOT NULL,
    "agricultorId" TEXT NOT NULL,
    "codigoLote" TEXT NOT NULL,
    "especie" TEXT NOT NULL,
    "variedad" TEXT NOT NULL,
    "areaHa" REAL NOT NULL,
    "fechaSiembra" DATETIME,
    "fechaCosechaEst" DATETIME,
    "fechaCosechaReal" DATETIME,
    "volumenCosechaKg" REAL,
    "destinoProduccion" TEXT,
    "sistemaRiego" TEXT,
    "distanciaSiembraM" REAL,
    "densidadPlantas" INTEGER,
    "cultivoAnterior" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'REGISTRADO',
    "loteIdOnchain" TEXT,
    "dataHash" TEXT,
    "txRegistro" TEXT,
    "syncEstado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "lotes_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "predios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lotes_agricultorId_fkey" FOREIGN KEY ("agricultorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "lotes_codigoLote_key" ON "lotes"("codigoLote");
CREATE UNIQUE INDEX "lotes_loteIdOnchain_key" ON "lotes"("loteIdOnchain");
INSERT INTO "lotes" ("id", "predioId", "agricultorId", "codigoLote", "especie", "variedad", "areaHa", "fechaSiembra", "fechaCosechaEst", "fechaCosechaReal", "volumenCosechaKg", "destinoProduccion", "sistemaRiego", "distanciaSiembraM", "densidadPlantas", "cultivoAnterior", "estado", "loteIdOnchain", "dataHash", "txRegistro", "syncEstado", "createdAt", "updatedAt") VALUES ('lote_001', 'pred_001', 'usr_agricultor_001', 'COL-05-2024-00001', 'Coffea arabica', 'Castillo Colombia', 2.5, 1709251200000, 1730419200000, NULL, NULL, 'EXPORTACION', NULL, NULL, NULL, NULL, 'CERTIFICADO', NULL, '903502cbfb25254007de6869350174c0439fe1972ff363dd1e417069d4788564', '0x4245f63db181d6b063192a5620b30323cd639903aca222a9b33d971fea0ab3e1', 'EN_CADENA', 1773253116082, 1774581151529);
INSERT INTO "lotes" ("id", "predioId", "agricultorId", "codigoLote", "especie", "variedad", "areaHa", "fechaSiembra", "fechaCosechaEst", "fechaCosechaReal", "volumenCosechaKg", "destinoProduccion", "sistemaRiego", "distanciaSiembraM", "densidadPlantas", "cultivoAnterior", "estado", "loteIdOnchain", "dataHash", "txRegistro", "syncEstado", "createdAt", "updatedAt") VALUES ('lote_002', 'pred_001', 'usr_agricultor_001', 'COL-05-2024-00002', 'Persea americana', 'Hass', 1.8, 1715731200000, 1777593600000, NULL, NULL, 'EXPORTACION', 'GOTEO', NULL, NULL, NULL, 'EN_PRODUCCION', NULL, '9e9642411460dc52c9cba87c88a0f8568ed5c74e6100f6037b81aed5f632300c', '0x10a1d14bb659ce6523c1e7e65354d464b49e4f8d6777b1f577138e9e52da381a', 'EN_CADENA', 1773253116090, 1774574635142);

-- Tabla: municipios
DROP TABLE IF EXISTS "municipios";
CREATE TABLE "municipios" (
    "codigo" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "departamentoCod" TEXT NOT NULL,
    CONSTRAINT "municipios_departamentoCod_fkey" FOREIGN KEY ("departamentoCod") REFERENCES "departamentos" ("codigo") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('05001', 'Medellin', '05');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('05088', 'Bello', '05');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('05318', 'Guarne', '05');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('05360', 'Jardin', '05');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('05400', 'La Ceja', '05');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('05411', 'La Union', '05');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('05607', 'Retiro', '05');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('05615', 'Rionegro', '05');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('05790', 'Santa Barbara', '05');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('05885', 'Urrao', '05');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('15001', 'Tunja', '15');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('15022', 'Aquitania', '15');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('15090', 'Berbeo', '15');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('15187', 'Chiquinquira', '15');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('15476', 'Moniquira', '15');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('15572', 'Raquira', '15');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('15667', 'Samaca', '15');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('15720', 'Sogamoso', '15');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('15740', 'Soracá', '15');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('15763', 'Tibasosa', '15');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('15810', 'Tuta', '15');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('15832', 'Ventaquemada', '15');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('17001', 'Manizales', '17');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('17174', 'Chinchina', '17');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('17380', 'La Dorada', '17');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('17433', 'Manzanares', '17');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('17524', 'Pacora', '17');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('17541', 'Palestina', '17');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('17616', 'Riosucio', '17');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('17777', 'Supia', '17');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('17867', 'Villamaria', '17');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('19001', 'Popayan', '19');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('19022', 'Almaguer', '19');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('19050', 'Argelia', '19');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('19300', 'Florencia', '19');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('19318', 'Guachene', '19');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('19573', 'Puerto Tejada', '19');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('25001', 'Agua de Dios', '25');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('25175', 'Choachi', '25');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('25200', 'Cota', '25');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('25214', 'Cucunuba', '25');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('25269', 'Facatativa', '25');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('25290', 'Funza', '25');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('25307', 'Fusagasuga', '25');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('25386', 'La Mesa', '25');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('25430', 'Macheta', '25');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('25473', 'Mosquera', '25');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('25483', 'Nemocon', '25');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('25658', 'Sibate', '25');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('25754', 'Soacha', '25');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('25785', 'Subachoque', '25');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('25843', 'Tocaima', '25');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('25899', 'Zipaquira', '25');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('41001', 'Neiva', '41');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('41006', 'Acevedo', '41');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('41013', 'Agrado', '41');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('41016', 'Aipe', '41');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('41132', 'Campo Alegre', '41');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('41206', 'El Agrado', '41');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('41298', 'Garzon', '41');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('41306', 'Gigante', '41');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('41503', 'Palermo', '41');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('41548', 'Pitalito', '41');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('41770', 'San Agustin', '41');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('41791', 'Santa Maria', '41');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('41872', 'Timana', '41');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('52001', 'Pasto', '52');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('52019', 'Alban', '52');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('52240', 'El Tambo', '52');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('52256', 'Funes', '52');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('52418', 'La Florida', '52');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('52490', 'Montalvo', '52');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('52506', 'Olaya Herrera', '52');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('52694', 'Samaniego', '52');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('52720', 'Sandona', '52');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('52835', 'Tumaco', '52');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('63001', 'Armenia', '63');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('63111', 'Buenavista', '63');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('63130', 'Calarca', '63');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('63190', 'Circasia', '63');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('63212', 'Cordoba', '63');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('63272', 'Filandia', '63');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('63302', 'Genova', '63');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('63401', 'La Tebaida', '63');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('63470', 'Montenegro', '63');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('63548', 'Pijao', '63');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('63594', 'Quimbaya', '63');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('63690', 'Salento', '63');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('66001', 'Pereira', '66');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('66045', 'Apia', '66');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('66075', 'Balboa', '66');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('66170', 'Dosquebradas', '66');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('66318', 'Guatica', '66');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('66383', 'La Celia', '66');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('66400', 'La Virginia', '66');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('66440', 'Marsella', '66');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('66456', 'Mistrato', '66');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('66572', 'Pueblo Rico', '66');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('66594', 'Quinchia', '66');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('66682', 'Santa Rosa de Cabal', '66');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('66687', 'Santuario', '66');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68001', 'Bucaramanga', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68013', 'Aguada', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68020', 'Albania', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68077', 'Barbosa', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68132', 'Capitanejo', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68179', 'Charta', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68209', 'Curiti', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68245', 'El Carmen de Chucuri', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68307', 'Giron', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68432', 'Macaravita', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68444', 'Matanza', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68464', 'Mogotes', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68547', 'Pie de Cuesta', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68575', 'Puente Nacional', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68679', 'San Vicente de Chucuri', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68754', 'Socorro', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68780', 'Suaita', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('68855', 'Velez', '68');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73001', 'Ibague', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73024', 'Alpujarra', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73043', 'Anzoategui', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73055', 'Armero', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73124', 'Cajamarca', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73168', 'Chaparral', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73200', 'Coello', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73275', 'Flandes', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73283', 'Fresno', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73349', 'Honda', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73411', 'Lerida', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73443', 'Mariquita', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73449', 'Melgar', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73520', 'Ortega', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73563', 'Planadas', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73616', 'Rioblanco', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73678', 'San Luis', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('73861', 'Villahermosa', '73');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76001', 'Cali', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76036', 'Andalucia', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76041', 'Ansermanuevo', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76113', 'Buga', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76122', 'Bugalagrande', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76130', 'Caicedonia', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76147', 'Cartago', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76246', 'El Cairo', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76248', 'El Cerrito', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76306', 'Ginebra', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76318', 'Guacari', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76364', 'La Union', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76377', 'La Victoria', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76400', 'Obando', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76497', 'Palmira', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76520', 'Pradera', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76606', 'Restrepo', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76616', 'Riofrio', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76622', 'Roldanillo', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76670', 'San Pedro', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76736', 'Sevilla', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76823', 'Toro', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76828', 'Trujillo', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76845', 'Tulua', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76863', 'Ulloa', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76869', 'Versalles', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76890', 'Vijes', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76892', 'Yotoco', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76895', 'Yumbo', '76');
INSERT INTO "municipios" ("codigo", "nombre", "departamentoCod") VALUES ('76897', 'Zarzal', '76');

-- Tabla: numerales_ntc5400
DROP TABLE IF EXISTS "numerales_ntc5400";
CREATE TABLE "numerales_ntc5400" (
    "codigo" TEXT NOT NULL PRIMARY KEY,
    "seccion" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "criticidad" TEXT NOT NULL,
    "aplica" TEXT NOT NULL
);

INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.1.1', '4.1 Instalaciones y equipos', 'El predio cuenta con bodega de almacenamiento de insumos agricolas separada de la vivienda', 'CRITICO', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.1.2', '4.1 Instalaciones y equipos', 'La bodega de agroquimicos tiene ventilacion, piso impermeable y esta bajo llave', 'CRITICO', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.1.3', '4.1 Instalaciones y equipos', 'Los equipos de aplicacion se calibran y mantienen en buen estado', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.1.4', '4.1 Instalaciones y equipos', 'Existe area para lavado y mantenimiento de equipos de aplicacion', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.2.1', '4.2 Suelo', 'Se dispone de analisis de suelos con vigencia no mayor a 3 anos', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.2.2', '4.2 Suelo', 'Se implementan practicas de conservacion de suelos (curvas de nivel, barreras vivas)', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.2.3', '4.2 Suelo', 'Los planes de fertilizacion se basan en analisis de suelo', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.2.4', '4.2 Suelo', 'Se evita la contaminacion del suelo con residuos de cosecha sin compostar', 'MENOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.3.1', '4.3 Material vegetal', 'El material de siembra proviene de viveros certificados o con aval ICA', 'CRITICO', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.3.2', '4.3 Material vegetal', 'Se verifica la sanidad del material vegetal antes de la siembra', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.3.3', '4.3 Material vegetal', 'Se cuenta con registros del origen del material vegetal utilizado', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.4.1', '4.4 Fertilizacion', 'Los fertilizantes utilizados estan registrados ante el ICA', 'CRITICO', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.4.2', '4.4 Fertilizacion', 'Se lleva registro de todas las aplicaciones de fertilizantes (fecha, dosis, metodo)', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.4.3', '4.4 Fertilizacion', 'Los abonos organicos utilizados (compost, lombricompost) estan compostados correctamente', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.4.4', '4.4 Fertilizacion', 'No se utiliza biosólidos de aguas residuales sin tratamiento previo', 'CRITICO', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.5.1', '4.5 Riego', 'El agua de riego cumple con los criterios de calidad para uso agricola (IDEAM/MADS)', 'CRITICO', 'RIEGO_ARTIFICIAL');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.5.2', '4.5 Riego', 'Se dispone de analisis de calidad del agua de riego con vigencia no mayor a 1 ano', 'MAYOR', 'RIEGO_ARTIFICIAL');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.5.3', '4.5 Riego', 'El sistema de riego es eficiente y evita el encharcamiento', 'MENOR', 'RIEGO_ARTIFICIAL');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.5.4', '4.5 Riego', 'No se usa agua residual para riego sin tratamiento previo certificado', 'CRITICO', 'RIEGO_ARTIFICIAL');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.6.1', '4.6 MIP', 'Se implementa Manejo Integrado de Plagas (MIP) como primera estrategia', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.6.2', '4.6 MIP', 'Se realizan monitoreos periodicos de plagas y enfermedades con registros', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.6.3', '4.6 MIP', 'Se identifican correctamente las plagas/enfermedades antes de aplicar control quimico', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.7.1', '4.7 Agroquimicos', 'Solo se usan agroquimicos con Registro ICA vigente', 'CRITICO', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.7.2', '4.7 Agroquimicos', 'Se respetan los periodos de carencia antes de la cosecha', 'CRITICO', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.7.3', '4.7 Agroquimicos', 'El aplicador usa el Equipo de Proteccion Personal (EPP) completo', 'CRITICO', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.7.4', '4.7 Agroquimicos', 'Se llevan registros completos de cada aplicacion (producto, dosis, fecha, operario)', 'CRITICO', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.7.5', '4.7 Agroquimicos', 'Los envases vacios se tratan segun programa Campo Limpio (triple lavado)', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.7.6', '4.7 Agroquimicos', 'No se usan productos de categoria toxicologica I (rojo) en cultivos de exportacion', 'CRITICO', 'EXPORTACION');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.7.7', '4.7 Agroquimicos', 'Los agroquimicos se almacenan en su envase original con etiqueta legible', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.8.1', '4.8 Cosecha y postcosecha', 'Los implementos de cosecha estan limpios y desinfectados', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.8.2', '4.8 Cosecha y postcosecha', 'Se verifica que el periodo de carencia de agroquimicos ha concluido antes de cosechar', 'CRITICO', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.8.3', '4.8 Cosecha y postcosecha', 'El producto cosechado no tiene contacto con el suelo durante la recoleccion', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.8.4', '4.8 Cosecha y postcosecha', 'Se lleva registro de volumen cosechado por lote', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.9.1', '4.9 Higiene y bienestar', 'Los trabajadores tienen acceso a agua potable y servicios sanitarios en campo', 'CRITICO', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.9.2', '4.9 Higiene y bienestar', 'Se cuenta con botiquin de primeros auxilios en campo', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.9.3', '4.9 Higiene y bienestar', 'Los trabajadores reciben capacitacion en BPA e higiene personal', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.9.4', '4.9 Higiene y bienestar', 'No trabajan menores de edad en actividades de riesgo (aplicacion agroquimicos)', 'CRITICO', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.10.1', '4.10 Medio ambiente', 'Se conservan las zonas de proteccion de fuentes de agua (30m rios, 15m quebradas)', 'CRITICO', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.10.2', '4.10 Medio ambiente', 'Los residuos solidos se clasifican y disponen adecuadamente', 'MAYOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.10.3', '4.10 Medio ambiente', 'Se tienen practicas de conservacion de biodiversidad en el predio', 'MENOR', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.11.1', '4.11 Trazabilidad', 'El sistema permite identificar el origen de cualquier unidad de producto', 'CRITICO', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.11.2', '4.11 Trazabilidad', 'Se lleva registro de lotes con identificacion unica', 'CRITICO', 'TODOS');
INSERT INTO "numerales_ntc5400" ("codigo", "seccion", "descripcion", "criticidad", "aplica") VALUES ('4.11.3', '4.11 Trazabilidad', 'Los registros se conservan por minimo 2 anos despues de la cosecha', 'MAYOR', 'TODOS');

-- Tabla: organizaciones
DROP TABLE IF EXISTS "organizaciones";
CREATE TABLE "organizaciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "resolucion" TEXT,
    "vigencia" DATETIME,
    "direccion" TEXT,
    "departamento" TEXT,
    "municipio" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "organizaciones_nit_key" ON "organizaciones"("nit");
INSERT INTO "organizaciones" ("id", "nombre", "nit", "tipo", "resolucion", "vigencia", "direccion", "departamento", "municipio", "activo", "createdAt") VALUES ('org_certificadora_demo', 'AgroCert Colombia S.A.S', '900123456-7', 'CERTIFICADORA', 'ICA-RES-2024-001234', 1798675200000, 'Cra 7 # 32-16 Of 501', '11', '11001', 1, 1773253115987);

-- Tabla: plantas
DROP TABLE IF EXISTS "plantas";
CREATE TABLE "plantas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loteId" TEXT NOT NULL,
    "codigoPlanta" TEXT NOT NULL,
    "numeroPlanta" TEXT NOT NULL,
    "latitud" REAL NOT NULL,
    "longitud" REAL NOT NULL,
    "altitudMsnm" REAL,
    "especie" TEXT,
    "variedad" TEXT,
    "origenMaterial" TEXT,
    "procedenciaVivero" TEXT,
    "fechaSiembra" DATETIME,
    "alturaCmInicial" REAL,
    "diametroTalloCmInicial" REAL,
    "numHojasInicial" INTEGER,
    "estadoFenologicoInicial" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "registradoPor" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plantas_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "plantas_registradoPor_fkey" FOREIGN KEY ("registradoPor") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "plantas_loteId_codigoPlanta_key" ON "plantas"("loteId", "codigoPlanta");
CREATE UNIQUE INDEX "plantas_loteId_numeroPlanta_key" ON "plantas"("loteId", "numeroPlanta");
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l1_001', 'lote_001', 'COL-05-2024-00001-P001', '1', 6.1541, -75.3741, 2148.5, 'Coffea arabica', 'Castillo Colombia', 'VIVERO_CERTIFICADO', 'Vivero Agroforestal Antioquia — Reg. ICA 2024-VIV-001', 1709251200000, 30.5, 0.72, 6, 'Plántula', 1, 'usr_admin_001', 1773253116099);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l1_002', 'lote_001', 'COL-05-2024-00001-P002', '2', 6.1542, -75.3742, 2149, 'Coffea arabica', 'Castillo Colombia', 'VIVERO_CERTIFICADO', 'Vivero Agroforestal Antioquia — Reg. ICA 2024-VIV-001', 1709251200000, 31, 0.74, 7, 'Plántula', 1, 'usr_admin_001', 1773253116106);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l1_003', 'lote_001', 'COL-05-2024-00001-P003', '3', 6.1543, -75.37429999999999, 2149.5, 'Coffea arabica', 'Castillo Colombia', 'VIVERO_CERTIFICADO', 'Vivero Agroforestal Antioquia — Reg. ICA 2024-VIV-001', 1709251200000, 31.5, 0.76, 8, 'Plántula', 1, 'usr_admin_001', 1773253116115);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l1_004', 'lote_001', 'COL-05-2024-00001-P004', '4', 6.1544, -75.3744, 2150, 'Coffea arabica', 'Castillo Colombia', 'VIVERO_CERTIFICADO', 'Vivero Agroforestal Antioquia — Reg. ICA 2024-VIV-001', 1709251200000, 32, 0.7799999999999999, 5, 'Plántula', 1, 'usr_admin_001', 1773253116121);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l1_005', 'lote_001', 'COL-05-2024-00001-P005', '5', 6.1545, -75.3745, 2150.5, 'Coffea arabica', 'Castillo Colombia', 'VIVERO_CERTIFICADO', 'Vivero Agroforestal Antioquia — Reg. ICA 2024-VIV-001', 1709251200000, 32.5, 0.7999999999999999, 6, 'Plántula', 1, 'usr_admin_001', 1773253116129);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l2_001', 'lote_002', 'COL-05-2024-00002-P001', '1', 6.1551, -75.37530000000001, 2152.5, 'Persea americana', 'Hass', 'INJERTO', 'Vivero El Aguacatal — Reg. ICA 2024-VIV-045', 1715731200000, 44.5, 1.13, 8, 'Trasplante', 1, 'usr_admin_001', 1773253116181);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l2_002', 'lote_002', 'COL-05-2024-00002-P002', '2', 6.155200000000001, -75.37540000000001, 2153, 'Persea americana', 'Hass', 'INJERTO', 'Vivero El Aguacatal — Reg. ICA 2024-VIV-045', 1715731200000, 45, 1.16, 9, 'Trasplante', 1, 'usr_admin_001', 1773253116188);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l2_003', 'lote_002', 'COL-05-2024-00002-P003', '3', 6.1553, -75.3755, 2153.5, 'Persea americana', 'Hass', 'INJERTO', 'Vivero El Aguacatal — Reg. ICA 2024-VIV-045', 1715731200000, 45.5, 1.19, 7, 'Trasplante', 1, 'usr_admin_001', 1773253116196);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l2_004', 'lote_002', 'COL-05-2024-00002-P004', '4', 6.1554, -75.3756, 2154, 'Persea americana', 'Hass', 'INJERTO', 'Vivero El Aguacatal — Reg. ICA 2024-VIV-045', 1715731200000, 46, 1.22, 8, 'Trasplante', 1, 'usr_admin_001', 1773253116204);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l2_005', 'lote_002', 'COL-05-2024-00002-P005', '5', 6.1555, -75.37570000000001, 2154.5, 'Persea americana', 'Hass', 'INJERTO', 'Vivero El Aguacatal — Reg. ICA 2024-VIV-045', 1715731200000, 46.5, 1.25, 9, 'Trasplante', 1, 'usr_admin_001', 1773253116211);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l1_006', 'lote_001', 'COL-05-2024-00001-P006', '6', 6.1546, -75.3746, 2151, 'Coffea arabica', 'Castillo Colombia', 'VIVERO_CERTIFICADO', 'Vivero Agroforestal Antioquia — Reg. ICA 2024-VIV-001', 1709251200000, 33, 0.82, 7, 'Plántula', 1, 'usr_admin_001', 1774577745935);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l1_007', 'lote_001', 'COL-05-2024-00001-P007', '7', 6.1547, -75.37469999999999, 2151.5, 'Coffea arabica', 'Castillo Colombia', 'VIVERO_CERTIFICADO', 'Vivero Agroforestal Antioquia — Reg. ICA 2024-VIV-001', 1709251200000, 33.5, 0.84, 8, 'Plántula', 1, 'usr_admin_001', 1774577745949);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l1_008', 'lote_001', 'COL-05-2024-00001-P008', '8', 6.1548, -75.3748, 2152, 'Coffea arabica', 'Castillo Colombia', 'VIVERO_CERTIFICADO', 'Vivero Agroforestal Antioquia — Reg. ICA 2024-VIV-001', 1709251200000, 34, 0.86, 5, 'Plántula', 1, 'usr_admin_001', 1774577745962);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l1_009', 'lote_001', 'COL-05-2024-00001-P009', '9', 6.1549, -75.3749, 2152.5, 'Coffea arabica', 'Castillo Colombia', 'VIVERO_CERTIFICADO', 'Vivero Agroforestal Antioquia — Reg. ICA 2024-VIV-001', 1709251200000, 34.5, 0.8799999999999999, 6, 'Plántula', 1, 'usr_admin_001', 1774577745974);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l1_010', 'lote_001', 'COL-05-2024-00001-P010', '10', 6.155, -75.375, 2153, 'Coffea arabica', 'Castillo Colombia', 'VIVERO_CERTIFICADO', 'Vivero Agroforestal Antioquia — Reg. ICA 2024-VIV-001', 1709251200000, 35, 0.8999999999999999, 7, 'Plántula', 1, 'usr_admin_001', 1774577745986);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l2_006', 'lote_002', 'COL-05-2024-00002-P006', '6', 6.155600000000001, -75.37580000000001, 2155, 'Persea americana', 'Hass', 'INJERTO', 'Vivero El Aguacatal — Reg. ICA 2024-VIV-045', 1715731200000, 47, 1.28, 7, 'Trasplante', 1, 'usr_admin_001', 1774577746009);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l2_007', 'lote_002', 'COL-05-2024-00002-P007', '7', 6.1557, -75.3759, 2155.5, 'Persea americana', 'Hass', 'INJERTO', 'Vivero El Aguacatal — Reg. ICA 2024-VIV-045', 1715731200000, 47.5, 1.31, 8, 'Trasplante', 1, 'usr_admin_001', 1774577746024);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l2_008', 'lote_002', 'COL-05-2024-00002-P008', '8', 6.1558, -75.376, 2156, 'Persea americana', 'Hass', 'INJERTO', 'Vivero El Aguacatal — Reg. ICA 2024-VIV-045', 1715731200000, 48, 1.34, 9, 'Trasplante', 1, 'usr_admin_001', 1774577746039);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l2_009', 'lote_002', 'COL-05-2024-00002-P009', '9', 6.1559, -75.37610000000001, 2156.5, 'Persea americana', 'Hass', 'INJERTO', 'Vivero El Aguacatal — Reg. ICA 2024-VIV-045', 1715731200000, 48.5, 1.37, 7, 'Trasplante', 1, 'usr_admin_001', 1774577746049);
INSERT INTO "plantas" ("id", "loteId", "codigoPlanta", "numeroPlanta", "latitud", "longitud", "altitudMsnm", "especie", "variedad", "origenMaterial", "procedenciaVivero", "fechaSiembra", "alturaCmInicial", "diametroTalloCmInicial", "numHojasInicial", "estadoFenologicoInicial", "activo", "registradoPor", "createdAt") VALUES ('planta_l2_010', 'lote_002', 'COL-05-2024-00002-P010', '10', 6.156000000000001, -75.37620000000001, 2157, 'Persea americana', 'Hass', 'INJERTO', 'Vivero El Aguacatal — Reg. ICA 2024-VIV-045', 1715731200000, 49, 1.4, 8, 'Trasplante', 1, 'usr_admin_001', 1774577746059);

-- Tabla: predios
DROP TABLE IF EXISTS "predios";
CREATE TABLE "predios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agricultorId" TEXT NOT NULL,
    "nombrePredio" TEXT NOT NULL,
    "codigoIca" TEXT,
    "matriculaInmobiliaria" TEXT,
    "departamento" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "vereda" TEXT,
    "direccion" TEXT,
    "latitud" REAL NOT NULL,
    "longitud" REAL NOT NULL,
    "altitudMsnm" REAL,
    "areaTotalHa" REAL NOT NULL,
    "areaProductivaHa" REAL,
    "areaBosqueHa" REAL,
    "areaViverosHa" REAL,
    "fuenteAgua" TEXT,
    "tipoSuelo" TEXT,
    "pendientePct" REAL,
    "usoPrevio" TEXT,
    "certifUsoSuelo" TEXT,
    "tieneBodegaAgroquimicos" BOOLEAN NOT NULL DEFAULT false,
    "tieneAguaPotable" BOOLEAN NOT NULL DEFAULT false,
    "tieneSSSBasicas" BOOLEAN NOT NULL DEFAULT false,
    "tieneZonaAcopio" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "predios_agricultorId_fkey" FOREIGN KEY ("agricultorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "predios_codigoIca_key" ON "predios"("codigoIca");
INSERT INTO "predios" ("id", "agricultorId", "nombrePredio", "codigoIca", "matriculaInmobiliaria", "departamento", "municipio", "vereda", "direccion", "latitud", "longitud", "altitudMsnm", "areaTotalHa", "areaProductivaHa", "areaBosqueHa", "areaViverosHa", "fuenteAgua", "tipoSuelo", "pendientePct", "usoPrevio", "certifUsoSuelo", "tieneBodegaAgroquimicos", "tieneAguaPotable", "tieneSSSBasicas", "tieneZonaAcopio", "activo", "createdAt", "updatedAt") VALUES ('pred_001', 'usr_agricultor_001', 'Finca El Paraiso', 'ANT-05-2024-00001', NULL, '05', '05615', 'La Quiebra', NULL, 6.1538, -75.3741, 2150, 8.5, 6, NULL, NULL, 'RIO', 'Franco arcilloso', NULL, 'Pastizal', NULL, 0, 0, 0, 0, 1, 1773253116073, 1773253116073);

-- Tabla: registros_planta
DROP TABLE IF EXISTS "registros_planta";
CREATE TABLE "registros_planta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campanaId" TEXT NOT NULL,
    "plantaId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fechaEvento" DATETIME,
    "contentHash" TEXT,
    "txHash" TEXT,
    "syncEstado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "adulteradoDetectadoEn" DATETIME,
    "adulteradoDetectadoPor" TEXT,
    "registroReemplazanteId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "consecutivo" INTEGER,
    CONSTRAINT "registros_planta_campanaId_fkey" FOREIGN KEY ("campanaId") REFERENCES "campanas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "registros_planta_plantaId_fkey" FOREIGN KEY ("plantaId") REFERENCES "plantas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "registros_planta_campanaId_plantaId_idx" ON "registros_planta"("campanaId", "plantaId");
INSERT INTO "registros_planta" ("id", "campanaId", "plantaId", "estado", "fechaEvento", "contentHash", "txHash", "syncEstado", "adulteradoDetectadoEn", "adulteradoDetectadoPor", "registroReemplazanteId", "createdAt", "updatedAt", "consecutivo") VALUES ('cmmxtlsp70001blcceujlu038', 'campana_001', 'planta_l1_002', 'COMPLETO', 1773945931146, '6a30c5ac53a8e6860cadcabb59aa3c35341c3997dc0c55ee2387377ed2b4af55', NULL, 'PENDIENTE', NULL, NULL, NULL, 1773945931148, 1773955139599, 1);
INSERT INTO "registros_planta" ("id", "campanaId", "plantaId", "estado", "fechaEvento", "contentHash", "txHash", "syncEstado", "adulteradoDetectadoEn", "adulteradoDetectadoPor", "registroReemplazanteId", "createdAt", "updatedAt", "consecutivo") VALUES ('cmmxyce170004bli83hkp8cz9', 'campana_001', 'planta_l1_001', 'COMPLETO', 1773953890303, '6f42a8297ef8413c2022324d3db15283233be062a000e874934988b8855d9af3', NULL, 'PENDIENTE', NULL, NULL, NULL, 1773953890316, 1773955139620, 2);
INSERT INTO "registros_planta" ("id", "campanaId", "plantaId", "estado", "fechaEvento", "contentHash", "txHash", "syncEstado", "adulteradoDetectadoEn", "adulteradoDetectadoPor", "registroReemplazanteId", "createdAt", "updatedAt", "consecutivo") VALUES ('cmmy5fdot0001bl0carboxv2v', 'campana_001', 'planta_l1_003', 'COMPLETO', 1773965787134, 'a3f67da478328cbecabc533ea78fa93fc3da11837b3e82ddee7196d65b444010', NULL, 'PENDIENTE', NULL, NULL, NULL, 1773965787150, 1773968009051, 3);
INSERT INTO "registros_planta" ("id", "campanaId", "plantaId", "estado", "fechaEvento", "contentHash", "txHash", "syncEstado", "adulteradoDetectadoEn", "adulteradoDetectadoPor", "registroReemplazanteId", "createdAt", "updatedAt", "consecutivo") VALUES ('cmmy74pwa0005bloo46kwarug', 'campana_001', 'planta_l1_005', 'COMPLETO', 1773968648984, 'c11690055fc7c4217cb562cbdcd4105c2a43a64129ea90eebbdf82ec70e289c6', NULL, 'PENDIENTE', NULL, NULL, NULL, 1773968648986, 1773969134057, 4);
INSERT INTO "registros_planta" ("id", "campanaId", "plantaId", "estado", "fechaEvento", "contentHash", "txHash", "syncEstado", "adulteradoDetectadoEn", "adulteradoDetectadoPor", "registroReemplazanteId", "createdAt", "updatedAt", "consecutivo") VALUES ('cmmy77nul000bbloo1rvbpxz4', 'campana_001', 'planta_l1_004', 'COMPLETO', 1773968786296, '4b852d5fc25119303a184c7eb0aca93a6dff82ad2b86281efe63526e55b84e81', NULL, 'PENDIENTE', NULL, NULL, NULL, 1773968786301, 1773969084412, 5);

-- Tabla: registros_riego
DROP TABLE IF EXISTS "registros_riego";
CREATE TABLE "registros_riego" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventoId" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "fuenteAgua" TEXT NOT NULL,
    "metodoRiego" TEXT,
    "volumenM3" REAL,
    "duracionHoras" REAL,
    "analisisAguaCid" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registros_riego_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos_produccion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "registros_riego_eventoId_key" ON "registros_riego"("eventoId");

-- Tabla: usuario_organizacion
DROP TABLE IF EXISTS "usuario_organizacion";
CREATE TABLE "usuario_organizacion" (
    "usuarioId" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "cargo" TEXT,

    PRIMARY KEY ("usuarioId", "organizacionId"),
    CONSTRAINT "usuario_organizacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "usuario_organizacion_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "usuario_organizacion" ("usuarioId", "organizacionId", "cargo") VALUES ('usr_inspector_001', 'org_certificadora_demo', 'Inspector BPA Senior');
INSERT INTO "usuario_organizacion" ("usuarioId", "organizacionId", "cargo") VALUES ('usr_certificadora_001', 'org_certificadora_demo', 'Certificadora BPA Senior');

-- Tabla: usuarios
DROP TABLE IF EXISTS "usuarios";
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "walletAddress" TEXT,
    "passwordHash" TEXT,
    "rol" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "usuarios_numeroDocumento_key" ON "usuarios"("numeroDocumento");
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
CREATE UNIQUE INDEX "usuarios_walletAddress_key" ON "usuarios"("walletAddress");
INSERT INTO "usuarios" ("id", "nombres", "apellidos", "tipoDocumento", "numeroDocumento", "email", "telefono", "walletAddress", "passwordHash", "rol", "activo", "createdAt", "updatedAt") VALUES ('usr_admin_001', 'Admin', 'AgroChain', 'CC', '1000000001', 'admin@agrochain.co', '3001234567', NULL, 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'ADMIN', 1, 1773253115998, 1774578729257);
INSERT INTO "usuarios" ("id", "nombres", "apellidos", "tipoDocumento", "numeroDocumento", "email", "telefono", "walletAddress", "passwordHash", "rol", "activo", "createdAt", "updatedAt") VALUES ('usr_agricultor_001', 'Carlos Alberto', 'Gomez Zapata', 'CC', '1032456789', 'agricultor@agrochain.co', '3112345678', NULL, 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'AGRICULTOR', 1, 1773253116007, 1774578729274);
INSERT INTO "usuarios" ("id", "nombres", "apellidos", "tipoDocumento", "numeroDocumento", "email", "telefono", "walletAddress", "passwordHash", "rol", "activo", "createdAt", "updatedAt") VALUES ('usr_inspector_001', 'Maria Fernanda', 'Torres Rincon', 'CC', '79865432', 'inspector@agrochain.co', '3209876543', NULL, 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'INSPECTOR_BPA', 1, 1773253116015, 1774578729290);
INSERT INTO "usuarios" ("id", "nombres", "apellidos", "tipoDocumento", "numeroDocumento", "email", "telefono", "walletAddress", "passwordHash", "rol", "activo", "createdAt", "updatedAt") VALUES ('usr_tecnico_001', 'Juan Carlos', 'Perez Lopez', 'CC', '1001001001', 'tecnico1@agrochain.co', NULL, NULL, 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'TECNICO', 1, 1773253116034, 1774578729320);
INSERT INTO "usuarios" ("id", "nombres", "apellidos", "tipoDocumento", "numeroDocumento", "email", "telefono", "walletAddress", "passwordHash", "rol", "activo", "createdAt", "updatedAt") VALUES ('usr_tecnico_002', 'Maria Isabel', 'Gomez Ruiz', 'CC', '1001001002', 'tecnico2@agrochain.co', NULL, NULL, 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'TECNICO', 1, 1773253116043, 1774578729335);
INSERT INTO "usuarios" ("id", "nombres", "apellidos", "tipoDocumento", "numeroDocumento", "email", "telefono", "walletAddress", "passwordHash", "rol", "activo", "createdAt", "updatedAt") VALUES ('usr_tecnico_003', 'Luis Fernando', 'Torres Silva', 'CC', '1001001003', 'tecnico3@agrochain.co', NULL, NULL, 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'TECNICO', 1, 1773253116052, 1774578729345);
INSERT INTO "usuarios" ("id", "nombres", "apellidos", "tipoDocumento", "numeroDocumento", "email", "telefono", "walletAddress", "passwordHash", "rol", "activo", "createdAt", "updatedAt") VALUES ('usr_tecnico_004', 'Ana Patricia', 'Diaz Moreno', 'CC', '1001001004', 'tecnico4@agrochain.co', NULL, NULL, 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'TECNICO', 1, 1773253116063, 1774578729352);
INSERT INTO "usuarios" ("id", "nombres", "apellidos", "tipoDocumento", "numeroDocumento", "email", "telefono", "walletAddress", "passwordHash", "rol", "activo", "createdAt", "updatedAt") VALUES ('usr_certificadora_001', 'Sandra Milena', 'Ospina Vargas', 'CC', '52789012', 'certificador@agrochain.co', '3156789012', NULL, 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'CERTIFICADORA', 1, 1774577745849, 1774578729305);

-- Tabla: verificaciones_hash_campana
DROP TABLE IF EXISTS "verificaciones_hash_campana";
CREATE TABLE "verificaciones_hash_campana" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campanaId" TEXT NOT NULL,
    "ejecutadoPorId" TEXT NOT NULL,
    "fechaVerificacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ok" BOOLEAN NOT NULL,
    "hashGuardado" TEXT NOT NULL,
    "hashRecalculado" TEXT NOT NULL,
    "totalRegistros" INTEGER NOT NULL,
    CONSTRAINT "verificaciones_hash_campana_campanaId_fkey" FOREIGN KEY ("campanaId") REFERENCES "campanas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "verificaciones_hash_campana_ejecutadoPorId_fkey" FOREIGN KEY ("ejecutadoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "verificaciones_hash_campana" ("id", "campanaId", "ejecutadoPorId", "fechaVerificacion", "ok", "hashGuardado", "hashRecalculado", "totalRegistros") VALUES ('cmn3skvx00001bl5002c4usx4', 'campana_001', 'usr_admin_001', 1774307006093, 1, 'f3dec08dc006c87d6404deeac6c79eb047b6438265b0efdff522196387224faa', 'f3dec08dc006c87d6404deeac6c79eb047b6438265b0efdff522196387224faa', 5);

-- Tabla: verificaciones_integridad
DROP TABLE IF EXISTS "verificaciones_integridad";
CREATE TABLE "verificaciones_integridad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campanaId" TEXT NOT NULL,
    "ejecutadoPorId" TEXT NOT NULL,
    "fechaVerificacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRegistros" INTEGER NOT NULL,
    "aprobados" INTEGER NOT NULL,
    "adulterados" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    CONSTRAINT "verificaciones_integridad_campanaId_fkey" FOREIGN KEY ("campanaId") REFERENCES "campanas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "verificaciones_integridad_ejecutadoPorId_fkey" FOREIGN KEY ("ejecutadoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "verificaciones_integridad" ("id", "campanaId", "ejecutadoPorId", "fechaVerificacion", "totalRegistros", "aprobados", "adulterados", "ok") VALUES ('cmmxy5tq70001bli8socxnmos', 'campana_001', 'usr_admin_001', 1773953584064, 1, 1, 0, 1);
INSERT INTO "verificaciones_integridad" ("id", "campanaId", "ejecutadoPorId", "fechaVerificacion", "totalRegistros", "aprobados", "adulterados", "ok") VALUES ('cmmxz3pjy0001bldgu0sbbzu7', 'campana_001', 'usr_admin_001', 1773955164959, 2, 2, 0, 1);
INSERT INTO "verificaciones_integridad" ("id", "campanaId", "ejecutadoPorId", "fechaVerificacion", "totalRegistros", "aprobados", "adulterados", "ok") VALUES ('cmmy7ib0k000pbloov852kqxl', 'campana_001', 'usr_admin_001', 1773969282885, 5, 5, 0, 1);

-- Tabla: verificaciones_registro_detalle
DROP TABLE IF EXISTS "verificaciones_registro_detalle";
CREATE TABLE "verificaciones_registro_detalle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "verificacionId" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "plantaId" TEXT NOT NULL,
    "hashGuardado" TEXT NOT NULL,
    "hashCalculado" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    CONSTRAINT "verificaciones_registro_detalle_verificacionId_fkey" FOREIGN KEY ("verificacionId") REFERENCES "verificaciones_integridad" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "verificaciones_registro_detalle" ("id", "verificacionId", "registroId", "plantaId", "hashGuardado", "hashCalculado", "resultado") VALUES ('cmmxy5tq70002bli8wf1xwvvt', 'cmmxy5tq70001bli8socxnmos', 'cmmxtlsp70001blcceujlu038', 'planta_l1_002', '6a30c5ac53a8e6860cadcabb59aa3c35341c3997dc0c55ee2387377ed2b4af55', '6a30c5ac53a8e6860cadcabb59aa3c35341c3997dc0c55ee2387377ed2b4af55', 'OK');
INSERT INTO "verificaciones_registro_detalle" ("id", "verificacionId", "registroId", "plantaId", "hashGuardado", "hashCalculado", "resultado") VALUES ('cmmxz3pjy0002bldg8yg8pudz', 'cmmxz3pjy0001bldgu0sbbzu7', 'cmmxyce170004bli83hkp8cz9', 'planta_l1_001', '6f42a8297ef8413c2022324d3db15283233be062a000e874934988b8855d9af3', '6f42a8297ef8413c2022324d3db15283233be062a000e874934988b8855d9af3', 'OK');
INSERT INTO "verificaciones_registro_detalle" ("id", "verificacionId", "registroId", "plantaId", "hashGuardado", "hashCalculado", "resultado") VALUES ('cmmxz3pjy0003bldgm9skit7e', 'cmmxz3pjy0001bldgu0sbbzu7', 'cmmxtlsp70001blcceujlu038', 'planta_l1_002', '6a30c5ac53a8e6860cadcabb59aa3c35341c3997dc0c55ee2387377ed2b4af55', '6a30c5ac53a8e6860cadcabb59aa3c35341c3997dc0c55ee2387377ed2b4af55', 'OK');
INSERT INTO "verificaciones_registro_detalle" ("id", "verificacionId", "registroId", "plantaId", "hashGuardado", "hashCalculado", "resultado") VALUES ('cmmy7ib0l000qbloojr0zj4zn', 'cmmy7ib0k000pbloov852kqxl', 'cmmxyce170004bli83hkp8cz9', 'planta_l1_001', '6f42a8297ef8413c2022324d3db15283233be062a000e874934988b8855d9af3', '6f42a8297ef8413c2022324d3db15283233be062a000e874934988b8855d9af3', 'OK');
INSERT INTO "verificaciones_registro_detalle" ("id", "verificacionId", "registroId", "plantaId", "hashGuardado", "hashCalculado", "resultado") VALUES ('cmmy7ib0l000rblooyccit5mn', 'cmmy7ib0k000pbloov852kqxl', 'cmmxtlsp70001blcceujlu038', 'planta_l1_002', '6a30c5ac53a8e6860cadcabb59aa3c35341c3997dc0c55ee2387377ed2b4af55', '6a30c5ac53a8e6860cadcabb59aa3c35341c3997dc0c55ee2387377ed2b4af55', 'OK');
INSERT INTO "verificaciones_registro_detalle" ("id", "verificacionId", "registroId", "plantaId", "hashGuardado", "hashCalculado", "resultado") VALUES ('cmmy7ib0l000sbloo9u8y91vv', 'cmmy7ib0k000pbloov852kqxl', 'cmmy5fdot0001bl0carboxv2v', 'planta_l1_003', 'a3f67da478328cbecabc533ea78fa93fc3da11837b3e82ddee7196d65b444010', 'a3f67da478328cbecabc533ea78fa93fc3da11837b3e82ddee7196d65b444010', 'OK');
INSERT INTO "verificaciones_registro_detalle" ("id", "verificacionId", "registroId", "plantaId", "hashGuardado", "hashCalculado", "resultado") VALUES ('cmmy7ib0l000tblooogkck1i9', 'cmmy7ib0k000pbloov852kqxl', 'cmmy77nul000bbloo1rvbpxz4', 'planta_l1_004', '4b852d5fc25119303a184c7eb0aca93a6dff82ad2b86281efe63526e55b84e81', '4b852d5fc25119303a184c7eb0aca93a6dff82ad2b86281efe63526e55b84e81', 'OK');
INSERT INTO "verificaciones_registro_detalle" ("id", "verificacionId", "registroId", "plantaId", "hashGuardado", "hashCalculado", "resultado") VALUES ('cmmy7ib0l000ubloo4jgev9bw', 'cmmy7ib0k000pbloov852kqxl', 'cmmy74pwa0005bloo46kwarug', 'planta_l1_005', 'c11690055fc7c4217cb562cbdcd4105c2a43a64129ea90eebbdf82ec70e289c6', 'c11690055fc7c4217cb562cbdcd4105c2a43a64129ea90eebbdf82ec70e289c6', 'OK');

COMMIT;
PRAGMA foreign_keys=ON;