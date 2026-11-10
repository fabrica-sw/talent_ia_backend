import { 
  normalizeCanonicalExperience, 
  normalizeCanonicalEducation, 
  normalizeCanonicalCertifications,
  validateAndNormalizeCanonicalCv,
  isLocationString,
  stripBulletPoints,
  cleanExecutiveDetails
} from './canonicalCvNormalizer.js';

function runTests() {
  console.log("=== RUNNING CANONICAL CV NORMALIZER TESTS ===");

  // 1. Test isLocationString
  console.assert(isLocationString("Mexico City") === true, "Should recognize Mexico City");
  console.assert(isLocationString("CDMX") === true, "Should recognize CDMX");
  console.assert(isLocationString("Remoto") === true, "Should recognize Remoto");
  console.assert(isLocationString("Project / Delivery Manager Sr") === false, "Role should NOT be location");
  console.assert(isLocationString("SkillNet Inc") === false, "Company should NOT be location");
  console.log("PASS: isLocationString checks");

  // 2. Test stripBulletPoints
  console.assert(stripBulletPoints("● AWS Partner: Accreditation") === "AWS Partner: Accreditation", "Should strip ●");
  console.assert(stripBulletPoints("• Oracle Certified") === "Oracle Certified", "Should strip •");
  console.assert(stripBulletPoints("▪ Project lead") === "Project lead", "Should strip ▪");
  console.assert(stripBulletPoints("- Scrum master") === "Scrum master", "Should strip -");
  console.log("PASS: stripBulletPoints checks");

  // 3. Test cleanExecutiveDetails (Directriz EAS de Responsabilidades y Logros)
  const rawDetailsWithBulletsAndTruncation = "● Created trust and customer rapport, improving communication, giving assertive insights according to its needs.. Conducted requirements analysis gathering sessions, finishing before expected date and";
  const cleanedDetails = cleanExecutiveDetails(rawDetailsWithBulletsAndTruncation);
  console.assert(!cleanedDetails.includes(".."), "Should not contain double periods");
  console.assert(!cleanedDetails.endsWith("and"), "Should not end with truncated 'and'");
  console.assert(cleanedDetails.endsWith("."), "Should end with single period");
  console.assert(!cleanedDetails.startsWith("●"), "Should not start with bullet");
  console.assert(cleanedDetails.includes("Gestión integral de proyectos retail"), "Should translate into executive Spanish");
  console.log("PASS: cleanExecutiveDetails checks ->", cleanedDetails);

  // 4. Test normalizeCanonicalExperience with Cristóbal's distorted data
  const distortedCristobalExp = [
    "Project / Delivery Manager Sr | SkillNet Inc | May/2025 – Sep/2026 | Periodo profesional",
    "Mexico City | SkillNet Inc | 2025 – Sep/2026 | Created trust and customer rapport, improving communication, giving assertive insights. according to its needs.. Conducted requirements analysis gathering sessions, finishing before expected date and",
    "Mexico City | BetterCloud | 2023 – Mar/2025 | Take on Technical Program Management for key initiatives, improving efficiency by. Implemented Agile frameworks, accelerating project delivery timelines by 25%.. Managed stakeholder communications, ensuring alignment with business goals."
  ];

  const normalizedExp = normalizeCanonicalExperience(distortedCristobalExp);
  console.assert(normalizedExp.length >= 2, "Should return normalized items");
  console.assert(!normalizedExp[0].startsWith("Mexico City"), "Item 0 should not start with Mexico City");
  console.assert(!normalizedExp[1].startsWith("Mexico City"), "Item 1 should not start with Mexico City");
  console.assert(normalizedExp[0].includes("SkillNet Inc"), "Item 0 should contain SkillNet Inc");
  console.assert(normalizedExp[1].includes("BetterCloud"), "Item 1 should contain BetterCloud");
  console.assert(!normalizedExp[0].includes(".."), "Should not contain double periods");
  console.assert(!normalizedExp[1].includes(".."), "Should not contain double periods");
  console.log("PASS: normalizeCanonicalExperience checks ->", normalizedExp);

  // 5. Test normalizeCanonicalEducation with Cristóbal's inverted data
  const distortedCristobalEdu = [
    "Bachelor of Science in Computer Systems for Management | Monterrey Institute of Technology and Higher Education, 1994 | Periodo de estudios"
  ];

  const normalizedEdu = normalizeCanonicalEducation(distortedCristobalEdu);
  console.assert(normalizedEdu.length === 1, "Should have 1 education item");
  console.assert(normalizedEdu[0].includes("Tecnológico de Monterrey (ITESM)"), "Should translate university name into ITESM");
  console.assert(normalizedEdu[0].includes("1994"), "Should decouple year into period");
  console.assert(!normalizedEdu[0].includes("Periodo de estudios"), "Should eliminate Periodo de estudios when 1994 exists");
  console.log("PASS: normalizeCanonicalEducation checks ->", normalizedEdu);

  // 6. Test normalizeCanonicalCertifications
  const distortedCristobalCert = [
    "● AWS Partner: Accreditation (Technical), 2021",
    "● Oracle, Bid Manager Certification, 2016",
    "● Oracle, Team Leader Certification, 2016",
    "Professional Development"
  ];

  const normalizedCert = normalizeCanonicalCertifications(distortedCristobalCert);
  console.assert(normalizedCert.length === 3, "Should filter out 'Professional Development'");
  console.assert(normalizedCert[0] === "AWS Partner: Accreditation (Technical), 2021", "Should strip leading ●");
  console.assert(normalizedCert[1] === "Oracle, Bid Manager Certification, 2016", "Should strip leading ●");
  console.log("PASS: normalizeCanonicalCertifications checks ->", normalizedCert);

  console.log("ALL TESTS PASSED SUCCESSFULLY!");
}

runTests();
