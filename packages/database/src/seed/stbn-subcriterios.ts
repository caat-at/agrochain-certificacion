// =============================================================================
// SUBCRITERIOS STBN — PNSS 0000404, PlanetAI Nature Space
// Fuente: MT_STBN V3.0_EN, Seccion 8 "Evaluation" (texto oficial en ingles,
// se mantiene sin traducir para fidelidad al documento de certificacion).
// Los campos *Es son la traduccion al espanol usada en la UI del evaluador
// colombiano — el ingles queda como referencia trazable al documento
// original ante una auditoria internacional.
// 10 subcriterios fijos — 5 pilares evaluables manualmente x 2 c/u.
// El pilar EUDR (40pts) no esta aqui, se calcula aparte (ver 02_eudr.sql).
// =============================================================================

export const stbnSubcriterios = [
  // ── 1. Conservation and Restoration of Ecosystems (15 pts) ────────────────
  {
    codigo: "CONS_A",
    pilar: "CONSERVACION",
    nombre: "Active conservation of critical ecosystems",
    nombreEs: "Conservación activa de ecosistemas críticos",
    orden: 1,
    puntajeAlto: 7.5,
    puntajeBajo: 3.5,
    descripcionAlto:
      "The project demonstrates a clear and measurable commitment to conserving or restoring key ecosystems such as forests, mangroves, wetlands, or coastal habitats.",
    descripcionAltoEs:
      "El proyecto demuestra un compromiso claro y medible con la conservación o restauración de ecosistemas clave como bosques, manglares, humedales o hábitats costeros.",
    descripcionBajo: "Conservation actions are limited or not systematically monitored.",
    descripcionBajoEs: "Las acciones de conservación son limitadas o no se monitorean sistemáticamente.",
  },
  {
    codigo: "CONS_B",
    pilar: "CONSERVACION",
    nombre: "Active restoration of degraded ecosystems",
    nombreEs: "Restauración activa de ecosistemas degradados",
    orden: 2,
    puntajeAlto: 7.5,
    puntajeBajo: 3.5,
    descripcionAlto:
      "The project implements active restoration practices in degraded areas using regenerative methods that improve biodiversity and ecosystem services.",
    descripcionAltoEs:
      "El proyecto implementa prácticas de restauración activa en áreas degradadas mediante métodos regenerativos que mejoran la biodiversidad y los servicios ecosistémicos.",
    descripcionBajo: "Restoration is partial or limited to passive protection.",
    descripcionBajoEs: "La restauración es parcial o se limita a la protección pasiva.",
  },

  // ── 2. Community Participation and Use of Ancestral Knowledge (10 pts) ────
  {
    codigo: "COMU_A",
    pilar: "COMUNIDAD",
    nombre: "Effective integration of local communities",
    nombreEs: "Integración efectiva de las comunidades locales",
    orden: 1,
    puntajeAlto: 5,
    puntajeBajo: 2.5,
    descripcionAlto:
      "Indigenous and local communities participate actively in project planning, governance, and implementation.",
    descripcionAltoEs:
      "Las comunidades indígenas y locales participan activamente en la planificación, gobernanza e implementación del proyecto.",
    descripcionBajo: "Participation is consultative rather than active.",
    descripcionBajoEs: "La participación es consultiva en lugar de activa.",
  },
  {
    codigo: "COMU_B",
    pilar: "COMUNIDAD",
    nombre: "Integration of ancestral knowledge",
    nombreEs: "Integración del conocimiento ancestral",
    orden: 2,
    puntajeAlto: 5,
    puntajeBajo: 2.5,
    descripcionAlto:
      "Ancestral and traditional practices are demonstrably integrated into natural resource management.",
    descripcionAltoEs:
      "Las prácticas ancestrales y tradicionales están integradas de forma demostrable en la gestión de los recursos naturales.",
    descripcionBajo: "Integration is partial or indirect.",
    descripcionBajoEs: "La integración es parcial o indirecta.",
  },

  // ── 3. Social Justice and Equitable Distribution of Benefits (10 pts) ─────
  {
    codigo: "JUST_A",
    pilar: "JUSTICIA_SOCIAL",
    nombre: "Local job creation and fair benefit sharing",
    nombreEs: "Creación de empleo local y reparto justo de beneficios",
    orden: 1,
    puntajeAlto: 5,
    puntajeBajo: 2.5,
    descripcionAlto:
      "The project ensures equitable distribution of economic, social, and environmental benefits, particularly for vulnerable groups.",
    descripcionAltoEs:
      "El proyecto garantiza una distribución equitativa de los beneficios económicos, sociales y ambientales, particularmente para grupos vulnerables.",
    descripcionBajo: "Benefit sharing is limited or uneven.",
    descripcionBajoEs: "El reparto de beneficios es limitado o desigual.",
  },
  {
    codigo: "JUST_B",
    pilar: "JUSTICIA_SOCIAL",
    nombre: "Positive social and environmental equity impact",
    nombreEs: "Impacto positivo en la equidad social y ambiental",
    orden: 2,
    puntajeAlto: 5,
    puntajeBajo: 2.5,
    descripcionAlto:
      "The project demonstrates a clear positive contribution to equity and justice within its operational area.",
    descripcionAltoEs:
      "El proyecto demuestra una contribución positiva clara a la equidad y la justicia dentro de su área de operación.",
    descripcionBajo: "Social impact is limited or indirect.",
    descripcionBajoEs: "El impacto social es limitado o indirecto.",
  },

  // ── 4. Implementation of Advanced Technologies (10 pts) ────────────────────
  {
    codigo: "TECH_A",
    pilar: "TECNOLOGIA",
    nombre: "Use of AI, drones, and sensors for continuous monitoring",
    nombreEs: "Uso de IA, drones y sensores para monitoreo continuo",
    orden: 1,
    puntajeAlto: 5,
    puntajeBajo: 2.5,
    descripcionAlto:
      "The project effectively applies advanced technologies to feed the PNS monitoring system and perform real-time ecosystem tracking.",
    descripcionAltoEs:
      "El proyecto aplica de forma efectiva tecnologías avanzadas para alimentar el sistema de monitoreo PNS y realizar seguimiento del ecosistema en tiempo real.",
    descripcionBajo: "Technology use is limited or lacks integration.",
    descripcionBajoEs: "El uso de tecnología es limitado o carece de integración.",
  },
  {
    codigo: "TECH_B",
    pilar: "TECNOLOGIA",
    nombre: "Early-warning systems for climate risks",
    nombreEs: "Sistemas de alerta temprana para riesgos climáticos",
    orden: 2,
    puntajeAlto: 5,
    puntajeBajo: 2.5,
    descripcionAlto:
      "Early-warning systems are operational for events such as floods, wildfires, or droughts.",
    descripcionAltoEs:
      "Los sistemas de alerta temprana están operativos para eventos como inundaciones, incendios forestales o sequías.",
    descripcionBajo: "Such systems are only partially implemented.",
    descripcionBajoEs: "Dichos sistemas están implementados solo parcialmente.",
  },

  // ── 5. Human Rights and Cultural Preservation (15 pts) ─────────────────────
  {
    codigo: "DDHH_A",
    pilar: "DERECHOS_HUMANOS",
    nombre: "Human Rights Compliance",
    nombreEs: "Cumplimiento de derechos humanos",
    orden: 1,
    puntajeAlto: 7.5,
    puntajeBajo: 3.5,
    descripcionAlto:
      "The project demonstrates full compliance with human rights standards and actively respects the rights of Indigenous peoples and local communities throughout its value chain.",
    descripcionAltoEs:
      "El proyecto demuestra cumplimiento total de los estándares de derechos humanos y respeta activamente los derechos de los pueblos indígenas y las comunidades locales a lo largo de su cadena de valor.",
    descripcionBajo:
      "Compliance is partial, unverified, or limited to policy statements without concrete implementation.",
    descripcionBajoEs:
      "El cumplimiento es parcial, no verificado, o se limita a declaraciones de política sin implementación concreta.",
  },
  {
    codigo: "DDHH_B",
    pilar: "DERECHOS_HUMANOS",
    nombre: "Contribution to Social and Cultural Cohesion",
    nombreEs: "Contribución a la cohesión social y cultural",
    orden: 2,
    puntajeAlto: 7.5,
    puntajeBajo: 3.5,
    descripcionAlto: "The project strengthens community identity, traditions, and cohesion.",
    descripcionAltoEs: "El proyecto fortalece la identidad, las tradiciones y la cohesión de la comunidad.",
    descripcionBajo: "The contribution is limited or lacks measurable outcomes.",
    descripcionBajoEs: "La contribución es limitada o carece de resultados medibles.",
  },
];
