// =============================================================================
// NUMERALES NTC 5400 - Buenas Practicas Agricolas Colombia
// Fuente: ICONTEC NTC 5400:2005 (actualizada)
// =============================================================================

export const numeralesNtc5400 = [
  // ── 4.1 INSTALACIONES Y EQUIPOS ─────────────────────────────────────────
  { codigo: "4.1.1", seccion: "4.1 Instalaciones y equipos", descripcion: "El predio cuenta con bodega de almacenamiento de insumos agricolas separada de la vivienda", criticidad: "CRITICO", aplica: "TODOS" },
  { codigo: "4.1.2", seccion: "4.1 Instalaciones y equipos", descripcion: "La bodega de agroquimicos tiene ventilacion, piso impermeable y esta bajo llave", criticidad: "CRITICO", aplica: "TODOS" },
  { codigo: "4.1.3", seccion: "4.1 Instalaciones y equipos", descripcion: "Los equipos de aplicacion se calibran y mantienen en buen estado", criticidad: "MAYOR", aplica: "TODOS" },
  { codigo: "4.1.4", seccion: "4.1 Instalaciones y equipos", descripcion: "Existe area para lavado y mantenimiento de equipos de aplicacion", criticidad: "MAYOR", aplica: "TODOS" },

  // ── 4.2 SUELO ────────────────────────────────────────────────────────────
  { codigo: "4.2.1", seccion: "4.2 Suelo", descripcion: "Se dispone de analisis de suelos con vigencia no mayor a 3 anos", criticidad: "MAYOR", aplica: "TODOS" },
  { codigo: "4.2.2", seccion: "4.2 Suelo", descripcion: "Se implementan practicas de conservacion de suelos (curvas de nivel, barreras vivas)", criticidad: "MAYOR", aplica: "TODOS" },
  { codigo: "4.2.3", seccion: "4.2 Suelo", descripcion: "Los planes de fertilizacion se basan en analisis de suelo", criticidad: "MAYOR", aplica: "TODOS" },
  { codigo: "4.2.4", seccion: "4.2 Suelo", descripcion: "Se evita la contaminacion del suelo con residuos de cosecha sin compostar", criticidad: "MENOR", aplica: "TODOS" },

  // ── 4.3 MATERIAL VEGETAL ─────────────────────────────────────────────────
  { codigo: "4.3.1", seccion: "4.3 Material vegetal", descripcion: "El material de siembra proviene de viveros certificados o con aval ICA", criticidad: "CRITICO", aplica: "TODOS" },
  { codigo: "4.3.2", seccion: "4.3 Material vegetal", descripcion: "Se verifica la sanidad del material vegetal antes de la siembra", criticidad: "MAYOR", aplica: "TODOS" },
  { codigo: "4.3.3", seccion: "4.3 Material vegetal", descripcion: "Se cuenta con registros del origen del material vegetal utilizado", criticidad: "MAYOR", aplica: "TODOS" },

  // ── 4.4 FERTILIZACION ────────────────────────────────────────────────────
  { codigo: "4.4.1", seccion: "4.4 Fertilizacion", descripcion: "Los fertilizantes utilizados estan registrados ante el ICA", criticidad: "CRITICO", aplica: "TODOS" },
  { codigo: "4.4.2", seccion: "4.4 Fertilizacion", descripcion: "Se lleva registro de todas las aplicaciones de fertilizantes (fecha, dosis, metodo)", criticidad: "MAYOR", aplica: "TODOS" },
  { codigo: "4.4.3", seccion: "4.4 Fertilizacion", descripcion: "Los abonos organicos utilizados (compost, lombricompost) estan compostados correctamente", criticidad: "MAYOR", aplica: "TODOS" },
  { codigo: "4.4.4", seccion: "4.4 Fertilizacion", descripcion: "No se utiliza biosólidos de aguas residuales sin tratamiento previo", criticidad: "CRITICO", aplica: "TODOS" },

  // ── 4.5 RIEGO ────────────────────────────────────────────────────────────
  { codigo: "4.5.1", seccion: "4.5 Riego", descripcion: "El agua de riego cumple con los criterios de calidad para uso agricola (IDEAM/MADS)", criticidad: "CRITICO", aplica: "RIEGO_ARTIFICIAL" },
  { codigo: "4.5.2", seccion: "4.5 Riego", descripcion: "Se dispone de analisis de calidad del agua de riego con vigencia no mayor a 1 ano", criticidad: "MAYOR", aplica: "RIEGO_ARTIFICIAL" },
  { codigo: "4.5.3", seccion: "4.5 Riego", descripcion: "El sistema de riego es eficiente y evita el encharcamiento", criticidad: "MENOR", aplica: "RIEGO_ARTIFICIAL" },
  { codigo: "4.5.4", seccion: "4.5 Riego", descripcion: "No se usa agua residual para riego sin tratamiento previo certificado", criticidad: "CRITICO", aplica: "RIEGO_ARTIFICIAL" },

  // ── 4.6 MANEJO INTEGRADO DE PLAGAS Y ENFERMEDADES ───────────────────────
  { codigo: "4.6.1", seccion: "4.6 MIP", descripcion: "Se implementa Manejo Integrado de Plagas (MIP) como primera estrategia", criticidad: "MAYOR", aplica: "TODOS" },
  { codigo: "4.6.2", seccion: "4.6 MIP", descripcion: "Se realizan monitoreos periodicos de plagas y enfermedades con registros", criticidad: "MAYOR", aplica: "TODOS" },
  { codigo: "4.6.3", seccion: "4.6 MIP", descripcion: "Se identifican correctamente las plagas/enfermedades antes de aplicar control quimico", criticidad: "MAYOR", aplica: "TODOS" },

  // ── 4.7 AGROQUIMICOS ─────────────────────────────────────────────────────
  { codigo: "4.7.1", seccion: "4.7 Agroquimicos", descripcion: "Solo se usan agroquimicos con Registro ICA vigente", criticidad: "CRITICO", aplica: "TODOS" },
  { codigo: "4.7.2", seccion: "4.7 Agroquimicos", descripcion: "Se respetan los periodos de carencia antes de la cosecha", criticidad: "CRITICO", aplica: "TODOS" },
  { codigo: "4.7.3", seccion: "4.7 Agroquimicos", descripcion: "El aplicador usa el Equipo de Proteccion Personal (EPP) completo", criticidad: "CRITICO", aplica: "TODOS" },
  { codigo: "4.7.4", seccion: "4.7 Agroquimicos", descripcion: "Se llevan registros completos de cada aplicacion (producto, dosis, fecha, operario)", criticidad: "CRITICO", aplica: "TODOS" },
  { codigo: "4.7.5", seccion: "4.7 Agroquimicos", descripcion: "Los envases vacios se tratan segun programa Campo Limpio (triple lavado)", criticidad: "MAYOR", aplica: "TODOS" },
  { codigo: "4.7.6", seccion: "4.7 Agroquimicos", descripcion: "No se usan productos de categoria toxicologica I (rojo) en cultivos de exportacion", criticidad: "CRITICO", aplica: "EXPORTACION" },
  { codigo: "4.7.7", seccion: "4.7 Agroquimicos", descripcion: "Los agroquimicos se almacenan en su envase original con etiqueta legible", criticidad: "MAYOR", aplica: "TODOS" },

  // ── 4.8 COSECHA Y POSTCOSECHA ────────────────────────────────────────────
  { codigo: "4.8.1", seccion: "4.8 Cosecha y postcosecha", descripcion: "Los implementos de cosecha estan limpios y desinfectados", criticidad: "MAYOR", aplica: "TODOS" },
  { codigo: "4.8.2", seccion: "4.8 Cosecha y postcosecha", descripcion: "Se verifica que el periodo de carencia de agroquimicos ha concluido antes de cosechar", criticidad: "CRITICO", aplica: "TODOS" },
  { codigo: "4.8.3", seccion: "4.8 Cosecha y postcosecha", descripcion: "El producto cosechado no tiene contacto con el suelo durante la recoleccion", criticidad: "MAYOR", aplica: "TODOS" },
  { codigo: "4.8.4", seccion: "4.8 Cosecha y postcosecha", descripcion: "Se lleva registro de volumen cosechado por lote", criticidad: "MAYOR", aplica: "TODOS" },

  // ── 4.9 HIGIENE Y BIENESTAR DEL TRABAJADOR ───────────────────────────────
  { codigo: "4.9.1", seccion: "4.9 Higiene y bienestar", descripcion: "Los trabajadores tienen acceso a agua potable y servicios sanitarios en campo", criticidad: "CRITICO", aplica: "TODOS" },
  { codigo: "4.9.2", seccion: "4.9 Higiene y bienestar", descripcion: "Se cuenta con botiquin de primeros auxilios en campo", criticidad: "MAYOR", aplica: "TODOS" },
  { codigo: "4.9.3", seccion: "4.9 Higiene y bienestar", descripcion: "Los trabajadores reciben capacitacion en BPA e higiene personal", criticidad: "MAYOR", aplica: "TODOS" },
  { codigo: "4.9.4", seccion: "4.9 Higiene y bienestar", descripcion: "No trabajan menores de edad en actividades de riesgo (aplicacion agroquimicos)", criticidad: "CRITICO", aplica: "TODOS" },

  // ── 4.10 MEDIO AMBIENTE ──────────────────────────────────────────────────
  { codigo: "4.10.1", seccion: "4.10 Medio ambiente", descripcion: "Se conservan las zonas de proteccion de fuentes de agua (30m rios, 15m quebradas)", criticidad: "CRITICO", aplica: "TODOS" },
  { codigo: "4.10.2", seccion: "4.10 Medio ambiente", descripcion: "Los residuos solidos se clasifican y disponen adecuadamente", criticidad: "MAYOR", aplica: "TODOS" },
  { codigo: "4.10.3", seccion: "4.10 Medio ambiente", descripcion: "Se tienen practicas de conservacion de biodiversidad en el predio", criticidad: "MENOR", aplica: "TODOS" },

  // ── 4.11 TRAZABILIDAD ───────────────────────────────────────────────────
  { codigo: "4.11.1", seccion: "4.11 Trazabilidad", descripcion: "El sistema permite identificar el origen de cualquier unidad de producto", criticidad: "CRITICO", aplica: "TODOS" },
  { codigo: "4.11.2", seccion: "4.11 Trazabilidad", descripcion: "Se lleva registro de lotes con identificacion unica", criticidad: "CRITICO", aplica: "TODOS" },
  { codigo: "4.11.3", seccion: "4.11 Trazabilidad", descripcion: "Los registros se conservan por minimo 2 anos despues de la cosecha", criticidad: "MAYOR", aplica: "TODOS" },
] as const;
