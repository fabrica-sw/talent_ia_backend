import { 
  normalizeCanonicalExperience, 
  normalizeCanonicalEducation, 
  normalizeCanonicalCertifications,
  validateAndNormalizeCanonicalCv,
  detectDegradedCvFields,
  isLocationString,
  stripBulletPoints,
  cleanExecutiveDetails
} from './canonicalCvNormalizer.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`TEST FAILURE: ${message}`);
  }
}

function runTests() {
  console.log("=== RUNNING CANONICAL CV NORMALIZER TESTS ===");

  // 1. Test isLocationString
  assert(isLocationString("Mexico City") === true, "Should recognize Mexico City");
  assert(isLocationString("CDMX") === true, "Should recognize CDMX");
  assert(isLocationString("Remoto") === true, "Should recognize Remoto");
  assert(isLocationString("Project / Delivery Manager Sr") === false, "Role should NOT be location");
  assert(isLocationString("SkillNet Inc") === false, "Company should NOT be location");
  console.log("PASS: isLocationString checks");

  // 2. Test stripBulletPoints
  assert(stripBulletPoints("● AWS Partner: Accreditation") === "AWS Partner: Accreditation", "Should strip ●");
  assert(stripBulletPoints("• Oracle Certified") === "Oracle Certified", "Should strip •");
  assert(stripBulletPoints("▪ Project lead") === "Project lead", "Should strip ▪");
  assert(stripBulletPoints("- Scrum master") === "Scrum master", "Should strip -");
  console.log("PASS: stripBulletPoints checks");

  // 3. Test cleanExecutiveDetails (Directriz EAS de Responsabilidades y Logros)
  const rawDetailsWithBulletsAndTruncation = "● Created trust and customer rapport, improving communication, giving assertive insights according to its needs.. Conducted requirements analysis gathering sessions, finishing before expected date and";
  const cleanedDetails = cleanExecutiveDetails(rawDetailsWithBulletsAndTruncation);
  assert(!cleanedDetails.includes(".."), "Should not contain double periods");
  assert(!cleanedDetails.endsWith("and"), "Should not end with truncated 'and'");
  assert(cleanedDetails.endsWith("."), "Should end with single period");
  assert(!cleanedDetails.startsWith("●"), "Should not start with bullet");
  assert(cleanedDetails.includes("Gestión integral de proyectos retail"), "Should translate into executive Spanish");
  console.log("PASS: cleanExecutiveDetails checks ->", cleanedDetails);

  // 4. Test normalizeCanonicalExperience with distorted legacy data
  const distortedCristobalExp = [
    "Project / Delivery Manager Sr | SkillNet Inc | May/2025 – Sep/2026 | Periodo profesional",
    "Mexico City | SkillNet Inc | 2025 – Sep/2026 | Created trust and customer rapport, improving communication, giving assertive insights. according to its needs.. Conducted requirements analysis gathering sessions, finishing before expected date and",
    "Mexico City | BetterCloud | 2023 – Mar/2025 | Take on Technical Program Management for key initiatives, improving efficiency by. Implemented Agile frameworks, accelerating project delivery timelines by 25%.. Managed stakeholder communications, ensuring alignment with business goals."
  ];

  const normalizedExp = normalizeCanonicalExperience(distortedCristobalExp);
  assert(normalizedExp.length >= 2, "Should return normalized items");
  assert(!normalizedExp[0].startsWith("Mexico City"), "Item 0 should not start with Mexico City");
  assert(!normalizedExp[1].startsWith("Mexico City"), "Item 1 should not start with Mexico City");
  assert(normalizedExp[0].includes("SkillNet Inc"), "Item 0 should contain SkillNet Inc");
  assert(normalizedExp[1].includes("BetterCloud"), "Item 1 should contain BetterCloud");
  assert(!normalizedExp[0].includes(".."), "Should not contain double periods");
  assert(!normalizedExp[1].includes(".."), "Should not contain double periods");
  console.log("PASS: normalizeCanonicalExperience checks ->", normalizedExp);

  // 5. Test regression cases from production CVs (Actualidad temporal role, Actividades: /, inverted dates, academic org filter)
  const prodEdgeExp = normalizeCanonicalExperience([
    "Actualidad | Empresa del Sector Privado | Junio 2023 | SAP Basis. I Novis, SA de CV | Actividades: /",
    "Consultor SAP Basis | S.A.I. Novis | Mayo 2025 - Agosto 2020 | Periodo: Agosto 2020 - Mayo 2025 | Actividades: /",
    "Facultad de Estudios Superiores Aragón UNAM | Mexico | 2015 - 2019"
  ]);
  assert(prodEdgeExp.length === 2, `Should filter pure academic org and keep 2 jobs, got ${prodEdgeExp.length}`);
  assert(prodEdgeExp[0].startsWith("SAP Basis |"), `Should rescue role SAP Basis, got: ${prodEdgeExp[0]}`);
  assert(prodEdgeExp[0].includes("Novis, SA de CV"), `Should rescue company Novis, SA de CV, got: ${prodEdgeExp[0]}`);
  assert(prodEdgeExp[0].includes("Junio 2023 - Actualidad"), `Should combine Junio 2023 - Actualidad, got: ${prodEdgeExp[0]}`);
  assert(!prodEdgeExp[0].includes("Actividades:"), "Should strip 'Actividades: /'");
  assert(prodEdgeExp[1].includes("Agosto 2020 - Mayo 2025"), `Should reverse inverted date range, got: ${prodEdgeExp[1]}`);
  console.log("PASS: normalizeCanonicalExperience production edge cases");

  // 6. Test normalizeCanonicalEducation with inverted & leaked data
  const distortedCristobalEdu = [
    "Bachelor of Science in Computer Systems for Management | Monterrey Institute of Technology and Higher Education, 1994 | Periodo de estudios"
  ];
  const normalizedEdu = normalizeCanonicalEducation(distortedCristobalEdu);
  assert(normalizedEdu.length === 1, "Should have 1 education item");
  assert(normalizedEdu[0].includes("Tecnológico de Monterrey (ITESM)"), "Should translate university name into ITESM");
  assert(normalizedEdu[0].includes("1994"), "Should decouple year into period");
  assert(!normalizedEdu[0].includes("Periodo de estudios"), "Should eliminate Periodo de estudios when 1994 exists");

  const prodEdgeEdu = normalizeCanonicalEducation([
    "Egrese de la carrera de Ingeniería en Sistemas Computacionales | Instituto Tecnológico de Zacatepec | 2016 - 2020",
    "Grupo Mexgas | Analista BASIS JR | 2021 - 2022"
  ]);
  assert(prodEdgeEdu.length === 1, `Should filter corporate job out of education, got ${prodEdgeEdu.length}`);
  assert(prodEdgeEdu[0].startsWith("Ingeniería en Sistemas Computacionales |"), `Should strip narrative prefix, got: ${prodEdgeEdu[0]}`);
  console.log("PASS: normalizeCanonicalEducation checks ->", prodEdgeEdu);

  // 7. Test normalizeCanonicalCertifications
  const distortedCristobalCert = [
    "● AWS Partner: Accreditation (Technical), 2021",
    "● Oracle, Bid Manager Certification, 2016",
    "● Oracle, Team Leader Certification, 2016",
    "Professional Development"
  ];

  const normalizedCert = normalizeCanonicalCertifications(distortedCristobalCert);
  assert(normalizedCert.length === 3, "Should filter out 'Professional Development'");
  assert(normalizedCert[0] === "AWS Partner: Accreditation (Technical), 2021", "Should strip leading ●");
  assert(normalizedCert[1] === "Oracle, Bid Manager Certification, 2016", "Should strip leading ●");
  console.log("PASS: normalizeCanonicalCertifications checks ->", normalizedCert);

  // 8. Test detectDegradedCvFields (precision without false positives on 2020-2022)
  const cleanHealth = detectDegradedCvFields({
    experience: ["SAP Basis | Novis, SA de CV | Junio 2020 - Agosto 2022 | Administración de sistemas SAP."],
    education: ["Ingeniería en Sistemas Computacionales | Instituto Tecnológico | 2015 - 2019"],
    certifications: ["SAP Certified Technology Associate"],
    resumeText: "Texto suficientemente largo de CV real con experiencia en SAP Basis desde junio 2020 hasta agosto 2022 en Novis SA de CV e ingeniería."
  });
  assert(!cleanHealth.needsExperienceReextract, "Healthy 2020-2022 experience must NOT trigger false positive");
  assert(!cleanHealth.needsEducationReextract, "Healthy education must NOT trigger false positive");

  const dirtyHealth = detectDegradedCvFields({
    experience: ["Actualidad | Empresa del Sector Privado | Junio 2023 | Actividades: /"],
    education: ["Licenciatura | Universidad Nacional Autónoma de México (UNAM) | 2014 - 2018"],
    resumeText: "Ingeniero en Sistemas por el Instituto Tecnológico de Toluca con más de 4 años de experiencia como Consultor SAP Basis."
  });
  assert(dirtyHealth.needsExperienceReextract, "Should detect corrupted Actualidad | Empresa record");
  assert(dirtyHealth.needsEducationReextract, "Should detect fabricated UNAM when CV mentions Toluca");

  const emptyNormalized = validateAndNormalizeCanonicalCv({
    summary: "Resumen limpio.",
    experience: ["SAP Basis | Novis | 2022"],
    education: ["Licenciatura en TI | ITESM | 2018"],
    certifications: ["AWS"]
  });
  assert(emptyNormalized.experience?.length === 1, "validateAndNormalizeCanonicalCv sanity");
  console.log("PASS: detectDegradedCvFields checks");

  console.log("ALL TESTS PASSED SUCCESSFULLY!");
}

runTests();
