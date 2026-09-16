// =============================================================================
// SUBCRITERIOS STBN — PNSS 0000404, PlanetAI Nature Space
// Fuente: MT_STBN V3.0_EN, Seccion 8 "Evaluation" (texto oficial en ingles,
// se mantiene sin traducir para fidelidad al documento de certificacion).
// 10 subcriterios fijos — 5 pilares evaluables manualmente x 2 c/u.
// El pilar EUDR (40pts) no esta aqui, se calcula aparte (ver 02_eudr.sql).
// =============================================================================

export const stbnSubcriterios = [
  // ── 1. Conservation and Restoration of Ecosystems (15 pts) ────────────────
  {
    codigo: "CONS_A",
    pilar: "CONSERVACION",
    nombre: "Active conservation of critical ecosystems",
    orden: 1,
    puntajeAlto: 7.5,
    puntajeBajo: 3.5,
    descripcionAlto:
      "The project demonstrates a clear and measurable commitment to conserving or restoring key ecosystems such as forests, mangroves, wetlands, or coastal habitats.",
    descripcionBajo: "Conservation actions are limited or not systematically monitored.",
  },
  {
    codigo: "CONS_B",
    pilar: "CONSERVACION",
    nombre: "Active restoration of degraded ecosystems",
    orden: 2,
    puntajeAlto: 7.5,
    puntajeBajo: 3.5,
    descripcionAlto:
      "The project implements active restoration practices in degraded areas using regenerative methods that improve biodiversity and ecosystem services.",
    descripcionBajo: "Restoration is partial or limited to passive protection.",
  },

  // ── 2. Community Participation and Use of Ancestral Knowledge (10 pts) ────
  {
    codigo: "COMU_A",
    pilar: "COMUNIDAD",
    nombre: "Effective integration of local communities",
    orden: 1,
    puntajeAlto: 5,
    puntajeBajo: 2.5,
    descripcionAlto:
      "Indigenous and local communities participate actively in project planning, governance, and implementation.",
    descripcionBajo: "Participation is consultative rather than active.",
  },
  {
    codigo: "COMU_B",
    pilar: "COMUNIDAD",
    nombre: "Integration of ancestral knowledge",
    orden: 2,
    puntajeAlto: 5,
    puntajeBajo: 2.5,
    descripcionAlto:
      "Ancestral and traditional practices are demonstrably integrated into natural resource management.",
    descripcionBajo: "Integration is partial or indirect.",
  },

  // ── 3. Social Justice and Equitable Distribution of Benefits (10 pts) ─────
  {
    codigo: "JUST_A",
    pilar: "JUSTICIA_SOCIAL",
    nombre: "Local job creation and fair benefit sharing",
    orden: 1,
    puntajeAlto: 5,
    puntajeBajo: 2.5,
    descripcionAlto:
      "The project ensures equitable distribution of economic, social, and environmental benefits, particularly for vulnerable groups.",
    descripcionBajo: "Benefit sharing is limited or uneven.",
  },
  {
    codigo: "JUST_B",
    pilar: "JUSTICIA_SOCIAL",
    nombre: "Positive social and environmental equity impact",
    orden: 2,
    puntajeAlto: 5,
    puntajeBajo: 2.5,
    descripcionAlto:
      "The project demonstrates a clear positive contribution to equity and justice within its operational area.",
    descripcionBajo: "Social impact is limited or indirect.",
  },

  // ── 4. Implementation of Advanced Technologies (10 pts) ────────────────────
  {
    codigo: "TECH_A",
    pilar: "TECNOLOGIA",
    nombre: "Use of AI, drones, and sensors for continuous monitoring",
    orden: 1,
    puntajeAlto: 5,
    puntajeBajo: 2.5,
    descripcionAlto:
      "The project effectively applies advanced technologies to feed the PNS monitoring system and perform real-time ecosystem tracking.",
    descripcionBajo: "Technology use is limited or lacks integration.",
  },
  {
    codigo: "TECH_B",
    pilar: "TECNOLOGIA",
    nombre: "Early-warning systems for climate risks",
    orden: 2,
    puntajeAlto: 5,
    puntajeBajo: 2.5,
    descripcionAlto:
      "Early-warning systems are operational for events such as floods, wildfires, or droughts.",
    descripcionBajo: "Such systems are only partially implemented.",
  },

  // ── 5. Human Rights and Cultural Preservation (15 pts) ─────────────────────
  {
    codigo: "DDHH_A",
    pilar: "DERECHOS_HUMANOS",
    nombre: "Human Rights Compliance",
    orden: 1,
    puntajeAlto: 7.5,
    puntajeBajo: 3.5,
    descripcionAlto:
      "The project demonstrates full compliance with human rights standards and actively respects the rights of Indigenous peoples and local communities throughout its value chain.",
    descripcionBajo:
      "Compliance is partial, unverified, or limited to policy statements without concrete implementation.",
  },
  {
    codigo: "DDHH_B",
    pilar: "DERECHOS_HUMANOS",
    nombre: "Contribution to Social and Cultural Cohesion",
    orden: 2,
    puntajeAlto: 7.5,
    puntajeBajo: 3.5,
    descripcionAlto: "The project strengthens community identity, traditions, and cohesion.",
    descripcionBajo: "The contribution is limited or lacks measurable outcomes.",
  },
];
