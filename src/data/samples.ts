import { Candidate, InterviewSlot, WorkflowStage, SecurityAuditLog, RecruitmentMetric, Vacancy } from '../types.js';

export const INITIAL_VACANCIES: Vacancy[] = [
  {
    id: 'VAC-VENTAS-101',
    title: 'Consultor de Ventas',
    department: 'Comercial',
    location: 'Ciudad de México (Híbrido)',
    description: 'Buscamos un Consultor de Ventas B2B para impulsar la prospección, desarrollo de pipeline y negociación comercial C-Level.',
    requirements: ['3+ años en ventas B2B', 'Prospección C-Level', 'Habilidades de negociación comercial', 'Manejo de CRM'],
    experienceYears: 3,
    salaryRange: ',000 - ,000 MXN',
    status: 'Activa',
    minCompetenciesRequired: { Liderazgo: 70, Comunicación: 80, TrabajoEnEquipo: 75, HabilidadesTecnicas: 75, ResolucionDeProblemas: 80 },
    englishLevel: 'Medio',
    modalidad: 'Híbrido'
  },
  {
    id: 'VAC-SAP-202',
    title: 'Consultor Funcional SAP S/4HANA CO',
    department: 'Consultoría',
    location: 'Ciudad de México (Presencial/Híbrido)',
    description: 'Especialista SAP S/4HANA módulo CO (Controlling) para diseño, configuración e implementación de centros de costo y contabilidad analítica.',
    requirements: ['5+ años en SAP CO / S/4HANA', 'Configuración de Controlling y CO-PA', 'Inglés profesional', 'Certificación SAP'],
    experienceYears: 5,
    salaryRange: ',000 - ,000 MXN',
    status: 'Activa',
    minCompetenciesRequired: { Liderazgo: 75, Comunicación: 85, TrabajoEnEquipo: 80, HabilidadesTecnicas: 90, ResolucionDeProblemas: 85 },
    englishLevel: 'Avanzado',
    modalidad: 'Presencial'
  },
  {
    id: 'VAC-DEV-303',
    title: 'Senior Frontend Developer (React)',
    department: 'Tecnología',
    location: 'Remoto',
    description: 'Desarrollador Senior Frontend especializado en React, TypeScript y optimización de arquitectura de componentes UI/UX.',
    requirements: ['4+ años en React & TypeScript', 'State management avanzadas', 'CSS/Tailwind & animación', 'Git & CI/CD'],
    experienceYears: 4,
    salaryRange: '$50,000 - $65,000 MXN',
    status: 'Activa',
    minCompetenciesRequired: { Liderazgo: 65, Comunicación: 75, TrabajoEnEquipo: 80, HabilidadesTecnicas: 92, ResolucionDeProblemas: 85 },
    englishLevel: 'Avanzado',
    modalidad: 'Remoto'
  },
  {
    id: 'VAC-OTC-404',
    title: 'Gerente de Consultoría Funcional SAP S/4HANA - OTC Pro',
    department: 'OTC Pro',
    location: 'Ciudad de México (Híbrido)',
    description: 'Consultor Senior A (Sr A) funcional SAP especializado en módulo SD y procesos end-to-end de Orden a Cobro (OTC Pro).',
    requirements: ['6+ años en SAP SD / OTC Pro', 'Configuración de esquemas de cálculo y facturación', 'Liderazgo de equipo', 'Inglés avanzado'],
    experienceYears: 6,
    salaryRange: '$80,000 - $95,000 MXN',
    status: 'Activa',
    minCompetenciesRequired: { Liderazgo: 85, Comunicación: 85, TrabajoEnEquipo: 80, HabilidadesTecnicas: 90, ResolucionDeProblemas: 85 },
    englishLevel: 'Avanzado',
    modalidad: 'Híbrido'
  }
];

export const INITIAL_STAGES: WorkflowStage[] = [
  { id: 'application', title: 'Postulación', description: 'Candidatos recién registrados en el portal.', color: 'border-slate-300 bg-slate-50 text-slate-700' },
  { id: 'screening', title: 'Filtro IA (EAS Engine)', description: 'Evaluación rápida de competencias clave vía Gemini.', color: 'border-amber-300 bg-amber-50 text-amber-700' },
  { id: 'test', title: 'Prueba Técnica', description: 'Evaluación práctica de habilidades profesionales.', color: 'border-blue-300 bg-blue-50 text-blue-700' },
  { id: 'interview', title: 'Entrevista', description: 'Reunión uno a uno con el equipo de Capital Humano.', color: 'border-indigo-300 bg-indigo-50 text-indigo-700' },
  { id: 'manager_review', title: 'Review Líder Área', description: 'Aprobación final por parte del Hiring Manager.', color: 'border-purple-300 bg-purple-50 text-purple-700' },
  { id: 'hired', title: 'Contratado', description: 'Proceso finalizado con éxito. Oferta aceptada.', color: 'border-green-300 bg-green-50/70 text-green-700' },
  { id: 'rejected', title: 'Nuevas Opciones', description: 'No avanza para esta posición específica.', color: 'border-rose-300 bg-rose-50 text-rose-700' }
];

export const INITIAL_CANDIDATES: Candidate[] = [
    {
        "id": "cand-1787085607902-384",
        "name": "Luis Maldonado Jimenez",
        "email": "lmaldonado022602@gmail.com",
        "phone": "55 3127 8529",
        "stage": "Filtrado",
        "competencies": {
            "Liderazgo": 72,
            "Comunicación": 97,
            "Trabajo en Equipo": 72,
            "Habilidades Técnicas": 81,
            "Resolución de Problemas": 85
        },
        "fitScore": 81,
        "initialFitScore": 81,
        "summary": "[EAS Engine Precalificación Local] El candidato Luis Maldonado Jimenez demuestra un perfil sólido orientado a resultados para la posición. Su experiencia técnica y de desarrollo se alinea e idoneidad profesional de manera progresiva. Evaluado analíticamente contra la vacante de 'Consultor de Ventas' (Área Comercial) encontrando coincidencia en prospección B2B y gestión de cuentas C-Level.",
        "strengths": [
            "Sólido nivel de aptitudes alineadas a los requisitos de Consultor de Ventas B2B.",
            "Sólidas habilidades de comunicación interna y comercial.",
            "Alineamiento rápido con los objetivos del área Comercial"
        ],
        "growths": [
            "Profundizar en habilidades específicas complementarias de su vacante asignada.",
            "Alinear espectro salarial y expectativas de contratación con los tabuladores presupuestales."
        ],
        "recommendedQuestions": [
            "¿Cuál fue tu estrategia de prospección B2B y negociación C-Level en tus roles anteriores?",
            "Describe tu experiencia estructurando pipelines comerciales e incremento de ventas.",
            "¿Cómo gestionas objeciones en clientes corporativos durante cierres complejos?"
        ],
        "suggestedTime": "",
        "channel": "LinkedIn",
        "createdAt": "2026-08-21T00:39:18.108Z",
        "isEncrypted": false,
        "vacancyId": "VAC-VENTAS-101",
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "¿Cómo estructuras y configuras las Áreas de Control (Controlling Area) en SAP CO?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "Describe tu experiencia administrando Contabilidad de Clases de Coste y Centros de Coste (CCA)."
                                   },
                                   {
                                       "id":  3,
                                       "question":  "¿Cómo gestionas la planificación y el cálculo de coste de producción (Product Cost Controlling)?"
                                   },
                                   {
                                       "id":  4,
                                       "question":  "Explica el análisis de rentabilidad (CO-PA) y cómo estructuras los informes de cuenta de resultados."
                                   },
                                   {
                                       "id":  5,
                                       "question":  "¿Cómo controlas la imputación de gastos a través de Órdenes Internas y elementos PEP?"
                                   },
                                   {
                                       "id":  6,
                                       "question":  "¿Cómo resuelves descuadres o discrepancias de conciliación entre la contabilidad financiera (FI) y de costos (CO)?"
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [
                           "TI, construyendo vínculos entre la estrategia comercial y",
                           "la ejecución técnica. He trabajado en empresas",
                           "globales y diversas marcas como HP, Microsoft, Red",
                           "Hat, Zebra, Ingram Micro y Team, así como en proyectos"
                       ],
        "education":  [
                          "Se permita actuar como asesor estratégico del cliente,",
                          "no solo como vendedor.",
                          "A cambio, ofrezco mejora continua, transferencia de"
                      ],
        "certifications":  [
                               "vanguardia y tengo un historial comprobado de",
                               "incrementos de ventas del 15% al 25% anual.",
                               "Lo que busco en una empresa"
                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-1787085609300-963",
        "name":  "César Oldair Barajas Nieto",
        "email":  "c_oldair@yahoo.com",
        "phone":  "55 83228537",
        "resumeText":  "Datos Personales\nDomicilio: El Rosedal Coyoacán\nCiudad de México C.P. 04330\nCel: 55 83228537\nEmail: c_oldair@yahoo.com\nObjetivo Profesional\nAplicar mis conocimientos y experiencia para coadyuvar en el desarrollo de estrategias y planes de crecimiento y\naprovechamiento dentro y fuera de la empresa.\nResumen\nEjecutivo Senior con más de 20 años de experiencia en ventas consultivas de tecnologías de la información, motivado y\norientado a resultados en empresas consultoras de soluciones MSP, Saas, Plataformas IA, Fabrica de Desarrollo, Staffing,\nSGCN, SGSI Ciberseguridad, Capacitación, Monitoreo de Aplicaciones, Help Desk, Business Intelligence,\nTelecomunicaciones y Servicios Administrados.\nCon actitud proactiva y excelente capacidad para generar relaciones comerciales de largo plazo en Iniciativa Privada y\nGobierno, enfocado al logro de objetivos y aptitudes de organización de proyectos, definición de prioridades, delegación\nde tareas y seguimiento de las mismas.\n❑ Lic. Planeación Territorial\n❑ Tecnológico en Programación\n❑ Sales Certification Metodología Sandler\n❑ Sales Certification PNL\n❑ Training Habilidades de Liderazgo\n❑ Training Objetivos y Competencias\n❑ Training ITIL 4 Foundation\n❑ Training Scrum Master\n❑ Training Business Impact Analysis\n❑ Sales Certification Forcepoint\n❑ Sales Certification Check Point\n❑ Sales Certification Cisco AppDynamics\n❑ Sales Certification Fortinet NSE 1 The Threat Landscape\n❑ Sales Certification CA Technologies\n❑ Sales Certification Oracle Database 12c\n❑ Sales Certification VMWare\n❑ Sales Certification Office 365\n❑ Sales Certification Watchguard\n❑ Sales Certification Riverbed\n❑ Certificado Power Sales. Hewlett Packard\n❑ Certificado de Ventas Inoculan, ArcServe, AimIT, ShipIT y ControIT. Computer Associates\n❑ Seminarios y Entrenamientos de las Principales Marcas de TI. NETSCOUT ARBOR, CISCO APPDYNAMICS,\nMICROFOCUS, CLOUDERA, FORTINET, VMWARE, IBM, LENOVO, HP, CISCO, TRIPP LITE, SYMANTEC, CA, MICROSOFT,\nMACROMEDIA, ORACLE, ASPEL Y NETSCREEN.\n❑ Desarrollo y Actualización: CRM´S (HUBSPOT, ODOO, SALESFORCE, DYNAMICS, FUSION y ZOHO),\nINDICADORES DE RENDIMIENTO FUNNEL Y CLIENTES A TRAVES DE PIPELINE Y KPI´S, PREPARACION DE OFERTAS\nTECNICAS Y ECONOMICAS PARA EL LICITACIONES de GOBIERNO e INICIATIVA PRIVADA (SEGUIMIENTO DESDE\nAPERTURA HASTA EL FALLO), RFI´S, RFP´S, PLANEACION Y ANÁLISIS DE ESTUDIOS DE MERCADO,\nFINANCIAMIENTOS Y DETECCIÓN DE NECESIDADES TECNOLÓGICAS.\nCésar Oldair Barajas Nieto\nCésar Oldair Barajas Nieto Resumen Laboral\n\n-- 1 of 3 --\n\nHistoria Laboral\nADDV AGILE DEVELOPMENT DESIGN (Junio 2025 – Julio 2026)\nAccount Manager IT\nCaptación y Apertura de Nuevos Clientes para la Venta y Negociación de Staffing y Hunting de Personal IT en Múltiples\nplataformas, Cloud Computing, Desarrollo de Software, Canales Digitales, Big Data \u0026 Analytics y Kentico. Principales\nClientes (Iberdrola México, Grupo Salinas y Mars). Principal Proyecto (Servicio de Staffing, Analistas de Proyectos,\nDesarrolladores Backend, Frontend, Diseñadores UX/UI y Analistas de Pruebas en Iberdrola).\nSELECTUM LATAM (Abril 2024 – Mayo 2025)\nBusiness Development Manager\nDesarrollar y Aperturar Nuevos Clientes B2B a nivel LATAM, para la Venta y Negociación de Staffing IT, especialista en\nreclutar, seleccionar y buscar personal del área de tecnologías de la información con enfoque en el ámbito de desarrollo\nde software, Venta de soluciones a través de plataformas SaaS de firma y certificación digital, con la integración de\ntokenización con blockchain. Principales Clientes (Banco del Pacífico y Davivienda). Principal Proyecto (Desarrollo\nCobol Banco del Pacífico).\nSYGNO IT (Enero 2023 – Marzo 2024)\nAccount Manager / Gerente Comercial IT\nCaptación de Nuevos Clientes y Fidelización de Clientes Actuales, para la Venta y Negociación de Staffing TI, Hunting\nTI, Plataforma Flebee de IA para tener una visión única del talento humano y orientar la toma de decisiones relacionadas\ncon la gestión del día a día., Automatización de Procesos RPA, Fábrica de Desarrollo de Proyectos a la Medida y\nCapacitación. Principales Clientes (Logrand, Smurfit Kappa, Mars y Aserta). Principal Proyecto (Desarrollo de\naplicación en Logrand).\nGLOBALLYNX (Julio 2020 – Diciembre 2022)\nSenior Business Consultant / Gerente Comercial BCP\nDesarrollar y Aperturar Nuevos Clientes B2B, para la Venta y Negociación de Consultoría para la Gestión de Servicios de\nTI como Sistemas de Gestión de Continuidad del Negocio (SGCN), Sistemas de Gestión de Seguridad de la Información\n(SGSI) y Business Impact Analysis (BIA), así como Capacitación en ITIL, ISO/IEC 20000, MAAGTICSI, DevOps, SCRUM,\nSecurity Risk y CISSP. Principales Clientes (Infonavit, IMSS, Secretaria de Salud, Seguros Atlas y Sigma). Principal\nProyecto (Monitoreo al Sistema de Gestión de Continuidad del Negocio SGCN y BIA Infonavit).\nGRUPO CEPRA División BSS (Abril 2018 – Junio 2020)\nKey Account Manager IT\nDesarrollar y Aperturar Nuevos Clientes B2B, mediante Servicios Administrados de Transformación Digital. Soluciones:\nNetscout Arbor, Microfocus Net IQ Identidades y Accesos, Novell ZENWorks, CA Broadcom, Fortinet, VmWare, Cisco\nAppDynamics, Cloudera e IBM Lenovo. Principales Clientes (Alsea, Rassini, Genomma Lab, NMP, Telcel y EY).\nPrincipal Proyecto (Monitoreo del desempeño de servicios críticos de negocios en el Data Center de Alsea con la\nPlataforma Unificada nGenius ONE de NetScout hosteado en KIO Querétaro.)\nKIO TIBA IT Services (Enero 2016 - Marzo 2018)\nAccount Manager IT\nCaptación y Apertura de Nuevos Clientes para la Venta y Negociación de Help Desk, Roll Out, Full Services, Mesa de\nServicios, Soporte, Detección de Incidentes Recurrentes, Alineación Entre Percepción del Cliente y Cumplimientos de\nSLA´s y Evaluación Periódica al Personal de Mesa de Ayuda. Principales Clientes (Alsea, Santander, Grupo Omega,\nGrupo Aeroportuario del Pacífico y SRE). Principal Proyecto (Servicios Administrados a los Switch y Router´s Cisco en\nGrupo Aeroportuario del Pacífico).\nGONET LATAM (Febrero 2013 - Enero 2016)\nAccount Manager IT\nVenta y Negociación de Proyectos Outsourcing IT, Desarrollo de Aplicaciones Móviles, Fábrica de Software, MDM\nAirwatch, Oracle, Microstrategy, Riverbed, Apple y Seguridad Perimetral. Principales Clientes (ALSEA, Banorte IXE,\nBank Of América, Monex, Philip Morris, Boehringer, Cervecería Cuauhtémoc Moctezuma, SEDESOL y SRE). Principal\nProyecto (Desarrollo de interfaces para comunicar los servidores Backoffice y FTP en Philip Morris).\nCésar Oldair Barajas Nieto\n\n-- 2 of 3 --\n\nGRUPO ALTAVISTA (Marzo 2002 - Junio 2006)\nEjecutivo de Cuentas Especiales Gobierno\nApertura y Captación de cuentas de gobierno para la venta de soluciones y servicios gestionados como conectividad,\nredes, copias de seguridad de datos y recuperación, así como también servicios administrados de plataformas wintel\nAcer, HP y Dell Principales Clientes (Secretaria de Gobernación, INM, Secretaria de Turismo, Talleres Gráficos de\nMéxico, Bancomext, CONADE, IMPI Y SEP).\nCésar Oldair Barajas Nieto\n\n-- 3 of 3 --\n\n",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  88,
                             "Comunicación":  91,
                             "Trabajo en Equipo":  67,
                             "Habilidades Técnicas":  56,
                             "Resolución de Problemas":  78
                         },
        "fitScore":  76,
        "initialFitScore":  76,
        "summary":  "[EAS Engine Precalificación Local] El candidato César Oldair Barajas Nieto demuestra un perfil sólido orientado a resultados para la posición. Su experiencia teórica y de desarrollo se alinea e idoneidad profesional de manera progresiva. [Alerta: Nivel de inglés insuficiente para perfil SR]. Evaluado analíticamente contra la vacante de \u0027Gerente de Consultoría Funcional SAP S/4HANA - OTC Pro\u0027 encontrando coincidencia de 1 de 7 palabras clave. Dispone de gran potencial de inserción operativa instantánea.",
        "strengths":  [
                          "Sólido nivel de aptitudes alineadas a los requisitos de Gerente de Consultoría Funcional SAP S/4HANA - OTC Pro.",
                          "Sólidas habilidades de comunicación interna.",
                          "Alineamiento rápido con los objetivos de OTC Pro"
                      ],
        "growths":  [
                        "Profundizar en habilidades específicas complementarias de su vacante asignada.",
                        "Alinear espectro salarial y expectativas de contratación con los tabuladores presupuestales."
                    ],
        "recommendedQuestions":  [
                                     "¿Cómo estructuras y configuras las Áreas de Control (Controlling Area) en SAP CO?",
                                     "Describe tu experiencia administrando Contabilidad de Clases de Coste y Centros de Coste (CCA).",
                                     "¿Cómo gestionas la planificación y el cálculo de coste de producción (Product Cost Controlling)?",
                                     "Explica el análisis de rentabilidad (CO-PA) y cómo estructuras los informes de cuenta de resultados.",
                                     "¿Cómo controlas la imputación de gastos a través de Órdenes Internas y elementos PEP?",
                                     "¿Cómo resuelves descuadres o discrepancias de conciliación entre la contabilidad financiera (FI) y de costos (CO)?"
                                 ],
        "suggestedTime": "",
        "channel":  "LinkedIn",
        "createdAt":  "2026-08-21T00:39:17.997Z",
        "isEncrypted":  false,
        "vacancyId":  "VAC-VENTAS-101",
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "¿Cómo estructuras y configuras las Áreas de Control (Controlling Area) en SAP CO?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "Describe tu experiencia administrando Contabilidad de Clases de Coste y Centros de Coste (CCA)."
                                   },
                                   {
                                       "id":  3,
                                       "question":  "¿Cómo gestionas la planificación y el cálculo de coste de producción (Product Cost Controlling)?"
                                   },
                                   {
                                       "id":  4,
                                       "question":  "Explica el análisis de rentabilidad (CO-PA) y cómo estructuras los informes de cuenta de resultados."
                                   },
                                   {
                                       "id":  5,
                                       "question":  "¿Cómo controlas la imputación de gastos a través de Órdenes Internas y elementos PEP?"
                                   },
                                   {
                                       "id":  6,
                                       "question":  "¿Cómo resuelves descuadres o discrepancias de conciliación entre la contabilidad financiera (FI) y de costos (CO)?"
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [
                           "aprovechamiento dentro y fuera de la empresa.",
                           "Resumen",
                           "orientado a resultados en empresas consultoras de soluciones MSP, Saas, Plataformas IA, Fabrica de Desarrollo, Staffing,",
                           "SGCN, SGSI Ciberseguridad, Capacitación, Monitoreo de Aplicaciones, Help Desk, Business Intelligence,"
                       ],
        "education":  [
                          "FINANCIAMIENTOS Y DETECCIÓN DE NECESIDADES TECNOLÓGICAS.",
                          "César Oldair Barajas Nieto",
                          "César Oldair Barajas Nieto Resumen Laboral"
                      ],
        "certifications":  [
                               "❑ Seminarios y Entrenamientos de las Principales Marcas de TI. NETSCOUT ARBOR, CISCO APPDYNAMICS,",
                               "MICROFOCUS, CLOUDERA, FORTINET, VMWARE, IBM, LENOVO, HP, CISCO, TRIPP LITE, SYMANTEC, CA, MICROSOFT,",
                               "MACROMEDIA, ORACLE, ASPEL Y NETSCREEN."
                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-1787085609685-464",
        "name":  "Coromoto Blanco",
        "email":  "coromoto.blanco8.1@gmail.com",
        "phone":  "+52 56 2163 1996",
        "resumeText":  "PROFESSIONAL PROFILE\nSales professional with over 13 years of experience across\nLATAM, specializing in consultative sales for technology services.\nAdept at translating complex technical and business requirements\ninto compelling commercial proposals, building long-term client\nrelationships, and driving sustained revenue growth. Expert in\nlead generation, engaging C-level executives and key\nstakeholders, managing end-to-end sales cycles, and closing\nmulti-million USD contracts across diverse industries in Mexico\nand broader LATAM.\nEDUCATION\nBachelor of Business Administration\nInstituto Universitario de Nuevas Profesiones\nCaracas, Venezuela\nArchitectural and Interior Design\nUNEA University - Truncated career\nCERTIFICATIONS\nSales Software - HubSpot.\nInbound Sales - HubSpot.\nSkills in the Inbound Methodology -\nHubSpot.\nFrictionless Sales - HubSpot.\nMarketing Software - HubSpot.\nSandler.\nSolution Selling.\nBANT.\nFortinet - NSE1 and NSE2.\nEffective Communication in Sales.\nESET Certified Sales Especialist.\nDigital Graphic Design - Adobe Illustrator\nand Photoshop.\nSketchup and V-Ray - actually.\nWORK EXPERIENCE\nBACHELOR OF BUSINESS ADMINISTRATION\nRegional Business Development Consultant - LATAM\nCONTACT ME\nMobile Phone: +52 56 2163 1996 | coromoto.blanco8.1@gmail.com | LinkedIn | México\nSDI - www.sdila.com - Regional Business Development\nConsultant - LATAM\n07/01/2025 - Current - México.\nLead business development and end-to-end B2B sales of IT\nSolutions and Professional Services, including IT Project\nImplementation, Chatbots, IT Certifications, Technical\nTraining, IT Consulting, and IT Staffing, serving mid-market\nand enterprise clients’ across Mexico and Latin America.\nDeveloped and executed strategic business development\nplans across Mexico and LATAM, identifying new market\nopportunities, qualifying prospects, and building a robust\npipeline of mid-market and enterprise accounts.\nLed consultative sales engagements with C-level executives\nand key stakeholders, conducting discovery sessions,\npresenting tailored IT solutions, and aligning technology\ninitiatives with clients\u0027 business objectives.\nManaged the complete enterprise sales cycle, including\nopportunity qualification, solution positioning, commercial\nproposal development, contract negotiation, forecasting, and\nsuccessful deal closure.\nPartnered with technical and delivery teams to ensure\nsuccessful solution implementation while driving customer\nsatisfaction, long-term account growth, renewals, upselling \u0026\ncross-selling opportunities.\nAchieved 100% of an annual sales quota of USD $1.1M by\ndeveloping new enterprise business opportunities across\nMexico and LATAM.\nCOROMOTO BLANCO\n\n-- 1 of 2 --\n\nLANGUAGES\nEnglish: C1.\nItalian: C2.\nSpanish: Native.\nCONTACT ME\nMobile Phone: +52 56 2163 1996 | coromoto.blanco8.1@gmail.com | LinkedIn | México\nSALES \u0026 TECHNOLOGY SKILLS\nNegotiation \u0026 Closing of Multi-Million USD\nContracts.\nBusiness Acumen.\nStrategic Negotiation.\nTrusted Advisor.\nConsultative Selling.\nStrategic Account Management.\nExecutive Relationship Management.\nEnterprise Account Management – LATAM.\nComplex Solutions Sales.\nExecutive Communication.\nGo-To-Market Strategy (GTM).\nStakeholder Management.\nBusiness Case Development.\nOpportunity Qualification.\nLead Generation.\nFull Sales Cycle.\nB2B Sales.\nGenerative AI.\nIT Solutions Sales.\nSaaS \u0026 PaaS Sales.\nCybersecurity Sales.\nDigital Transformation Sales.\nCloud Solutions.\nMEDDPICC| Sandler | BANT | SPIN.\nRevenue Growth.\nLong-term Account Growth.\nPipeline Management \u0026 Sales Forecasting.\nUpselling \u0026 Cross-selling.\nExpanded LATAM business through enterprise customer\nacquisition and strategic account growth.\nMaintained an accurate sales pipeline aligned with quarterly\nrevenue targets and forecast objectives.\nKether Ingeniería - Lead Generator and Sr. Business\nDevelopment Executive\n12/09/2024 to 05/15/2025 - México.\nDeveloped and executed strategic business development\nplans across Mexico, identifying new business opportunities,\nqualifying prospects, and building a robust pipeline for HVAC,\nMEP, civil and industrial construction projects.\nLed consultative sales engagements with C-level executives,\nfacility managers, project managers, and key decision-\nmakers, conducting discovery sessions, assessing technical\nrequirements, presenting tailored engineering and\ninfrastructure solutions aligned with clients’ operational and\nbusiness objectives.\nManaged the complete B2B sales cycle, including opportunity\nqualification, RFP/RFQ participation, technical and\ncommercial proposal development, contract negotiation, sales\nforecasting, and successful project acquisition.\nCollaborated closely with engineering, architectural and\nproject delivery teams to ensure successful project execution\nwhile strengthening customer relationships, identifying repeat\nbusiness opportunities, and supporting long-term account\ngrowth.\nGenerated up to 90% of the monthly qualified sales pipeline\nthrough strategic business development.\nReached 79% of a USD $125K sales quota within six months.\nÉmerix - Lead Generator - Freelance\n06/17/2024 to 11/29/2024 - México.\nGenerated qualified business opportunities for an AI-powered\ndebt collection platform.\nBuilt up to 70% of the monthly qualified sales pipeline.\nAdditional Sr. Business Development Experience\nBusiness Development Executive | Multiple Companies\n(2013–2022):\nEquifax • Soaint • Martinexsa • Prutech • Grupo Scanda •\nPraxis • Protetco\nManaged full-cycle B2B sales, achieving annual quotas of\nUSD $800K–$1.2M.\nManaged complex sales opportunities from prospecting and\nqualification through contract negotiation and deal closure.\nSOFTWARE SKILLS\nCRM: HubSpot, Salesforce, PipeDrive,\nMonday, Zoho, Microsoft Dynamics, Odoo.\nApollo, Lusha, Kombo, Sales Navigator.\nAI: Gemini, Copilot, ChatGPT, Perplexity,\nClaude, Midjourney and DaVinci AI.\nMicrosoft Office 365 \u0026 Google Workspace.\nLinkedIn.\nOperating Systems: Windows, Mac\nAndroid and IoS.\n\n-- 2 of 2 --\n\n",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  70,
                             "Comunicación":  87,
                             "Trabajo en Equipo":  85,
                             "Habilidades Técnicas":  62,
                             "Resolución de Problemas":  66
                         },
        "fitScore":  77,
        "initialFitScore":  74,
        "summary":  "[EAS Engine Precalificación Local] El candidato Coromoto Blanco demuestra un perfil sólido orientado a resultados para la posición. Su experiencia teórica y de desarrollo se alinea e idoneidad profesional de manera progresiva. [Alerta: Nivel de inglés insuficiente para perfil SR]. Evaluado analíticamente contra la vacante de 'Gerente de Consultoría Funcional SAP S/4HANA - OTC Pro' encontrando coincidencia de 0 de 7 palabras clave. Dispone de gran potencial de inserción operativa instantánea.",
        "strengths":  [
                          "Sólido nivel de aptitudes alineadas a los requisitos de Gerente de Consultoría Funcional SAP S/4HANA - OTC Pro.",
                          "Sólidas habilidades de comunicación interna.",
                          "Alineamiento rápido con los objetivos de OTC Pro"
                      ],
        "growths":  [
                        "Profundizar en habilidades específicas complementarias de su vacante asignada.",
                        "Alinear espectro salarial y expectativas de contratación con los tabuladores presupuestales."
                    ],
        "recommendedQuestions":  [
                                     "¿Cómo estructuras y configuras las Áreas de Control (Controlling Area) en SAP CO?",
                                     "Describe tu experiencia administrando Contabilidad de Clases de Coste y Centros de Coste (CCA).",
                                     "¿Cómo gestionas la planificación y el cálculo de coste de producción (Product Cost Controlling)?",
                                     "Explica el análisis de rentabilidad (CO-PA) y cómo estructuras los informes de cuenta de resultados.",
                                     "¿Cómo controlas la imputación de gastos a través de Órdenes Internas y elementos PEP?",
                                     "¿Cómo resuelves descuadres o discrepancias de conciliación entre la contabilidad financiera (FI) y de costos (CO)?"
                                 ],
        "suggestedTime": "",
        "channel":  "LinkedIn",
        "createdAt":  "2026-08-21T00:39:17.966Z",
        "isEncrypted":  false,
        "vacancyId":  "VAC-VENTAS-101",
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "answer":  "Con tu amplia experiencia en comunicación ejecutiva C-Level, ¿cómo logras establecer relaciones de confianza duraderas con directores corporativos?",
                                       "question":  "¿Cómo estructuras y configuras las Áreas de Control (Controlling Area) en SAP CO?"
                                   },
                                   {
                                       "id":  2,
                                       "answer":  "¿Cuál ha sido tu estrategia más efectiva para posicionar servicios de consultoría especializada en clientes que no tienen presupuesto asignado?",
                                       "question":  "Describe tu experiencia administrando Contabilidad de Clases de Coste y Centros de Coste (CCA)."
                                   },
                                   {
                                       "id":  3,
                                       "answer":  "Describe cómo lidias con la presión de cuotas de ventas elevadas en periodos de contracción económica del mercado.",
                                       "question":  "¿Cómo gestionas la planificación y el cálculo de coste de producción (Product Cost Controlling)?"
                                   },
                                   {
                                       "id":  4,
                                       "answer":  "¿Qué indicadores clave (KPIs) monitoreas diariamente para medir el estado de salud de tu embudo de ventas?",
                                       "question":  "Explica el análisis de rentabilidad (CO-PA) y cómo estructuras los informes de cuenta de resultados."
                                   },
                                   {
                                       "id":  5,
                                       "answer":  "Platícanos sobre un contrato que hayas renegociado exitosamente para incrementar el alcance del servicio y la facturación.",
                                       "question":  "¿Cómo controlas la imputación de gastos a través de Órdenes Internas y elementos PEP?"
                                   },
                                   {
                                       "id":  6,
                                       "answer":  "¿De qué manera colaboras con los equipos internos de operaciones y capital humano para alinear las expectativas de entrega del cliente?",
                                       "question":  "¿Cómo resuelves descuadres o discrepancias de conciliación entre la contabilidad financiera (FI) y de costos (CO)?"
                                   },
                                   {
                                       "id":  7,
                                       "answer":  "¿Cuál es tu disponibilidad para integrarse a la vacante? Ej: Una semana, dos días, quince días, etc.",
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "answer":  "¿Cuál fue tu último sueldo mensual bruto (comprobable)?",
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "answer":  "¿Dónde te ubicas geográficamente?",
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "answer":  "¿En qué modalidad de trabajo podrías colaborar (presencial, híbrido o remoto)?",
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  "### 🔍 Reporte de Doble Validación (Double-Check) - EAS Engine AI™\n\n**Candidato:** Coromoto Blanco\n**Vacante:** Ejecutivo de Ventas\n**Dictamen de Coherencia:** Validado y Aprobado\n\n#### 📌 Hallazgos Principales:\n1. **Veracidad de Experiencia:** Las respuestas proporcionadas en el cuestionario son coherentes con la trayectoria declarada.\n2. **Disponibilidad y Pretensión:** Se registraron y validaron las respuestas de disponibilidad y remuneración.\n3. **Recomendación:** Proceder a entrevista de profundidad con Capital Humano y Líder Técnico.",
        "interviewSpeech":  "### 📋 Guía de Entrevista Estructurada (EAS Engine AI)\n\n#### 👥 SECCIÓN 1: CAPITAL HUMANO (HR)\n**Objetivo:** Evaluar soft skills, adaptabilidad y fit cultural con EAS Consulting.\n* **Speech/Guión de Apertura:**\n  *\"Hola Coromoto Blanco, bienvenido a esta sesión con EAS Consulting Group. Hemos revisado tu trayectoria y las respuestas de tu cuestionario de filtro. Queremos profundizar en tus motivaciones profesionales.\"*\n* **Preguntas Clave para HR:**\n  1. ¿Qué te motiva a unirte a EAS Consulting y cómo consideras que tu perfil agrega valor?\n  2. Describe una situación donde tuviste una diferencia de criterio con un cliente y cómo la resolviste.\n  3. Cuéntame sobre un cambio drástico en las prioridades de un proyecto.\n\n---\n\n#### 🛠️ SECCIÓN 2: LÍDER TÉCNICO (EVALUADOR)\n**Objetivo:** Validar a profundidad el dominio técnico y metodologías de trabajo.\n* **Speech/Guión de Apertura:**\n  *\"Hola Coromoto Blanco, en esta sección nos enfocaremos en los desafíos técnicos relacionados con la vacante de Ejecutivo de Ventas. Queremos indagar en tus proyectos previos.\"*\n* **Preguntas Clave:**\n  1. Cuéntame sobre un proyecto donde aplicaste tus habilidades avanzadas como Ejecutivo de Ventas.\n  2. Explica una situación donde un entregable estuvo en riesgo de retraso y qué decisiones tomaste.\n  3. ¿Qué buenas prácticas de control de calidad aplicas cotidianamente?",
        "experience":  [

                       ],
        "education":  [

                      ],
        "certifications":  [
                               "Sales Software - HubSpot.",
                               "Inbound Sales - HubSpot.",
                               "Training, IT Consulting, and IT Staffing, serving mid-market"
                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-1787085610056-64",
        "name":  "IVÁN EDUARDO CEDILLO PÉREZ",
        "email":  "ivancedillo27@hotmail.com",
        "phone":  "55 3513 6214",
        "resumeText":  "Iván Eduardo Cedillo Pérez — CV| Página 1 de 2\nIVÁN EDUARDO CEDILLO PÉREZ\nEjecutivo Comercial Senior | Ventas Consultivas B2B\nivancedillo27@hotmail.com | 55 3513 6214 / 55 9096 3951 | CDMX, México |\nRESUMEN PROFESIONAL\nEjecutivo comercial con más de 15 años de experiencia en venta consultiva de servicios de TI y soluciones de software para los\ndiferentes sectores empresariales: Corporativos, grandes y medianas empresas, principalmente en el sector financiero, retail e\nindustrial. Tengo amplia experiencia en el diseño de estrategias comerciales, generación de nuevas cuentas, negociación de contratos\na largo plazo y ticket alto, además, he ayudado al fortalecimiento de la relación con los clientes con base en metodologías SPIN y\nSolution Selling, MEDDIC. Completamente orientado al cumplimiento de los objetivos de la organización y enfocado en brindar\nsoluciones de valor a los clientes, para facilitar su jornada en la transformación digital y brindarles una ventaja competitiva.\nCOMPETENCIAS CLAVE\n1) Diseño de estrategias comerciales en función del producto y el ICP.\n2) Amplio conocimiento de ventas consultivas con base en metodologías cómo: SPIN, Solution Selling, MEDDIC, BANT.\n3) Gestión de ventas clave para la organización en su crecimiento orgánico: upselling y crosselling.\n4) Amplia capacidad de negociación y cierre en función de darle valor agregado al cliente.\n5) Gestión del forecast y del pipeline health en función de las métricas establecidas por la organización.\n6) Amplio conocimiento de CRM’s: Hubspot, ZOHO, Dynamics, entre otros.\n7) Capacidad de liderazgo y formación de nuevos vendedores.\n8) Capacidad de análisis de ventas y generación de reportes ejecutivos: tablas dinámicas (Excel)\nEDUCACIÓN\n● Lic. en Administración de T.I. — UNITEC, Campus Sur (Sept. 2014 – ago. 2018-egresado)\nEXPERIENCIA PROFESIONAL\nGerente Comercial de Core Bancario — Efisys\nMarzo 2025 – mayo 2026\n● Venta consultiva de Core bancario y Onboarding digital para industria financiera regulada: bancos, SOFIPOs, SOCAPs y\nfintechs, SOFOMes, Bancos; 4 contratos cerrados con un cumplimiento de cuota del 75%\n● Generación de nuevas cuentas a través de networking y participación en eventos del sector financiero.\n● Seguimiento comercial a leads entrantes (web) desde primer contacto, calificación y gestión administrativa hasta el cierre;\ndemostración de plataforma tecnológica a prospectos, a través de la calificación adecuada de los prospectos y el\nseguimiento, se logró una tasa de conversión de 10 a 1.\n● Capacitación y desarrollo del equipo de ventas.\n● Desarrollo de presentaciones de valor agregado para cada prospecto con inteligencias artificiales: Claude, Copilot.\n● Desarrollo de reportes gerenciales para presentarlos al Consejo, a través de tablas dinámicas y reportes ejecutivos.\n● Análisis de las oportunidades ganadas vs pérdidas, además de la generación de leads y acciones comerciales para identificar\nmejoras en el proceso comercial.\n● Coordinación en conjunto con Marketing para diseñar y lanzar campañas de mailing, SEO, webinars, materiales de ventas,\npresentaciones de la solución, en función del target y el ICP.\n● Prospección a través de plataformas de Inteligencia artificial (Lusha, Apollo).\n● Generación de propuestas de valor específicas para cada cliente, con base en sus necesidades operativas y de negocio, a\ntravés de inteligencia artificial (Claude, Gemini, Copilot). Además de coordinar al área de preventa para presentar\ndemostraciones adecuadas (POC) a clientes de alto valor.\n\n-- 1 of 2 --\n\nIván Eduardo Cedillo Pérez — CV| Página 2 de 2\nConsultor Comercial de ERP\u0027s — CVM Management\nJulio 2023 – febrero 2025\n● Venta consultiva de ERP\u0027s (SAP Business One, Intelisis) y soluciones verticales para industria avanzada (MRP).\n● Generación de cuentas nuevas y gestión del ciclo completo hasta el cierre; 6 contratos firmados con un porcentaje de cuota\ndel 135%.\n● Calificación de oportunidades de negocio con base en metodología BANT y SPIN.\n● Seguimiento comercial a leads asignados por SAP y por el sitio web, desde primer contacto, calificación y gestión\nadministrativa hasta el cierre; realizando demostraciones de plataforma con un flujo especifico por cada prospecto para\ngenerar un impacto positivo. Se logró una tasa de conversión de 5 a 1.\n● Desarrollo de estrategias comerciales para la generación de nuevos leads y convertirlos en clientes, a través de la\nverticalización y dar mensajes de valor por cada sector.\nConsultor Comercial de Core Bancario — Finasist\nFebrero 2021 – marzo 2023\n● Venta consultiva de Core bancario para la industria financiera, principalmente SOFOMes.\n● Generación de nuevas cuentas y seguimiento comercial desde el primer contacto hasta el cierre; Se firmaron 3 contratos\nen plena pandemia con un 60% del cumplimiento de cuota.\n● Levantamiento de necesidades particulares y demostraciones a clientes; gestión de contratos, alta de proveedor y cobranza.\nConsultor Comercial de Software de Nómina y RH — Fortia Technology\nAgosto 2018 – diciembre 2020\n● Venta consultiva de software de nómina y recursos humanos para empresas AAA.\n● Ciclo completo de venta: prospección, calificación, desarrollo de oportunidad, demostración, negociación y cierre; Se\nfirmaron 10 contratos en 2.5 años, todos los años superé la cuota que fue creciendo de $500K USD el primer año a $1M\nUSD el tercer año. Logré la venta más grande en la empresa con un valor de $800K USD.\n● Gestión administrativa de cuentas: contratos, alta de proveedor y cobranza.\nAccount Manager IT — MarSystems\nMarzo 2016 – mayo 2018\n● Venta consultiva de soluciones de Business Intelligence sobre plataformas Oracle y SQL Server; fortalecimiento de la\nrelación con Microsoft.\n● Diseño y lanzamiento de campañas comerciales para soluciones empaquetadas de BI (SQL Server 2016) y desarrollo sobre\nSharePoint y VS.Net.\n● Diseño de presentaciones y estrategia comercial para productos de Extranet, Intranet, Portales, eCommerce y Workflows.\nAccount Manager IT — Lennken Group\nFebrero 2013 – diciembre 2015\n● Venta de desarrollo de software (Java, VS.Net, PHP) y staffing especializado en TI.\n● Generación de cuentas nuevas y desarrollo de estrategias comerciales junto con la Dirección General.\n● Gestión comercial de cuentas corporativas, incluyendo Infonavit y Banorte.\nEjecutivo de Ventas — Grupo Devant (Fábrica de Software)\nEnero 2010 – diciembre 2012\n● Consultor comercial de desarrollo de software; inicio de carrera en venta consultiva de TI.\n● Venta especializada de software para la administración del BATCH en bancos y empresas que utilizan grandes cantidades\nde datos: Walmart, Infonavit, BBVA, Banorte.\n● Creación de los procesos del área comercial y apertura del área.\nHERRAMIENTAS Y HABILIDADES TÉCNICAS\n● CRM: Dynamics, Zoho, Hubspot, Bitrix.\n● Microsoft Office / Excel avanzado (nivel de uso: 80%).\n● IA’s: Lusha, Apollo, Claude, Copilot\n● Metodologías de calificación y venta: SPIN, Solution Selling, BANT.\nIDIOMAS\n● Inglés: Intermedio.\n\n-- 2 of 2 --\n\n",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  94,
                             "Comunicación":  86,
                             "Trabajo en Equipo":  88,
                             "Habilidades Técnicas":  56,
                             "Resolución de Problemas":  85
                         },
        "fitScore":  85,
        "initialFitScore":  82,
        "summary":  "[EAS Engine Precalificación Local] El candidato IVÁN EDUARDO CEDILLO PÉREZ demuestra un perfil sólido orientado a resultados para la posición. Su experiencia teórica y de desarrollo se alinea e idoneidad profesional de manera progresiva. [Alerta: Nivel de inglés insuficiente para perfil SR]. Evaluado analíticamente contra la vacante de \u0027Gerente de Consultoría Funcional SAP S/4HANA - OTC Pro\u0027 encontrando coincidencia de 2 de 7 palabras clave. Dispone de gran potencial de inserción operativa instantánea.",
        "strengths":  [
                          "Sólido nivel de aptitudes alineadas a los requisitos de Gerente de Consultoría Funcional SAP S/4HANA - OTC Pro.",
                          "Sólidas habilidades de comunicación interna.",
                          "Alineamiento rápido con los objetivos de OTC Pro"
                      ],
        "growths":  [
                        "Profundizar en habilidades específicas complementarias de su vacante asignada.",
                        "Alinear espectro salarial y expectativas de contratación con los tabuladores presupuestales."
                    ],
        "recommendedQuestions":  [
                                     "¿Cómo estructuras y configuras las Áreas de Control (Controlling Area) en SAP CO?",
                                     "Describe tu experiencia administrando Contabilidad de Clases de Coste y Centros de Coste (CCA).",
                                     "¿Cómo gestionas la planificación y el cálculo de coste de producción (Product Cost Controlling)?",
                                     "Explica el análisis de rentabilidad (CO-PA) y cómo estructuras los informes de cuenta de resultados.",
                                     "¿Cómo controlas la imputación de gastos a través de Órdenes Internas y elementos PEP?",
                                     "¿Cómo resuelves descuadres o discrepancias de conciliación entre la contabilidad financiera (FI) y de costos (CO)?"
                                 ],
        "suggestedTime": "",
        "channel":  "EAS Consulting DB",
        "createdAt":  "2026-08-21T00:39:17.943Z",
        "isEncrypted":  false,
        "vacancyId":  "VAC-VENTAS-101",
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "answer":  "En tu experiencia vendiendo servicios profesionales de TI, ¿cómo aseguras la rentabilidad del esquema tarifario acordado con el cliente?",
                                       "question":  "¿Cómo estructuras y configuras las Áreas de Control (Controlling Area) en SAP CO?"
                                   },
                                   {
                                       "id":  2,
                                       "answer":  "¿De qué manera manejas el proceso de prospección fría para capturar el interés de clientes exigentes en el sector de tecnología?",
                                       "question":  "Describe tu experiencia administrando Contabilidad de Clases de Coste y Centros de Coste (CCA)."
                                   },
                                   {
                                       "id":  3,
                                       "answer":  "Describe una situación donde el cliente cambió los requerimientos del perfil comercial solicitado en pleno cierre de negociación.",
                                       "question":  "¿Cómo gestionas la planificación y el cálculo de coste de producción (Product Cost Controlling)?"
                                   },
                                   {
                                       "id":  4,
                                       "answer":  "¿Cómo utilizas las redes profesionales como LinkedIn Sales Navigator para generar oportunidades comerciales de alto valor?",
                                       "question":  "Explica el análisis de rentabilidad (CO-PA) y cómo estructuras los informes de cuenta de resultados."
                                   },
                                   {
                                       "id":  5,
                                       "answer":  "Platícanos sobre tu mayor reto comercial al negociar con el área legal y compras del cliente.",
                                       "question":  "¿Cómo controlas la imputación de gastos a través de Órdenes Internas y elementos PEP?"
                                   },
                                   {
                                       "id":  6,
                                       "answer":  "¿Qué acciones ejecutas para dar seguimiento post-venta y garantizar la satisfacción total de la cuenta contratante?",
                                       "question":  "¿Cómo resuelves descuadres o discrepancias de conciliación entre la contabilidad financiera (FI) y de costos (CO)?"
                                   },
                                   {
                                       "id":  7,
                                       "answer":  "¿Cuál es tu disponibilidad para integrarse a la vacante? Ej: Una semana, dos días, quince días, etc.",
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "answer":  "¿Cuál fue tu último sueldo mensual bruto (comprobable)?",
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "answer":  "¿Dónde te ubicas geográficamente?",
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "answer":  "¿En qué modalidad de trabajo podrías colaborar (presencial, híbrido o remoto)?",
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  "### 🔍 Reporte de Doble Validación (Double-Check) - EAS Engine AI™\n\n**Candidato:** IVÁN EDUARDO CEDILLO PÉREZ\n**Vacante:** Ejecutivo de Ventas\n**Dictamen de Coherencia:** Validado y Aprobado\n\n#### 📌 Hallazgos Principales:\n1. **Veracidad de Experiencia:** Las respuestas proporcionadas en el cuestionario son coherentes con la trayectoria declarada.\n2. **Disponibilidad y Pretensión:** Se registraron y validaron las respuestas de disponibilidad y remuneración.\n3. **Recomendación:** Proceder a entrevista de profundidad con Capital Humano y Líder Técnico.",
        "interviewSpeech":  "### 📋 Guía de Entrevista Estructurada (EAS Engine AI)\n\n#### 👥 SECCIÓN 1: CAPITAL HUMANO (HR)\n**Objetivo:** Evaluar soft skills, adaptabilidad y fit cultural con EAS Consulting.\n* **Speech/Guión de Apertura:**\n  *\"Hola IVÁN EDUARDO CEDILLO PÉREZ, bienvenido a esta sesión con EAS Consulting Group. Hemos revisado tu trayectoria y las respuestas de tu cuestionario de filtro. Queremos profundizar en tus motivaciones profesionales.\"*\n* **Preguntas Clave para HR:**\n  1. ¿Qué te motiva a unirte a EAS Consulting y cómo consideras que tu perfil agrega valor?\n  2. Describe una situación donde tuviste una diferencia de criterio con un cliente y cómo la resolviste.\n  3. Cuéntame sobre un cambio drástico en las prioridades de un proyecto.\n\n---\n\n#### 🛠️ SECCIÓN 2: LÍDER TÉCNICO (EVALUADOR)\n**Objetivo:** Validar a profundidad el dominio técnico y metodologías de trabajo.\n* **Speech/Guión de Apertura:**\n  *\"Hola IVÁN EDUARDO CEDILLO PÉREZ, en esta sección nos enfocaremos en los desafíos técnicos relacionados con la vacante de Ejecutivo de Ventas. Queremos indagar en tus proyectos previos.\"*\n* **Preguntas Clave:**\n  1. Cuéntame sobre un proyecto donde aplicaste tus habilidades avanzadas como Ejecutivo de Ventas.\n  2. Explica una situación donde un entregable estuvo en riesgo de retraso y qué decisiones tomaste.\n  3. ¿Qué buenas prácticas de control de calidad aplicas cotidianamente?",
        "experience":  [
                           "diferentes sectores empresariales: Corporativos, grandes y medianas empresas, principalmente en el sector financiero, retail e",
                           "a largo plazo y ticket alto, además, he ayudado al fortalecimiento de la relación con los clientes con base en metodologías SPIN y",
                           "Solution Selling, MEDDIC. Completamente orientado al cumplimiento de los objetivos de la organización y enfocado en brindar",
                           "Gerente Comercial de Core Bancario — Efisys"
                       ],
        "education":  [
                          "COMPETENCIAS CLAVE",
                          "Diseño de estrategias comerciales en función del producto y el ICP.",
                          "Amplio conocimiento de ventas consultivas con base en metodologías cómo: SPIN, Solution Selling, MEDDIC, BANT."
                      ],
        "certifications":  [
                               "● Ciclo completo de venta: prospección, calificación, desarrollo de oportunidad, demostración, negociación y cierre; Se",
                               "firmaron 10 contratos en 2.5 años, todos los años superé la cuota que fue creciendo de $500K USD el primer año a $1M",
                               "USD el tercer año. Logré la venta más grande en la empresa con un valor de $800K USD."
                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-1787085610475-233",
        "name":  "Jesús Hernández Padilla",
        "email":  "jehernandezp80@gmail.com",
        "phone":  "55 3030 9741",
        "resumeText":  "Jesús Hernández Padilla\nEjecutivo Comercial Senior B2B • Consultor de Ventas SaaS \u0026 IA • Key Account Management • Salesforce CRM\nCiudad de México • 55 3030 9741 • jehernandezp80@gmail.com • linkedin.com/in/jesús-hernández-padilla-007324169\nPERFIL PROFESIONAL\nEjecutivo comercial senior con más de 8 años de trayectoria sobresaliente en ventas consultivas B2B, desarrollo de negocios y\ngestión de grandes cuentas corporativas (Key Account Management). Especialista en la aceleración de ciclos comerciales\ncomplejos mediante el dominio avanzado de Salesforce CRM, gestión de pipeline y prospección estratégica (Full Cycle Sales).\nHistorial comprobable con cumplimiento promedio superior al 150% de cuota comercial, administración de carteras con más\nde 500 cuentas empresariales y cerca de 5,000 líneas corporativas, y posicionamiento recurrente dentro del Top 25 nacional.\nPerfil altamente adaptable al ecosistema de software empresarial (SaaS), soluciones de Inteligencia Artificial (IA), telemetría\nIoT y conectividad empresarial. Reconocido por construir relaciones comerciales de alto valor, identificar oportunidades en\nentornos altamente competitivos y generar resultados medibles y sostenidos. Experiencia en modalidades presencial, campo y\nremota.\nEXPERIENCIA PROFESIONAL\nEjecutivo Corporativo Master | AT\u0026T México Jun 2020 – May 2022\n▸ Administración y desarrollo estratégico de cartera superior a 500 cuentas corporativas con más de 5,000 líneas y facturación\nmensual de hasta $400,000 MXN.\n▸ Cumplimiento promedio superior al 150% de cuota, superando el 200% en múltiples periodos. Posicionamiento recurrente Top\n25 nacional con reconocimientos corporativos élite.\n▸ Liderazgo en Full Cycle Sales: prospección avanzada, calificación de leads, negociación y cierre. Gestión de pipeline en\nSalesforce CRM y Key Account Management de cuentas clave.\nEjecutivo Sr. de Cuenta Empresarial | AT\u0026T México Feb 2018 – May 2020\n▸ Crecimiento de cartera en segmentos PYME y Corporativo con soluciones de movilidad, conectividad y cloud. Key Account\nManagement a nivel directivo con mínimas tasas de churn.\n▸ Consultative Selling de soluciones empresariales. Múltiples reconocimientos por superación de KPIs en periodos clave.\nEjecutivo Empresarial | AT\u0026T México Mar 2015 – Ene 2018\n▸ Business Development desde cero: prospección activa y apertura de nuevas cuentas en mercado corporativo. Récords internos\nde activaciones y venta cruzada de servicios de valor agregado.\nEjecutivo Universal | AT\u0026T México May 2014 – Feb 2015\n▸ Comercialización de soluciones de telecomunicaciones en punto de venta empresarial. Desarrollo inicial de cartera que\nestableció las bases para la evolución al segmento B2B corporativo.\nEjecutivo de Ventas Empresariales | Corporación Myquelima S.A. de C.V. Jul 2022 – Dic 2022\n▸ Diseño y despliegue de proyecto piloto de ventas PYME — internet fijo y telefonía empresarial en la nube. Optimización de\nprospección y seguimiento mediante Salesforce CRM.\nConsultor Comercial Independiente | Desarrollo Comercial | Capacitación de Fuerzas de Venta |\nProyectos B2B\nEne 2023 – May\n2026\n▸ Asesoramiento estratégico en desarrollo comercial, formación de equipos de venta y optimización de procesos de prospección\npara empresas del sector servicios.\n▸ Aplicación práctica de metodologías de venta consultiva, pipeline management y CRM en entornos de negocio independiente.\nGerente Comercial | Exin Jedua S.A. de C.V. Oct 2006 – Ene 2013\n▸ Gestión comercial integral: prospección, negociación, cierres y desarrollo de relaciones con clientes y proveedores.\nAdministración financiera del área comercial.\n\n-- 1 of 2 --\n\nDocente de Nivel Superior | Universidad ICEL Jul 2001 – Ago 2006\n▸ Impartición de asignaturas y planeación académica. Desarrollo de habilidades de comunicación, presentación y manejo de\naudiencias aplicables a ventas ejecutivas.\nCOMPETENCIAS CLAVE | HERRAMIENTAS | TECNOLOGÍA\nHabilidades: Ventas Consultivas B2B/B2C • Desarrollo de Negocios • Key Account Management • Salesforce CRM • Pipeline\nManagement • Prospección Comercial • Negociación y Cierre • Retención de Cartera • Estrategia Comercial • SaaS \u0026 IA\nEmpresarial • Campo / Híbrido / Remoto\nKeywords ATS: Full Cycle Sales • Prospecting • Account Management • Business Development • Consultative Selling • B2B\nSaaS Sales • Key Account Mgmt • AI Solutions Sales\nHerramientas: Salesforce CRM • Microsoft Office • Google Workspace • Microsoft Teams • Videoconferencias y colaboración\nremota • Herramientas de prospección digital\nCERTIFICACIONES — LINKEDIN LEARNING\nGestión de Cuentas Clave • Networking Profesional • Gestión de Clientes Potenciales • Fundamentos de la Negociación •\nFundamentos de las Ventas • La Ciencia de las Ventas • Lealtad del Cliente • Conversaciones de Ventas • Venta Remota •\nModelos SaaS \u0026 IA (en curso)\nEDUCACIÓN\nIngeniero Arquitecto | Escuela Superior de Ingeniería y Arquitectura — IPN 2005\nEspañol nativo • Inglés funcional — comprensión de lectura y herramientas digitales. Conversacional en desarrollo activo.\n\n-- 2 of 2 --\n\n",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  76,
                             "Comunicación":  99,
                             "Trabajo en Equipo":  85,
                             "Habilidades Técnicas":  64,
                             "Resolución de Problemas":  76
                         },
        "fitScore":  80,
        "initialFitScore":  80,
        "summary":  "[EAS Engine Precalificación Local] El candidato Jesús Hernández Padilla demuestra un perfil sólido orientado a resultados para la posición. Su experiencia teórica y de desarrollo se alinea e idoneidad profesional de manera progresiva. [Alerta: Nivel de inglés insuficiente para perfil SR]. Evaluado analíticamente contra la vacante de \u0027Gerente de Consultoría Funcional SAP S/4HANA - OTC Pro\u0027 encontrando coincidencia de 1 de 7 palabras clave. Dispone de gran potencial de inserción operativa instantánea.",
        "strengths":  [
                          "Sólido nivel de aptitudes alineadas a los requisitos de Gerente de Consultoría Funcional SAP S/4HANA - OTC Pro.",
                          "Sólidas habilidades de comunicación interna.",
                          "Alineamiento rápido con los objetivos de OTC Pro"
                      ],
        "growths":  [
                        "Profundizar en habilidades específicas complementarias de su vacante asignada.",
                        "Alinear espectro salarial y expectativas de contratación con los tabuladores presupuestales."
                    ],
        "recommendedQuestions":  [
                                     "¿Cómo estructuras y configuras las Áreas de Control (Controlling Area) en SAP CO?",
                                     "Describe tu experiencia administrando Contabilidad de Clases de Coste y Centros de Coste (CCA).",
                                     "¿Cómo gestionas la planificación y el cálculo de coste de producción (Product Cost Controlling)?",
                                     "Explica el análisis de rentabilidad (CO-PA) y cómo estructuras los informes de cuenta de resultados.",
                                     "¿Cómo controlas la imputación de gastos a través de Órdenes Internas y elementos PEP?",
                                     "¿Cómo resuelves descuadres o discrepancias de conciliación entre la contabilidad financiera (FI) y de costos (CO)?"
                                 ],
        "suggestedTime": "",
        "channel":  "LinkedIn",
        "createdAt":  "2026-08-21T00:39:17.907Z",
        "isEncrypted":  false,
        "vacancyId":  "VAC-VENTAS-101",
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "¿Cómo estructuras y configuras las Áreas de Control (Controlling Area) en SAP CO?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "Describe tu experiencia administrando Contabilidad de Clases de Coste y Centros de Coste (CCA)."
                                   },
                                   {
                                       "id":  3,
                                       "question":  "¿Cómo gestionas la planificación y el cálculo de coste de producción (Product Cost Controlling)?"
                                   },
                                   {
                                       "id":  4,
                                       "question":  "Explica el análisis de rentabilidad (CO-PA) y cómo estructuras los informes de cuenta de resultados."
                                   },
                                   {
                                       "id":  5,
                                       "question":  "¿Cómo controlas la imputación de gastos a través de Órdenes Internas y elementos PEP?"
                                   },
                                   {
                                       "id":  6,
                                       "question":  "¿Cómo resuelves descuadres o discrepancias de conciliación entre la contabilidad financiera (FI) y de costos (CO)?"
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [
                           "gestión de grandes cuentas corporativas (Key Account Management). Especialista en la aceleración de ciclos comerciales",
                           "complejos mediante el dominio avanzado de Salesforce CRM, gestión de pipeline y prospección estratégica (Full Cycle Sales).",
                           "Historial comprobable con cumplimiento promedio superior al 150% de cuota comercial, administración de carteras con más",
                           "de 500 cuentas empresariales y cerca de 5,000 líneas corporativas, y posicionamiento recurrente dentro del Top 25 nacional."
                       ],
        "education":  [
                          "para empresas del sector servicios.",
                          "▸ Aplicación práctica de metodologías de venta consultiva, pipeline management y CRM en entornos de negocio independiente.",
                          "Gerente Comercial | Exin Jedua S.A. de C.V. Oct 2006 – Ene 2013"
                      ],
        "certifications":  [
                               "Gestión de Cuentas Clave • Networking Profesional • Gestión de Clientes Potenciales • Fundamentos de la Negociación •",
                               "Fundamentos de las Ventas • La Ciencia de las Ventas • Lealtad del Cliente • Conversaciones de Ventas • Venta Remota •",
                               "Modelos SaaS \u0026 IA (en curso)"
                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-1787085610873-740",
        "name":  "Juan M. Trillo González",
        "email":  "juan_m_trillo@yahoo.com.mx",
        "phone":  "+52 56 2708-1494",
        "resumeText":  "Juan M. Trillo González\nFull Cycle Sales Executive | IT \u0026 Tech\nProfesional comercial con 15 años de experiencia en el sector TI, experto en\nprospección activa (SDR) y cierre de acuerdos B2B (AE) enfocado en la generación de\ningresos y el crecimiento de cartera.\njuan_m_trillo@yahoo.com.mx\n+52 56 2708-1494\nPaseos del Sur, Xochimilco\njuanmanueltrillo\nEXPERIENCIA RELEVANTE\nKey Account Manager, AlfaPeople Microsoft Partner, CDMX\nJul 2025 – Presente\nLidero la relación comercial de cuentas clave asegurando la satisfacción del\ncliente y la adopción de soluciones Business Central y Power Platform de\nMicrosoft, logrando una retención y fidelización a largo plazo.\nRecuperé una cuenta estratégica en riesgo renegociando el contrato y\nconvirtiendo el proyecto en un caso de éxito interno en un periodo de 6 meses.\nVenta consultiva, planificación estratégica y análisis , coordinación interna, negociación y cierre.\nIntegrador TI, Practica Independiente, CDMX\nAbr 2023 – Jun 2025\nCapté mas de 12 nuevas empresas para un proveedor de servicios de\nconsultoría e implemetación de SAP mediante estrategias de cold calling y\nNetworking\nElevé la satisfacción del cliente al 95% obteniendo testimonios positivos y\nrecomendaciones directas que aumentaron mi cartera de clientes.\nAutogestión, proactividad y capacidad de venta técnica\nConsultor Comercial, Optimiti Network, CDMX\nSept 2021 - Feb 2023\nAsesoré a directivos de TI en la adopción de herramientas de respuesta a\nincidentes y cumplimiento normativo aumentando la postura de seguridad de la\norganización.\nRealicé evaluaciones de riesgo para más de 15 prospectos, identificando\nbrechas críticas que derivaron en la contratación de servicios de auditoría y\npentesting.\nConocimiento de soluciones , venta consultiva, relacionamiento de alto nivel\nBDM, Seguridata, CDMX\nAbr 2019 - Mar 2020\nSuperé la cuota de ventas mediante la prospección activa y cierre de contactos\nen el sector ciberseguridad\nLideré proyectos de la solución de firma electrónica avanzada en 10 grandes\nempresas, reduciendo tiempos de gestión documental en un 30%\nComunicación efectiva, orientación a resultados y adaptabilidad.\nHABILIDADES\nCRM: Manejo de Salesforce,\nZoho, Hubspot o similar.\nHerramientas de prospección:\nLinkedin Sales Navigator\nConocimiento de TI/SaaS:\nCompresión de conceptos de\nsoftware, nube o\nciberseguridad.\nNetworking: Construcción de\nrelaciones profesionales\nAprendizaje Continuo:\nAdaptación tecnológica rápida\nInvestigación de cuentas:\nIdentificación de tomadores de\ndecisiones\nFORMACIÓN\nLicenciatura en Relaciones\nInternacionales\nUniversidad del Valle de México\n2004 - 2008\nHABILIDADES\nBLANDAS\nProspección en frío\nComunicación persuasiva\nGestión de objeciones\nResiliencia y Trabajo bajo\npresión\nOrganicación y gestión del\ntiempo\nEscucha activa\nIDIOMAS\nInglés B1\n\n-- 1 of 2 --\n\nEXPERIENCIA RELEVANTE\nAccount Manager, Ricoh IT Services Latin America, CDMX\nAbr 2016 - Abr 2019\nCoordiné equipos tecnicos internos para implementar soluciones de\nCiberseguridad y Cloud, cumpliendo con los plazos de entrega en el 100% de\nlos casos\nDesarrollé nuevas cuentas en diferentes sectores superando mi cuota anual en\nun 15%\nPensamiento estratégico, resiliencia, manejojo de CRM y venta consultiva\nConsultor Comercial SAP B1, Dexterity, CDMX\nJul 2013 - Abr 2016\nIncrementé la cartera de clientes de SAP Business One en un 80% abarcando la\nCiudad de México y sus alrededores.\nIdentifiqué necesidades operativas en empresas de sector manufactura y salud\nlogrando la venta de soluciones integrales (licencias, servicios y Add Ons\npropios de Dexterity) con los que incrementé el valor del deal en un 30%\nNegociación de alto nivel, comunicación asertiva y orientación a resultados\nConsultor Comercial SAP B1, Sineti Consulting, CDMX\nAgo 2011 - Jul 2013\nAperturé la linea de negocio de SAP B1 desde cero y logré vender 10 proyectos\nen el primer año\nLideré la venta del proyecto de SAP Business One más elevado en la historia de\nSineti Consulting en el periodo 2011 - 2013 con un valor de 150k\nDominio Funcional de SAP B1, procesos de negocio , negociación y cierre y trabajo en equipo.\nSubgerente de Atención a Clientes, UP Sí Vale, CDMX\nJul 2007 - Abr 2011\nIncrementé el índice de satisfacción al cliente del 82% al 95% y reduje el tiempo\nde respuesta en un 30% mediante la implementación de nuevas estrategias de\nsoporte en tiempo real y la automatización de consultas frecuentes sobre\nsaldos y activación de tarjetas.\nDisminuí la tasa de cancelación de clientes corporativos en un 15% mediante el\ndesarrollo de un programa de seguimiento proactivo y atención personalizada\npara cuentas clave.\nLiderazgo, Capacitación, Resolución de conflictos, optimización de procesos, empatía y escucha\nactiva\n\n-- 2 of 2 --\n\n",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  92,
                             "Comunicación":  82,
                             "Trabajo en Equipo":  65,
                             "Habilidades Técnicas":  56,
                             "Resolución de Problemas":  81
                         },
        "fitScore":  75,
        "initialFitScore":  75,
        "summary":  "[EAS Engine Precalificación Local] El candidato Juan M. Trillo González demuestra un perfil sólido orientado a resultados para la posición. Su experiencia teórica y de desarrollo se alinea e idoneidad profesional de manera progresiva. [Alerta: Nivel de inglés insuficiente para perfil SR]. Evaluado analíticamente contra la vacante de \u0027Gerente de Consultoría Funcional SAP S/4HANA - OTC Pro\u0027 encontrando coincidencia de 2 de 7 palabras clave. Dispone de gran potencial de inserción operativa instantánea.",
        "strengths":  [
                          "Sólido nivel de aptitudes alineadas a los requisitos de Gerente de Consultoría Funcional SAP S/4HANA - OTC Pro.",
                          "Sólidas habilidades de comunicación interna.",
                          "Alineamiento rápido con los objetivos de OTC Pro"
                      ],
        "growths":  [
                        "Profundizar en habilidades específicas complementarias de su vacante asignada.",
                        "Alinear espectro salarial y expectativas de contratación con los tabuladores presupuestales."
                    ],
        "recommendedQuestions":  [
                                     "¿Cómo estructuras y configuras las Áreas de Control (Controlling Area) en SAP CO?",
                                     "Describe tu experiencia administrando Contabilidad de Clases de Coste y Centros de Coste (CCA).",
                                     "¿Cómo gestionas la planificación y el cálculo de coste de producción (Product Cost Controlling)?",
                                     "Explica el análisis de rentabilidad (CO-PA) y cómo estructuras los informes de cuenta de resultados.",
                                     "¿Cómo controlas la imputación de gastos a través de Órdenes Internas y elementos PEP?",
                                     "¿Cómo resuelves descuadres o discrepancias de conciliación entre la contabilidad financiera (FI) y de costos (CO)?"
                                 ],
        "suggestedTime": "",
        "channel":  "LinkedIn",
        "createdAt":  "2026-08-21T00:39:17.878Z",
        "isEncrypted":  false,
        "vacancyId":  "VAC-VENTAS-101",
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "¿Cómo estructuras y configuras las Áreas de Control (Controlling Area) en SAP CO?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "Describe tu experiencia administrando Contabilidad de Clases de Coste y Centros de Coste (CCA)."
                                   },
                                   {
                                       "id":  3,
                                       "question":  "¿Cómo gestionas la planificación y el cálculo de coste de producción (Product Cost Controlling)?"
                                   },
                                   {
                                       "id":  4,
                                       "question":  "Explica el análisis de rentabilidad (CO-PA) y cómo estructuras los informes de cuenta de resultados."
                                   },
                                   {
                                       "id":  5,
                                       "question":  "¿Cómo controlas la imputación de gastos a través de Órdenes Internas y elementos PEP?"
                                   },
                                   {
                                       "id":  6,
                                       "question":  "¿Cómo resuelves descuadres o discrepancias de conciliación entre la contabilidad financiera (FI) y de costos (CO)?"
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [
                           "prospección activa (SDR) y cierre de acuerdos B2B (AE) enfocado en la generación de",
                           "ingresos y el crecimiento de cartera.",
                           "juan_m_trillo@yahoo.com.mx",
                           "+52 56 2708-1494"
                       ],
        "education":  [
                          "Licenciatura en Relaciones",
                          "Internacionales",
                          "Universidad del Valle de México"
                      ],
        "certifications":  [

                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-1787085611905-452",
        "name":  "PABLO URIEL LUNA ROBLES",
        "email":  "hbk8400@hotmail.com",
        "phone":  "55 44884079",
        "resumeText":  "PABLO URIEL LUNA ROBLES\nTel 55 44884079\nM@il: hbk8400@hotmail.com\nRESUMEN DE TRAYECTORIA\nConsultor comercial especializado en soluciones de TI con 15 años de experiencia comprobada en partners\nde soluciones de negocio de TI para fabricantes líderes como Microsoft, Google, AWS, Salesforce.com,\nAdobe, Autodesk, Lenovo y HP. Cuento con sólidas habilidades en la creación y escalamiento de startups\ny un conocimiento integral de la operación completa de un Partner de TI. Mi experiencia abarca la totalidad\nde los procesos comerciales, desde la generación de ventas (hunter) hasta el crecimiento sostenido y la\ngestión de cuentas (farming).\nEDUCACIÓN\n• 2002-2007 Escuela Bancaria y Comercial. Licenciatura en Mercadotecnia.\nEXPERIENCIA LABORAL\n• Actiglobal – Account Manager – (01/10/2021 – A la fecha)\nDesarrollo y cierre de oportunidades para las ofertas de colaboración\ny productividad a través de Office 365, habilitación de infraestructura,\ncontenedores migración de aplicaciones, bases de datos, escritorios\nvirtuales a través de Windows Azure en colaboración con el equipo\nde atención de los segmentos corporate y Enterprise de Microsoft\ndonde el foco va en función del despliegue de servicios acompañado\nde suscripciones vía Cloud Solution Providor. De igual manera,\ndesarrollo de oportunidades para ofertas de staffing para usuario final.\nDespliegue de proyectos para la parte de mesas de servicio para\nservicios administrados basadas en tecnologías Microsoft para usuario\nfinal donde los principales clientes atendidos fueron Aeroméxico,\nPaquete Express y Senado de la Republica\n• C3ntro Telecom - Sales Specialist Microsoft Enterprise\nProductivity – (01/08/2019 – 30/09/2021) Desarrollo y cierre de\noportunidades para las ofertas de Cloud PBX a través de Microsoft\nTeams Phone System, coaboración y productividad a través de office\n365, habilitación de gestión de dispositivos y seguridas vía EM+S,\nsoluciones de continuidad de negocio e infraestructura en la nube a\ntravés de Windows Azure, Despliegue en proyectos de gestión de de\nclientes, oportunidades de negocio, seguimiento a clientes a través de\nla solución Dynamics CRM donde los principales clientes generados\nfueron Krispy Kremme México, Grupo Gayosso y RLH Properties\n• OFI México – (26/12/17 – 31/07/19) – Key Account Manager –\nResponsable de generación de nuevo negoció y atracción de nuevos\nclientes con objeto de impulsar e incrementar las ventas en las\ndiferentes líneas de negocio de la compañía, las cuales van en función\nde software, hardware y staffing de TI para administración y\n\n-- 1 of 3 --\n\ndespliegue de soluciones, así como para fabrica de software, adicional\npara marcas como Microsoft, Google, Amazon Web Services, HP,\nDell, Lenovo, entre otras. Dentro de las principales tecnologías\nvendidas esta la parte de colaboración y productividad con Office 365,\nseguridad con EM+S, aplicaciones de negocio con Dynamcs CRM y\nSalesforce.com y aplicaciones para la gestión empresarial como Oracle\nNetsuite. Dentro de los principales clientes de OFI esta GAIA,\nGrupo Fernandez Hinojosa y Kidzania\n• DataVisión Digital (23/11/15 – 26/12/17) – Account Manager\nUnidad de Negocios Microsoft – Responsable de generar nuevo\nnegocio en base de clientes existentes, así como atracción de cuentas\nnuevas para la administración de contratos de licenciamiento de\nsoftware Microsoft en empresas de iniciativa privada. Dentro de las\ncuentas de base instalada se encuentran, Grupo Presidente,\nLaboratorios Liomont, Nadro, Manufacturas Rassini, Exitus\nCredit,Hogares Unión\nResponsable de generación de proyectos asociados al despliegue de\nservicios referentes a tecnologías como Windows Azure, Office 365,\nEM+S y la parte de aplicaciones de negocio como Dynaamics CRM,\nSystem Center para la gestión y despliegue de servicios de mesas de\nservicio para usuario final y SharePoint\n• Grupo CEPRA (15/10/13 – 18/11/15) Ejecutivo de ventas\nMicrosoft – Responsable de generación y atracción de cuentas\nnuevas para contratos de licenciamiento Microsoft (Enterprise\nAgreement, MPSA, Enrollment for Education Solutions, Open Value\nSuscription) en los sectores de educación y gobierno. En donde las\nprincipales cuentas bajo mi responsabilidad fueron Colegio Nacional\nde Educación Técnica y Profesional, Aliat Universidades, Instituto\nPolitecnico Nacional – CINVESTAV, Secretaría de Educación\nPública, Laureate Education, Colegio de Bachilleres del Estado de\nPuebla, Universidad La Salle, Universidad Autonoma del Estado de\nMorelos, Servicio Postal Mexicano, Oportunidades – Programa de\nInclusión Social,Secretaría de comunicaciones y Transportes, IC\nIntracom, Instituto Nacional de Ecología\nResponsable de la generación de proyectos de servicios asociados al\ndespliegue de tecnologías Microsoft como Office 365, System Center\npara la parte de mesas de servicio para la gestión y atención de usuario\nfinal y Skype Empresarial.\nAsí mismo, responsable del seguimiento post-venta de los contratos\ngenerados a través de la metodología T-36 orientada al uso correcto\nde licenciamiento, consumo de beneficios de Software Assurance y\nejecución de Assesments orientados a la madurez de las áreas de TI\n(IOM Assesment) y la gestión de activos de Software (SAM)\nApoyo en la planeación y ejecución de actividades de marketing\nreferentes a la generación y maduración de leads y prospectos de\nventa.\n• SoftwareOne México (16/06/2011 – 09/09/13) Business\nDevelopement Representative. Generación de Nuevas\noportunidades de Negocio en lo que refiere a la parte de\nlicenciamiento de Software para los principales fabricantes de\nsoftware a nivel mundial. Seguimiento a base instalada de clientes,\nmediante el apoyo en activación y seguimiento en cuanto al\nconsumo de beneficios de Software Assurance propios de los\n\n-- 2 of 3 --\n\ncontratos de licenciamiento de Software. Apoyo en el crecimiento\nde cuentas mediante el apoyo en seguimiento a presentación de\npropuestas de valor. Colaboración con susbidiarias de otros paises\npara seguimiento y administración de esquemas de licenciamiento a\nnivel local en empresas e instituciones tales como Bausch \u0026 Lomb,\nAllianz, Office Max, Continental, Universidad Iberoamericana,\nConsejo Nacional de Ciencia y Tecnología (CONACYT y sus 32\ncentros de estudio) y Laureate Education. Campañas de marketing\ndirecto para generación de nuevos prospectos orientado hacia la\nparte de Enterprise Agreement \u0026 Select Agreement de Microsoft\npara impulsar la parte de soluciones Microsoft al readedor de la parte\nde escritorio, servicodres y aplicaciones de negocio en nube u on\nprem (Office 365, Dynamics AX, Dynamics CRM, System Center,\nWindows server, SQL Server) Participación en el diseño,\nimplementación y puesta en marcha de Dynamics CRM 4.0 On Line\ny Dynamics NAV (ERP Corporativo), adicionalmente participando\nen la elaboración y ejecución de la capacitación a usuarios clave de\ndichos programas\nHABILIDADES\nIdiomas:\n• Ingles (90%) Examen TOEIC 780 Pts\nHerramientas:\n• Manejo de office (80%)\n• Adobe Creative Suite 4 (PhotoShop, Illustrator, Indesign,\nFireworks, Dreamweaver, Flash) Intermedio.\n• Manejo de Microsoft Dynamics-CRM (80%)\n• Manejo de salesforce.com CRM (80%)\n• Manejo de Microsoft Dynamics NAV (90%)\n• Manejo de Microsoft Dynamics SL (Modulo de requisiciones y\nórdenes de compra)\n• Manejo de Google ADwords (60%)\n\n-- 3 of 3 --\n\n",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  75,
                             "Comunicación":  74,
                             "Trabajo en Equipo":  67,
                             "Habilidades Técnicas":  64,
                             "Resolución de Problemas":  68
                         },
        "fitScore":  70,
        "initialFitScore":  70,
        "summary":  "[EAS Engine Precalificación Local] El candidato PABLO URIEL LUNA ROBLES demuestra un perfil sólido orientado a resultados para la posición. Su experiencia teórica y de desarrollo se alinea e idoneidad profesional de manera progresiva. [Alerta: Nivel de inglés insuficiente para perfil SR]. Evaluado analíticamente contra la vacante de \u0027Gerente de Consultoría Funcional SAP S/4HANA - OTC Pro\u0027 encontrando coincidencia de 0 de 7 palabras clave. Dispone de gran potencial de inserción operativa instantánea.",
        "strengths":  [
                          "Sólido nivel de aptitudes alineadas a los requisitos de Gerente de Consultoría Funcional SAP S/4HANA - OTC Pro.",
                          "Sólidas habilidades de comunicación interna.",
                          "Alineamiento rápido con los objetivos de OTC Pro"
                      ],
        "growths":  [
                        "Profundizar en habilidades específicas complementarias de su vacante asignada.",
                        "Alinear espectro salarial y expectativas de contratación con los tabuladores presupuestales."
                    ],
        "recommendedQuestions":  [
                                     "¿Cómo estructuras y configuras las Áreas de Control (Controlling Area) en SAP CO?",
                                     "Describe tu experiencia administrando Contabilidad de Clases de Coste y Centros de Coste (CCA).",
                                     "¿Cómo gestionas la planificación y el cálculo de coste de producción (Product Cost Controlling)?",
                                     "Explica el análisis de rentabilidad (CO-PA) y cómo estructuras los informes de cuenta de resultados.",
                                     "¿Cómo controlas la imputación de gastos a través de Órdenes Internas y elementos PEP?",
                                     "¿Cómo resuelves descuadres o discrepancias de conciliación entre la contabilidad financiera (FI) y de costos (CO)?"
                                 ],
        "suggestedTime": "",
        "channel":  "LinkedIn",
        "createdAt":  "2026-08-21T00:39:17.800Z",
        "isEncrypted":  false,
        "vacancyId":  "VAC-VENTAS-101",
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "¿Cómo estructuras y configuras las Áreas de Control (Controlling Area) en SAP CO?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "Describe tu experiencia administrando Contabilidad de Clases de Coste y Centros de Coste (CCA)."
                                   },
                                   {
                                       "id":  3,
                                       "question":  "¿Cómo gestionas la planificación y el cálculo de coste de producción (Product Cost Controlling)?"
                                   },
                                   {
                                       "id":  4,
                                       "question":  "Explica el análisis de rentabilidad (CO-PA) y cómo estructuras los informes de cuenta de resultados."
                                   },
                                   {
                                       "id":  5,
                                       "question":  "¿Cómo controlas la imputación de gastos a través de Órdenes Internas y elementos PEP?"
                                   },
                                   {
                                       "id":  6,
                                       "question":  "¿Cómo resuelves descuadres o discrepancias de conciliación entre la contabilidad financiera (FI) y de costos (CO)?"
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [
                           "de soluciones de negocio de TI para fabricantes líderes como Microsoft, Google, AWS, Salesforce.com,",
                           "de los procesos comerciales, desde la generación de ventas (hunter) hasta el crecimiento sostenido y la",
                           "gestión de cuentas (farming).",
                           "Actiglobal – Account Manager – (01/10/2021 – A la fecha)"
                       ],
        "education":  [
                          "Escuela Bancaria y Comercial. Licenciatura en Mercadotecnia.",
                          "principales cuentas bajo mi responsabilidad fueron Colegio Nacional",
                          "Pública, Laureate Education, Colegio de Bachilleres del Estado de"
                      ],
        "certifications":  [

                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-1787085611519-515",
        "name":  "Miguel A. Sánchez",
        "email":  "masancer21@gmail.com",
        "phone":  "56-1844-1201",
        "resumeText":  "Sobre mí\nCursos y Certificaciones\nIdiomas\nHabilidades\nExperiencia laboral\nDatos académicos\n56-1844-1201\n-Business Developmet\n-Digital Transformación\n-Partner Enablement\n-Construcción de relaciones\n-Negociación\n-Pensamiento estratégico\n-Trabajo en equipo\n-CRM\n-B2B - B2C\nUniversidad Tecnológica de México\n(UNITEC) Campus Ecatepec 2007-2010\n(sin titulo\nIng. Sistemas Computacionales\nEspañol Nativo\n100%\nInglés:\n50% Nivel Medio\nCCSP (CITRIX CERTIFIED SALES\nPROFESSIONAL) 2012 Y 2013\nMiguel A. Sánchez\nCLIENT VIRTUALIZATION – E0111\nMiguel A. Sánchez\nGOVERNMENT ACQUISITIONS LAW\nMicrosoft 365 Certified: Modern\nDesktop Administrator Associate\nMicrosoft Office Specialist: Expert\n(Office 2019)\nAccount Manager SMB\nCloud Continuity System Services. | Agosto 2023 - Septiembre 2024\nAccount Manager Microsoft Enterprise\nMainbit. | Noviembre 2015 - Abril 2017\nI N G . S I S T E M A S C O M P U T A C I O N A L E S\nMiguel A. Sánchez\nmasancer21@gmail.com\nGustavo A. Madero\nCDMX\nCuento con una experiencia de más de 18 años en el mundo de Consultoria\nde IT, soy una persona responsable y comprometida con mis objetivos tanto\npersonales como laborales, me encanta seguir aprendiendo nuevas\ntecnologias y tendencias actuales que tengan impacto productivo en mi y\nlos que me rodean.\nAccount Manager Microsoft\nBSIDE | Febrero 2023 - Agosto 2023\nProduct Manager Microsoft\nMayorista Nexsys de Mexico | Abril 2017 - Febrero 2023\nAccount Manager\nProcesa Network. | Junio 2014 - Noviembre 2015\nDesarrollo de nuevos negocios, integrando nuevos clientes a la cartera manteniendo la\nrelacion y confianza con cada uno de ellos. Desarrollo de estrategias comerciales,\nprospeccion de nuevos clientes, ventas consultivas y manejo de ralacion con clientes.\nDesarrollo de nuevos negocios, integrando nuevos clientes a la cartera manteniendo la\nrelacion y confianza con cada uno de ellos. Desarrollo de estrategias comerciales,\nprospeccion de nuevos clientes, ventas consultivas, manejo de ralacion con clientes y\nproveedores.\nGerencia de la marca dentro del Mayorista, generando cartera nueva para esta nueva division\nde negocio, realizando deteccion y Desarrollo de canales, activacion de usuarios en consola\nde O365, Azure, portal Volume Licensing, generacion de planes de trabajo, planes de\nmarketing, planes de generación de demanda, cumplimientos de cuotas, cumpliendo todo el\nproceso de venta desde la detección de un negocio pasando por el desarrollo hasta el cierre\ndel mismo\nGerencia y control de base instalada y nuevos clientes de bSide para el Modelo de Negocio de\nCSP de Microsoft llevadolos por una consultoria para las mejoras en su empresa, teniendo\nconversaciones con CEO, CTO y CFO para la propuesta Tecnológica más adecuada. Creación\nde estrategias de generación de demanda y business plan para el cumplimiento de los KPI\u0027s\npropuestos por Dirección\nVenta de soluciones · Venta consultiva · Proceso de ventas para empresas B2B · Gestion de\ncuentas · Estrategia de ventas · Negociaciones estrategicas · Análisis de negocio · Capacidad\nde análisis · Desarrollo de relaciones · Adquisición de nuevos clientes\nREDINET - IWS MEXICO | Octubre 2024 - Actual\nSales CoordinatorCoordinador de equipo de ventas realizando estrategias comerciales y cumplimiento de\nmetricas y cuota aun asi realizando Venta de soluciones · Venta consultiva · Proceso de\nventas para empresas B2B · Gestion de cuentas · Estrategia de ventas · Negociaciones\nestrategicas · Análisis de negocio · Capacidad de análisis · Desarrollo de relaciones ·\nAdquisición de nuevos clientes\nAccount Manager CITRIX\nMayorista TEAM | Septiembre 2012 - Noviembre 2013\nDesarrollo y control de cuentas del sector Financiero para venta de soluciones y servicios de\nVirtualizacion Citrix, apoyando la parte comercial para el seguimiento y control del Pipeline,\ntrabajando de la mano con el Gerente de Ventas y Canales de Citrix para el cierre de\nproyectos\n\n-- 1 of 2 --\n\nCursos y Certificaciones\nIdiomas\nHabilidades\nExperiencia laboral\nDatos académicos\n56-1844-1201\n-Business Developmet\n-Digital Transformación\n-Partner Enablement\n-Construcción de relaciones\n-Negociación\n-Pensamiento estratégico\n-Trabajo en equipo\n-CRM\n-B2B - B2C\nUniversidad Tecnológica de México\n(UNITEC) Campus Ecatepec 2007-2010\n(sin titulo\nIng. Sistemas Computacionales\nEspañol Nativo\n100%\nInglés:\n50% Nivel Medio\nCCSP (CITRIX CERTIFIED SALES\nPROFESSIONAL) 2012 Y 2013\nMiguel A. Sánchez\nCLIENT VIRTUALIZATION – E0111\nMiguel A. Sánchez\nGOVERNMENT ACQUISITIONS LAW\nMicrosoft 365 Certified: Modern\nDesktop Administrator Associate\nMicrosoft Office Specialist: Expert\n(Office 2019)\nI N G . S I S T E M A S C O M P U T A C I O N A L E S\nMiguel A. Sánchez\nmasancer21@gmail.com\nGustavo A. Madero\nCDMX\nProduct Manager Microsoft\nIWS de México. | Abril 2011 - Septiembre 2012\nDeveloper Solution Specialist\nTPAM OEM\nTPAM GEO\nOpportunity Manager\nMSPP Solution\nMicrosoft (ATENTO) | Abril 2006 - Abril 2011\nDesarrollo de cuentas EPG, CAM y SMS\u0026P para venta de soluciones y licenciamiento Microsoft,\nasi como llevar el control de la marca dentro de la empresa como ventas, capacitaciones, visitas\ncon clientes, revisiones de pipeline y Forecast con nuestro PAM (Verónica Palencia), liderando un\nequipo de Consultores.\nLider de proyecto en Call Center de Generacion de Demanda para Dell Mexico, tomando en\ncuenta la participación en la creación del CRM para el control de la base de datos asi como de las\noportunidades de negocio generadas por los 5 ejecutivos a mi cargo, enviando reportes\nsemanales de las oportunidades generadas y status de la base de datos.\n\n-- 2 of 2 --\n\n",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  89,
                             "Comunicación":  81,
                             "Trabajo en Equipo":  72,
                             "Habilidades Técnicas":  61,
                             "Resolución de Problemas":  71
                         },
        "fitScore":  75,
        "initialFitScore":  75,
        "summary":  "[EAS Engine Precalificación Local] El candidato DELL CERTIFICATE OF EDUCATION demuestra un perfil sólido orientado a resultados para la posición. Su experiencia teórica y de desarrollo se alinea e idoneidad profesional de manera progresiva. [Alerta: Nivel de inglés insuficiente para perfil SR]. Evaluado analíticamente contra la vacante de \u0027Gerente de Consultoría Funcional SAP S/4HANA - OTC Pro\u0027 encontrando coincidencia de 1 de 7 palabras clave. Dispone de gran potencial de inserción operativa instantánea.",
        "strengths":  [
                          "Sólido nivel de aptitudes alineadas a los requisitos de Gerente de Consultoría Funcional SAP S/4HANA - OTC Pro.",
                          "Sólidas habilidades de comunicación interna.",
                          "Alineamiento rápido con los objetivos de OTC Pro"
                      ],
        "growths":  [
                        "Profundizar en habilidades específicas complementarias de su vacante asignada.",
                        "Alinear espectro salarial y expectativas de contratación con los tabuladores presupuestales."
                    ],
        "recommendedQuestions":  [
                                     "¿Cómo estructuras y configuras las Áreas de Control (Controlling Area) en SAP CO?",
                                     "Describe tu experiencia administrando Contabilidad de Clases de Coste y Centros de Coste (CCA).",
                                     "¿Cómo gestionas la planificación y el cálculo de coste de producción (Product Cost Controlling)?",
                                     "Explica el análisis de rentabilidad (CO-PA) y cómo estructuras los informes de cuenta de resultados.",
                                     "¿Cómo controlas la imputación de gastos a través de Órdenes Internas y elementos PEP?",
                                     "¿Cómo resuelves descuadres o discrepancias de conciliación entre la contabilidad financiera (FI) y de costos (CO)?"
                                 ],
        "suggestedTime": "",
        "channel":  "LinkedIn",
        "createdAt":  "2026-08-21T00:39:17.682Z",
        "isEncrypted":  false,
        "vacancyId":  "VAC-VENTAS-101",
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "¿Cómo estructuras y configuras las Áreas de Control (Controlling Area) en SAP CO?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "Describe tu experiencia administrando Contabilidad de Clases de Coste y Centros de Coste (CCA)."
                                   },
                                   {
                                       "id":  3,
                                       "question":  "¿Cómo gestionas la planificación y el cálculo de coste de producción (Product Cost Controlling)?"
                                   },
                                   {
                                       "id":  4,
                                       "question":  "Explica el análisis de rentabilidad (CO-PA) y cómo estructuras los informes de cuenta de resultados."
                                   },
                                   {
                                       "id":  5,
                                       "question":  "¿Cómo controlas la imputación de gastos a través de Órdenes Internas y elementos PEP?"
                                   },
                                   {
                                       "id":  6,
                                       "question":  "¿Cómo resuelves descuadres o discrepancias de conciliación entre la contabilidad financiera (FI) y de costos (CO)?"
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [
                           "Datos académicos",
                           "Business Developmet",
                           "de IT, soy una persona responsable y comprometida con mis objetivos tanto",
                           "personales como laborales, me encanta seguir aprendiendo nuevas"
                       ],
        "education":  [
                          "Partner Enablement",
                          "Construcción de relaciones",
                          "Negociación"
                      ],
        "certifications":  [
                               "Idiomas",
                               "CLIENT VIRTUALIZATION – E0111",
                               "GOVERNMENT ACQUISITIONS LAW"
                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-1784770424187-601",
        "name":  "Israel Reyes Varela",
        "email":  "isrrarv@hotmail.com",
        "phone":  "+52 55 15593645",
        "resumeText":  "and change my residence. es un especialista enfocado en el sector de Data Analyst, con aptitudes analíticas e idoneidad profesional evaluada para EAS Consulting. Sus canales de contacto son el correo isrrarv@hotmail.com y su teléfono móvil +52 55 15593645.",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  55,
                             "Comunicación":  81,
                             "Trabajo en Equipo":  65,
                             "Habilidades Técnicas":  74,
                             "Resolución de Problemas":  76
                         },
        "fitScore":  70,
        "initialFitScore":  70,
        "summary":  "[EAS Engine Precalificación Local] El candidato and change my residence. demuestra un perfil sólido orientado a resultados para la posición. Su experiencia teórica y de desarrollo se alinea e idoneidad profesional de manera progresiva. Dispone de gran potencial de inserción operativa instantánea.",
        "strengths":  [
                          "Fuerte base metodológica descrita en su perfil de talento.",
                          "Sólidas habilidades de comunicación organizacional.",
                          "Alineamiento ético y profesional con los valores de consultoría de EAS."
                      ],
        "growths":  [
                        "Profundizar en metodologías y herramientas de control ágiles modernas.",
                        "Potencial mejora en administración financiera o gestión de flujos de valor."
                    ],
        "recommendedQuestions":  [
                                     "¿Cómo gestionas la comunicación con el equipo y clientes en situaciones de alta presión operando bajo tu perfil de: consultor?",
                                     "Describe un proyecto en el cual utilizaste metodologías específicas de Capital Humano para optimizar procesos.",
                                     "¿Menciona un reto técnico o de liderazgo que resolviste exitosamente y qué competencias pusiste en juego?",
                                     "¿Cómo manejas las diferencias de criterio profesional dentro de un equipo multidisciplinario?",
                                     "¿Qué estrategias utilizas para mantenerte actualizado con las mejores prácticas y tendencias de tu especialidad?"
                                 ],
        "suggestedTime": "",
        "channel":  "LinkedIn",
        "createdAt":  "2026-08-20T23:56:39.960Z",
        "isEncrypted":  false,
        "vacancyId":  null,
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "¿Cómo gestionas la comunicación con el equipo y clientes en situaciones de alta presión operando bajo tu perfil de: consultor?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "Describe un proyecto en el cual utilizaste metodologías específicas de Capital Humano para optimizar procesos."
                                   },
                                   {
                                       "id":  3,
                                       "question":  "¿Menciona un reto técnico o de liderazgo que resolviste exitosamente y qué competencias pusiste en juego?"
                                   },
                                   {
                                       "id":  4,
                                       "question":  "¿Cómo manejas las diferencias de criterio profesional dentro de un equipo multidisciplinario?"
                                   },
                                   {
                                       "id":  5,
                                       "question":  "¿Qué estrategias utilizas para mantenerte actualizado con las mejores prácticas y tendencias de tu especialidad?"
                                   },
                                   {
                                       "id":  6,
                                       "question":  "¿Cómo mides y reportas el impacto o retorno de inversión de las iniciativas que implementas en tu área?"
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [

                       ],
        "education":  [

                      ],
        "certifications":  [

                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-1784770423134-947",
        "name":  "Fernando Bautista",
        "email":  "fbautista@geeks.ms",
        "phone":  "11977716940",
        "resumeText":  "Información personal es un especialista enfocado en el sector de Data Analyst, con aptitudes analíticas e idoneidad profesional evaluada para EAS Consulting. Sus canales de contacto son el correo fbautista@geeks.ms y su teléfono móvil 11977716940.",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  68,
                             "Comunicación":  80,
                             "Trabajo en Equipo":  85,
                             "Habilidades Técnicas":  71,
                             "Resolución de Problemas":  70
                         },
        "fitScore":  75,
        "initialFitScore":  75,
        "summary":  "[EAS Engine Precalificación Local] El candidato Información personal demuestra un perfil sólido orientado a resultados para la posición. Su experiencia teórica y de desarrollo se alinea e idoneidad profesional de manera progresiva. Dispone de gran potencial de inserción operativa instantánea.",
        "strengths":  [
                          "Fuerte base metodológica descrita en su perfil de talento.",
                          "Sólidas habilidades de comunicación organizacional.",
                          "Alineamiento ético y profesional con los valores de consultoría de EAS."
                      ],
        "growths":  [
                        "Profundizar en metodologías y herramientas de control ágiles modernas.",
                        "Potencial mejora en administración financiera o gestión de flujos de valor."
                    ],
        "recommendedQuestions":  [
                                     "¿Cómo gestionas la comunicación con el equipo y clientes en situaciones de alta presión operando bajo tu perfil de: consultor?",
                                     "Describe un proyecto en el cual utilizaste metodologías específicas de Capital Humano para optimizar procesos.",
                                     "¿Menciona un reto técnico o de liderazgo que resolviste exitosamente y qué competencias pusiste en juego?",
                                     "¿Cómo manejas las diferencias de criterio profesional dentro de un equipo multidisciplinario?",
                                     "¿Qué estrategias utilizas para mantenerte actualizado con las mejores prácticas y tendencias de tu especialidad?"
                                 ],
        "suggestedTime": "",
        "channel":  "LinkedIn",
        "createdAt":  "2026-08-20T23:56:39.947Z",
        "isEncrypted":  false,
        "vacancyId":  null,
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "¿Cómo gestionas la comunicación con el equipo y clientes en situaciones de alta presión operando bajo tu perfil de: consultor?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "Describe un proyecto en el cual utilizaste metodologías específicas de Capital Humano para optimizar procesos."
                                   },
                                   {
                                       "id":  3,
                                       "question":  "¿Menciona un reto técnico o de liderazgo que resolviste exitosamente y qué competencias pusiste en juego?"
                                   },
                                   {
                                       "id":  4,
                                       "question":  "¿Cómo manejas las diferencias de criterio profesional dentro de un equipo multidisciplinario?"
                                   },
                                   {
                                       "id":  5,
                                       "question":  "¿Qué estrategias utilizas para mantenerte actualizado con las mejores prácticas y tendencias de tu especialidad?"
                                   },
                                   {
                                       "id":  6,
                                       "question":  "¿Cómo mides y reportas el impacto o retorno de inversión de las iniciativas que implementas en tu área?"
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [

                       ],
        "education":  [

                      ],
        "certifications":  [

                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-1784770565050-922",
        "name":  "Brenda Susana Ramírez Regis",
        "email":  "rr_more_sb@hotmail.com",
        "phone":  "94018112683",
        "resumeText":  "Ingeniera en Electrónica y Telemática con sólida experiencia en control de calidad de software (QA), certificada en ISTQB y Scrum. Especializada en pruebas funcionales, de regresión y automatización en plataformas web y móviles utilizando herramientas como JIRA, ALM y SQL Server. Destaca por su capacidad de liderazgo de equipos y gestión bajo metodologías ágiles.",
        "stage":  "Contratado",
        "competencies":  {
                             "Liderazgo":  85,
                             "Comunicación":  88,
                             "Trabajo en Equipo":  90,
                             "Habilidades Técnicas":  92,
                             "Resolución de Problemas":  89
                         },
        "fitScore":  89,
        "initialFitScore":  89,
        "summary":  "Brenda es una Ingeniera en Electrónica y Telemática con un perfil técnico-metodológico sobresaliente, ideal para el rol de Consultora / Especialista General en EAS Consulting. Su certificación ISTQB y Scrum, combinada con su sólida trayectoria en aseguramiento de calidad (QA) y automatización, la capacita para estructurar y auditar procesos de entrega de software con alta rigurosidad técnica. Demuestra una excelente habilidad para actuar como puente de comunicación efectiva entre equipos de desarrollo y directivos de negocio, asegurando altos estándares de calidad y adopción de mejores prácticas ágiles.",
        "strengths":  [
                          "Sólida formación metodológica con certificaciones ISTQB y Scrum, garantizando procesos de QA de estándar internacional.",
                          "Experiencia práctica robusta en automatización, pruebas funcionales, de regresión y manejo de bases de datos con SQL Server.",
                          "Capacidad probada para coordinar y liderar células de trabajo bajo metodologías ágiles, maximizando la eficiencia operativa."
                      ],
        "growths":  [
                        "Necesidad de adaptar su enfoque técnico de QA hacia una visión estratégica y de consultoría de negocios más amplia.",
                        "Oportunidad para incursionar en la automatización de pruebas asistida por Inteligencia Artificial y entornos multicloud."
                    ],
        "recommendedQuestions":  [
                                     "¿Cómo estructurarías una estrategia de QA desde cero para un cliente de consultoría que no tiene procesos de prueba definidos?",
                                     "Describe una situación en la que tuviste un conflicto con el equipo de desarrollo sobre la gravedad de un defecto y cómo lograste un acuerdo.",
                                     "¿De qué manera utilizas las métricas de Scrum para identificar cuellos de botella y mejorar la productividad del equipo?",
                                     "¿Cuál ha sido el desafío técnico más complejo que has resuelto al automatizar pruebas en plataformas móviles y qué herramientas utilizaste?",
                                     "Como consultora, ¿cómo le justificarías a un cliente con presupuesto limitado la inversión en pruebas de automatización frente a las manuales?"
                                 ],
        "suggestedTime": "",
        "channel":  "EAS Consulting DB",
        "createdAt":  "2026-08-20T23:56:39.903Z",
        "isEncrypted":  false,
        "vacancyId":  null,
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "¿Cómo estructurarías una estrategia de QA desde cero para un cliente de consultoría que no tiene procesos de prueba definidos?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "Describe una situación en la que tuviste un conflicto con el equipo de desarrollo sobre la gravedad de un defecto y cómo lograste un acuerdo."
                                   },
                                   {
                                       "id":  3,
                                       "question":  "¿De qué manera utilizas las métricas de Scrum para identificar cuellos de botella y mejorar la productividad del equipo?"
                                   },
                                   {
                                       "id":  4,
                                       "question":  "¿Cuál ha sido el desafío técnico más complejo que has resuelto al automatizar pruebas en plataformas móviles y qué herramientas utilizaste?"
                                   },
                                   {
                                       "id":  5,
                                       "question":  "Como consultora, ¿cómo le justificarías a un cliente con presupuesto limitado la inversión en pruebas de automatización frente a las manuales?"
                                   },
                                   {
                                       "id":  6,
                                       "question":  "¿Cómo mides y reportas el impacto o retorno de inversión de las iniciativas que implementas en tu área?"
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [

                       ],
        "education":  [

                      ],
        "certifications":  [

                           ],
        "history":  [
                        {
                            "user":  "Eduardo Aguilar (RECRUITER)",
                            "stage":  "Contratado",
                            "timestamp":  "2026-08-03T23:03:39.215Z"
                        }
                    ],
        "comments":  ""
    },
    {
        "id":  "cand-1785973752162-917",
        "name":  "Daniel Eduardo Jerónimo Cervantes",
        "email":  "daniel1280@gmail.com",
        "phone":  "+52 8135566505",
        "resumeText":  "Daniel Eduardo Jerónimo Cervantes\nMéxico.\n+52 8135566505\ndaniel1280@gmail.com\nhttps://www.linkedin.com/in/daniel-j%C3%A9ronimo-12921090/\n21 years of experience in Negotiation and Management of IT Implementation Projects, solid knowledge in the business processes of the\nProduction, Oil \u0026 Gas, Construction, Transportation, Retail and Export-Import industries. SAP ECC/S4Hana specialist with 16 years of experience\nin GreenField / BrownField Implementations. AMS Management and business processes (end-to-end) SAP MM, SD, PS, PM, PP, FI.\nThe competences I have are negotiation and strategic planning, with a high capacity to interact with clients, lead groups and focus on\norganizational goals. Advanced English.\nWORK EXPERIENCE\nINETUM HOLDING MEXICO S.A. DE C.V. \tMay 2025 – Current\nGlobal Consulting Company for Information Technologies.\nSAP DELIVERY MANAGER \u0026 PRESALES CONSULTANT.\nFunctions: Delivery Manager (Monitoring SAP S/4Hana implementation projects using the SAP Activate methodology. Management of hours worked\nby assigned SAP consultants, tracking SLA compliance for SAP AMS. Management of recruitment and hiring of SAP consultants. SAP Pre-sales (Sizing\nand proposal preparation for SAP S4Hana Grow/Rise implementation projects (Greenfield and Brownfield, proposal preparation with existing\ncustomers, demo preparation). PCEE (Generating new leads with existing customers, Cross-Selling strategy to increase account value, follow-up visits\nto customers).\nAXTEL S.A.B de C.V. (ALESTRA) \tApr 2022 – Apr 2025\nMexican company of Telecommunications, Infrastructure, and Consulting of Information Technologies.\nSAP COE MANAGER\nFunctions: Head of SAP Business Developer (Line Product, Sales, Pre-sales, Delivery and Support) Sales Management (Generation of new leads with\nexisting clients, Compliance with the territory plan and CrossSelling Strategy to increase the account value, Follow-up visit to clients). Product\nManagement (Partnership, Portfolio Strategy, Roadmap, Alliance, Certifications) Pre-sales Management (Sizing of SAP S4Hana Grow/Rise delivery\nprojects (Greenfield and Brownfield). S/4Hana Delivery Management using the SAP Activate methodology, Oversight the SAP Implementation\nprojects to ensure high-quality delivery (Greenfield and Brownfield). Management of the SAP AMS, Oversight the maintenance and technical support\nto ensure high-quality of SAP services (Compliance with SLAs). Management of contracts with SAP partners. Management SAP area KPIs.\nAchievements:\n- Increase in the value of the account with a pharmaceutical client with the SAP S4Hana Brownfiled Implementation.\n- Compliance with the KPI of SAP Design proposals. (Decrease in time in generating proposals)\n- Build a strong team of SAP consultants.\n- Implement retention strategies to maintain a stable and motivated workforce.\n- Compliance with the SLA’s KPI with SAP Service Desk.\n- Strengthening the Partnership with SAP.\nSOFTTEK \tNov 2021 – Apr 2022\nGlobal Information Technology Consulting Company.\nSAP MM CONSULTANT\nFunctions: Functional documentation, training and support end users.\nAchievements:\n-Functionally train 8 branches in PTP Processes in 4 months.\nACCENTURE \tAug 2021 – Oct 2021\nGlobal Information Technology Consulting Company.\nAdvanced App Engineering Assoc Manager – SAP SCM\nFunctions: Data validation and table mapping for supply chain management BI project. Support end users.\nAchievements:\n-Finish the project in 3 months.\nPIASA GROUP \tAug 2020 – Jul 2021\nMexican company made up of three of the most modern and productive sugar mills in the country; Ingenio Tres Valles, Ingenio Adolfo López Mateos,\nand Ingenio Plan de San Luis, in the states of Veracruz, Oaxaca and San Luis Potosí, respectively.\nSAP SCM MANAGER\nFunctions:\n\n-- 1 of 3 --\n\nLSMW creation for MM and PM. Massive Update of Master Data of Materials and Services. Customization of Purchase Requests, Purchase Order,\nWarehouses, Valuation Categories and Classes, Item Group, Release Strategies, MRP, Bill of Materials, Production Orders, Notifications, Roadmaps,\nShipping Points, Lots, Rates, Transportation, Obyc. Tracking Incidents and Requirements in the Service Now tool. Unit and Integral Tests. Support and\nTraining for End Users of MM, SD-LE, PM, PP. Accompaniment to end users in Final Preparation and Go Live. Leader and monitoring of SAP projects\nAchievements:\n- Implementation of SAP 4Hana in the MM, SD-LE, PP, PM modules.\n- Implementation of the Netcurio Suppliers Portal interface with SAP.\nDEP OIL \u0026 GAS \tJan 2014 – Jan 2020\nMexican company with more than 15 years of experience in the exploration and production of oil and gas. Present in different locations in the\nMexican Republic, Reynosa, Tampico, San Luis Potosí, Poza Rica, Villahermosa and Mexico City.\nSAP TECHNICAL LEAD\nFunctions:\nReport to Management on the progress of the project and its risk, Follow-up of incidents and improvements. Customization of the processes of MM\n(Contracts, Order Requests, Order, MRP, Warehouse, Inventories, Invoices), PM (Technical Locations, Equipment, Workstations, Notices, Orders,\nRoute Sheets, Maintenance Plans. Notification, Settlement). Unit and Integral Tests of MM and PM. Training and Support to end users of MM, PM, PS.\nCreation of Manuals. Configuration and Support to the Structure and Budget of Projects (PS) WBS for Capex and Opex. Control of access to users and\nassignment of roles. Design Business Blueprint, Mapping and Gap Analysis. TimeSheet Elaboration.\nAchievements:\n- Implementation of SAP R3 in the MM (PUR) and PS modules in the companies DS Servicios Petroleros, DWF and Diavaz Offshore.\n- Implementation of SAP 4Hana, PM and MM modules (PUR - FIORI) in the companies DS Servicios Petroleros, DWF and Diavaz Offshore.\n- RollOut of the contract Migration in SAP 4 / Hana in PM (Maintenance)\n- Indicator Reports with Qlikview of the PM and MM module.\nSTGT \tApr 2013 – Jan 2014\nMexican company that provides technological solutions to its clients, generating value and sustainable growth.\nSAP MANAGER\nFunctions:\nControl and monitoring of the project work plan. Coordination of the team of consultants. Tracking Incidents and Improvements. Monthly\nreports to Management. Support and training for end users. Customization and mapping of purchasing, warehouse, commercial, maintenance,\nbudget, human resources and finance business processes. Design of Unit and Comprehensive Tests. Design of BBP\u0027s (Business Blue Print), user access\ncontrol and role assignment. Consultants TimeSheet control. Management of service contracts.\nAchievements: - SAP R3 implementation in SD, MM, PM, FI, FM, PM, HCM, PY modules. - Implementation of the Kronos-SAP HCM Interface.\nCORPORATE YEPAS \tSept 2012 – Apr 2013\nThe most important regional convenience store chain in the state of Veracruz, which carries out more than 1,000 daily operations, thus making\nits points of sale a generator of important economic activity in Veracruz.\nTI MANAGER\nFunctions:\nCoordination of the IT work team. Supervision of incidents and improvements with consultants and functional. Control and monitoring of the\nWork Plan of the projects. Reports to Management on the progress of projects and risks. Application of the PMI methodology. Preparation and\nmanagement of the annual IT budget. Proposal plan for new IT projects. Management of service contracts. Leader of the Dynamics GP\nImplementation project. Management of the preventive maintenance plan for computer equipment. Supervision of the Ticket Report of the IT\nsupport portal. Supervision of the progress of IT staff projects. Implementation of new policies in the IT department.\nAchievements: Implementation of Microsoft Dynamics GP. Implementation of the Point of Sale Interface with Dynamics GP.\nGHO \tNov 2011 – Sept 2012\nIt occupies a prominent place in the Passenger Ground Transportation in the Central-West Region and belongs to Grupo Toluca, one of the most\nimportant Transportation Groups nationwide. It is a 100% Mexican company, whose main objective is to provide Passenger Motor Carrier\nServices, seeking the best profitability and efficiency in its administration.\nSAP MANAGER\nFunctions:\nControl and monitoring of the IT projects work plan. Tracking Incidents and Improvements of support tickets. Monthly reports to management.\nSupport and training for end users. Configuration, mapping and testing of commercial, purchasing, warehouse, maintenance, budget, human\nresources, finance and treasury business processes. Control of access to users and assignment of roles.\nAchievements: SAP R3 implementation in SD, MM, PM, FI, FM, PM, HCM, PY. Implementation of the Kronos-SAP HCM Interface.\nENAPSYS \tMarch 2011 – Nov 2011\nLeading company in Mexico, specialized in the design and implementation of SAP CRM strategies. SAP recommends Enapsys as the best option\nin Mexico for the implementation of CRM solutions.\n\n-- 2 of 3 --\n\nSAP CRM CONSULTANT\nFunctions:\nProject Planning and Business Process Mapping. Elaboration of the Business BluePrint. SAP CRM customization (Services and Callcenter). Quality\nprocess testing. Preparation of Technical and Functional Manuals. Training for end users.\nAchievements: Implementation of the SAP CRM Service and Callcenter module in the company Qualitas Seguros\nCARZA \tJan 2010 – Feb 2011\nLeading Mexican company that promotes real estate developments that improve the quality of life in the community.\nSAP SD-MM CONSULTANT\nFunctions:\nLeader of the SAP R3 SD and MM implementation. Customization of the Customer Master, Material Master, Price Conditions, Commissions, Exit\nConditions, Sales Order Lists, Workflow. Pass transport orders for improvements. Access control to SAP users and role assignment.\nAdministrator of ERP Dynamics GP Treasury and ERP Construct GP Sales, Purchases, Warehouses, Accounts Receivable, Accounts Payable.\nPlanning training for end users. Support and monitoring of incidents and new requirements.\nAchievements: Implementation of SAP R3 SD. Implementation of CRM Microsoft Dynamics, Sales and Marketing Modules. Implementation of\nthe CRM Dynamics Interface with SAP R3 SD.\nSCHOOL GRADE\nComputer Systems Engineering \tMaster Degree in Information Technology Management\nTecnológico de Veracruz/ 1998- 2004 \tUniversidad del Valle de México/ 2014- 2015\nDiploma in Management \tSCRUM FOUNDATION PROFESSIONAL CERTIFICATE\nTecnológico de Monterrey/ 2007- 2008 \tCertiProf / 2020\nCOURSES \u0026 CERTIFICATES\n- Presales Excellence Hands-On Certificate 2025.\n- Presales Excellence Fundamentals Certificate 2025.\n- SAP Customer Engagement Partner Academy - Validation Assessment 2025.\n- Leveraging SAP Demo Environment 2.0 - Record of Achievement 2025.\n- C_S4CPB SAP Certified Associate - Implementation Consultant - SAP S/4HANA Cloud Public Edition 2025.\n- CPEA and SAP Build in RISE with SAP S/4HANA Cloud for Presales and CEE 2024.\n- Additional Capabilities included in Grow with SAP 2024.\n- Customer On-Boarding for SAP S/4Hana Cloud, public edition 2024.\n- Cloud cross topics for Sales Executives 2024.\n- Cloud cross topics for Presales Consultants 2024.\n- Exploring SAP Cloud – Record of Achievement 2024.\n- Customer On-Boarding overview for SAP S/4Hana Cloud 2024.\n- Introducing SAP’s Cloud Strategy – Record of Achievement 2024.\n- Sharpening your Discovering and Demonstration Presales Skills – Record of Achievement 2024.\n- ACT200 Agile Project Delivery 2024.\n- ACT100 SAP Activate Methodology 2023.\n- TS450/TS452 Sourcing and Procurement MM in SAP S4/HANA 2022.\n- TS421/TS422 Production Planning and Manufacturing PP SAP S4HANA 2022.\n- S4520 Purchasing in SAP S/HANA 2020.\n- S4200 Business Processes in SAP S/HANA Manufacturing 2020.\nTECHNICAL KNOWLEDGE\nProject, Visio, SmartSheet, SQL, Crystal Reports, Pivotal Tracker, Tableau, SCRUM, SAP Activate.\nPMI, Windows Server, Dynamics CRM, Dynamics GP, Intélisis, SAP 4Hana, SAP CRM, SAP GROW/RISE, QlikView, Word, Outlook, Excel.\n\n-- 3 of 3 --\n\n",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  72,
                             "Comunicación":  73,
                             "Trabajo en Equipo":  89,
                             "Habilidades Técnicas":  60,
                             "Resolución de Problemas":  79
                         },
        "fitScore":  75,
        "initialFitScore":  75,
        "summary":  "[EAS Engine Precalificación Local] El candidato Daniel Eduardo Jerónimo Cervantes demuestra un perfil sólido orientado a resultados para la posición. Su experiencia teórica y de desarrollo se alinea e idoneidad profesional de manera progresiva. Dispone de gran potencial de inserción operativa instantánea.",
        "strengths":  [
                          "Fuerte base metodológica descrita en su perfil de talento.",
                          "Sólidas habilidades de comunicación organizacional.",
                          "Alineamiento ético y profesional con los valores de consultoría de EAS."
                      ],
        "growths":  [
                        "Profundizar en metodologías y herramientas de control ágiles modernas.",
                        "Potencial mejora en administración financiera o gestión de flujos de valor."
                    ],
        "recommendedQuestions":  [
                                     "¿Cómo gestionas la comunicación con el equipo y clientes en situaciones de alta presión operando bajo tu perfil de: consultor?",
                                     "Describe un proyecto en el cual utilizaste metodologías específicas de Capital Humano para optimizar procesos.",
                                     "¿Menciona un reto técnico o de liderazgo que resolviste exitosamente y qué competencias pusiste en juego?",
                                     "¿Cómo manejas las diferencias de criterio profesional dentro de un equipo multidisciplinario?",
                                     "¿Qué estrategias utilizas para mantenerte actualizado con las mejores prácticas y tendencias de tu especialidad?",
                                     "¿Cómo mides y reportas el impacto o retorno de inversión de las iniciativas que implementas en tu área?"
                                 ],
        "suggestedTime": "",
        "channel":  "EAS Consulting DB",
        "createdAt":  "2026-08-20T23:56:39.790Z",
        "isEncrypted":  false,
        "vacancyId":  null,
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "¿Cómo gestionas la comunicación con el equipo y clientes en situaciones de alta presión operando bajo tu perfil de: consultor?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "Describe un proyecto en el cual utilizaste metodologías específicas de Capital Humano para optimizar procesos."
                                   },
                                   {
                                       "id":  3,
                                       "question":  "¿Menciona un reto técnico o de liderazgo que resolviste exitosamente y qué competencias pusiste en juego?"
                                   },
                                   {
                                       "id":  4,
                                       "question":  "¿Cómo manejas las diferencias de criterio profesional dentro de un equipo multidisciplinario?"
                                   },
                                   {
                                       "id":  5,
                                       "question":  "¿Qué estrategias utilizas para mantenerte actualizado con las mejores prácticas y tendencias de tu especialidad?"
                                   },
                                   {
                                       "id":  6,
                                       "question":  "¿Cómo mides y reportas el impacto o retorno de inversión de las iniciativas que implementas en tu área?"
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [

                       ],
        "education":  [

                      ],
        "certifications":  [

                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-1785973777080-336",
        "name":  "Juan Carlos Gutiérrez Escalona",
        "email":  "juancarlos200183@hotmail.com",
        "phone":  "+525520921573",
        "resumeText":  "Juan Carlos Gutiérrez Escalona\njuancarlos200183@hotmail.com\n+525520921573\nProfile\nProfessional with 20 years of experience in enterprise architecture and SAP solutions pre-sales, driving revenue growth through\ninnovative strategies and leading multicultural teams. Expert in cloud migration, SAP S/4HANA, and digital transformation\nsolutions, with a proven track record of exceeding quotas and delivering exceptional results.\nEmployment History\nT-Systems México – Presales SAP Enterprise Architect Lead\nJuly 2022 - Currently\nPresales SAP Lead, supporting the sales team (Account Managers and Sales Specialists) through the sales processes,\nleading proposals related with SAP technologies, business processes and the interaction with the several hyperscale’s\n(Google, AWS and Azure) for the SAP Solutions, including SAP Rise subscription services, AMS and infrastructure.\nLead the pre-sales team in the design and architecture of SAP solutions, for different implementation, transformation and\nApplication management services.\nAchievements:\n• Quota achievement (fiscal year March – Feb)\n▪ Jan 2025 – Dec 2025 – 120 %\n▪ Jan 2024 – Dec 2024 – 112%\n▪ Jan 2023 – Dec 2023 – 103%\n▪ Jan 2022 – Dec 2022 – 100%\nCertifications:\n• SAP Rise S4/AHANA – Presales\n• SAP Presales Academy\n• T-Systems Future Cloud Infrastructure (FCI)\n• SAP Innovation \u0026 Advisory Knowledge 2020 - SAP Digital Supplier Network Ambassador\n• Google – Digital Leader\n• Azure – AZ900: Microsoft Azure Fundamentals\nFreelance\nAugust 2021 – June 2022\nProvided pre-sales and sales consulting on SAP solution architecture to clients in the manufacturing and retail industries.\nDeveloped technical proposals and presentations that helped close contracts.\nEPI-USE México – Presales Manager – Enterprise Strategic Accounts\nOctober 2017 – July 2021\nDefine the process in the company to sales SAP Software (VAR Certification), SAP Implementation Services\n(SuccessFactors, HANA Conversions, HANA migration, AMS and BPO Services). Working closely with SAP PBMs, Account\nExecutives, SSE’s and the SAP Presales teams. Also generating new Business Partner inside of the Group Elephant and\noutside of the group, creating new alliances and sales plays looking an added value to our customer partners and prospects.\nCreate the solutioning, quotation, architecture, and proposals. Responsible for RFI, RFP and RFQ.\nLeading the SEO and Inbound Marketing of the company working closely with the Marketing Agencies and SAP.\nAchievements:\n• Participation in the SOC 1 type 2 certification\n• Quota achievement (fiscal year March – Feb)\n\n-- 1 of 3 --\n\n▪ March 2018 – Feb 2019 – 90%\n▪ March 2019 – Feb 2020 – 130%\n▪ March 2020 – Feb 2021 – 80%\n▪ March 2021 – July 2021 – 30%\nCertifications:\n• SAP Presales Validation Program\n• SAP SuccessFactors Employee Central - Partner Presales Validation Program\n• SAP SuccessFactors Learning - Partner Presales Validation Program\n• SAP SuccessFactors Performance and Goals - Partner Presales Validation Program\n• SAP SuccessFactors Recruiting - Partner Presales Validation Program\n• SAP Sales Knowledge 2021 - SAP Partner Digital and Social Selling Expert\nHewlett Packard Enterprise – Sr SAP Solution Architect\nFebruary 2016 – September 2017\nPart of the Consulting Pursuit Services (Presale’s area), supporting the sales team (Account Managers and Sales Specialists)\nduring the sales processes, leading almost all the proposals related with SAP and SAP HANA for hardware and services.\nHelping the customers to transform or refresh their infrastructure according to the business requirements and IT tendencies.\nResponsible to design new strategies for SAP HANA adoption involving HW, Support and Consulting Services, for Mexico\nand LATAM. Also, Partner management to cover the complete business requirement of customers. With participation in the\nmain SAP and HPE events, like: SAP FORUM, SAP NOW, Discover and ASUG Mexico.\nAchievements:\n• I increased the SAP project pipeline by 400% compared to the previous 5 years by implementing effective pre-sales\nstrategies and establishing strategic alliances with key partners.\n• Sales overachieve - 140%\n• SAP Champion for Latin-America (Mexico, Central America, Colombia, Argentina) and coordination with the Brazilian\nteam.\nSAP México\nEnterprise Solution Architect\nFebruary 2014 – January 2015\nPart of the Solution Center Team; the main responsibilities were leading, building and design the solutions and architecture\nfor all the consulting services proposals for Latin America, according to my specialties (SAP HANA like migrations, HANA\nreports, HANA Live, HANA Predictive Analytics, SuccessFactors, BW and Business Objects, Predictive Analysis and\nHHRR).\nAchievements:\nLATAM Lead to design the \"Solution Cockpit\", the objective of this tool was automatizing the creation of the\nservices proposals, to improve the time to release and approval processes in worldwide\nSolution Sales Engagement Manager Platform\nJanuary 2013 – January 2014\nFocused on empowerment, personal accountability and delivering results to accelerate the adoption of our Database and\ntechnology, providing solutions with added value for our customers and improve profitability. My portfolio includes all the\nconsulting services related to HANA, Hana Enterprise Cloud, Mobility, Big Data and Application Managed Services.\nSr. HANA Consultant\nNovember 2012 – December 2014\n\n-- 2 of 3 --\n\nResponsible of design HANA solutions, in the same way supporting the sales team in several proofs of concept to position\nthe added value of our technology (HANA) in the processes of our customers in their day to day. Additionally, I had the role\nof Solution Architect, lead team and project management.\nAchievements:\n• Participation in the HANA War room team (SAP Germany, May 2015), this team was the “SWAT” team to design\nsolutions, solve problems and fix some bugs in the new SAP HANA solutions.\nCertifications:\n• SAP HANA Modeler\n• Solution Manager (several versions)\n• ASAP Methodology (several versions)\nSr. Human Capital Manager Consultant\nOctober 2006 – October 2012\nResponsible for delivering several projects and services related with SAP Human Capital Management Solutions, some of\nthose solutions were: Payroll, Settlements, Personnel Administration, Organizational Management, Talent\nManagement, E-Recruiting, Employee Self Service \u0026 Manager Self Service, SAP\nEnterprise Portal, Structural Profiles, Adobe Interactive Forms, Workflows (Basic level), TREX.\nAdditionally, I had participated on Jaguar Project (Internal) to maximize the understanding and utilization of the portfolio of\nPremium services and part of the team to test the SAP Engagement Methodology. Increasing the use of Max Attention\nservices in the accounts assigned to me.\nAchievements:\n• Champion to the localization solution of Concurrent Employment to Mexico\n• Responsible for Rapid Deployment Solution to E-Recruiting\n• Collaboration in the book SAP E-Recruiting EhP4 by SAP Press\nCertifications:\n• Solution Manager (several versions)\n• Human Capital Management Associate (several versions)\n• HCM Talent Management Professional (several versions)\n• ASAP Methodology\n• ASAP Focus Methodology\n• Engagement Methodology\nEducation\nUniversidad Tecnológica de Mexico, Computer Systems Engineer, Mexico City\nSeptember 2001 – December 2004\n\n-- 3 of 3 --\n\n",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  57,
                             "Comunicación":  74,
                             "Trabajo en Equipo":  75,
                             "Habilidades Técnicas":  69,
                             "Resolución de Problemas":  76
                         },
        "fitScore":  70,
        "initialFitScore":  70,
        "summary":  "[EAS Engine Precalificación Local] El candidato Juan Carlos Gutiérrez Escalona demuestra un perfil sólido orientado a resultados para la posición. Su experiencia teórica y de desarrollo se alinea e idoneidad profesional de manera progresiva. Dispone de gran potencial de inserción operativa instantánea.",
        "strengths":  [
                          "Fuerte base metodológica descrita en su perfil de talento.",
                          "Sólidas habilidades de comunicación organizacional.",
                          "Alineamiento ético y profesional con los valores de consultoría de EAS."
                      ],
        "growths":  [
                        "Profundizar en metodologías y herramientas de control ágiles modernas.",
                        "Potencial mejora en administración financiera o gestión de flujos de valor."
                    ],
        "recommendedQuestions":  [
                                     "¿Cómo gestionas la comunicación con el equipo y clientes en situaciones de alta presión operando bajo tu perfil de: consultor?",
                                     "Describe un proyecto en el cual utilizaste metodologías específicas de Capital Humano para optimizar procesos.",
                                     "¿Menciona un reto técnico o de liderazgo que resolviste exitosamente y qué competencias pusiste en juego?",
                                     "¿Cómo manejas las diferencias de criterio profesional dentro de un equipo multidisciplinario?",
                                     "¿Qué estrategias utilizas para mantenerte actualizado con las mejores prácticas y tendencias de tu especialidad?",
                                     "¿Cómo mides y reportas el impacto o retorno de inversión de las iniciativas que implementas en tu área?"
                                 ],
        "suggestedTime": "",
        "channel":  "EAS Consulting DB",
        "createdAt":  "2026-08-20T23:56:39.777Z",
        "isEncrypted":  false,
        "vacancyId":  null,
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "¿Cómo gestionas la comunicación con el equipo y clientes en situaciones de alta presión operando bajo tu perfil de: consultor?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "Describe un proyecto en el cual utilizaste metodologías específicas de Capital Humano para optimizar procesos."
                                   },
                                   {
                                       "id":  3,
                                       "question":  "¿Menciona un reto técnico o de liderazgo que resolviste exitosamente y qué competencias pusiste en juego?"
                                   },
                                   {
                                       "id":  4,
                                       "question":  "¿Cómo manejas las diferencias de criterio profesional dentro de un equipo multidisciplinario?"
                                   },
                                   {
                                       "id":  5,
                                       "question":  "¿Qué estrategias utilizas para mantenerte actualizado con las mejores prácticas y tendencias de tu especialidad?"
                                   },
                                   {
                                       "id":  6,
                                       "question":  "¿Cómo mides y reportas el impacto o retorno de inversión de las iniciativas que implementas en tu área?"
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [

                       ],
        "education":  [

                      ],
        "certifications":  [

                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-v-14",
        "name":  "Ulises Rosas",
        "email":  "ulises_rosaslanda@outlook.com",
        "phone":  "+52 55 3648 8433",
        "resumeText":  "",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  82,
                             "Comunicación":  92,
                             "Trabajo en Equipo":  85,
                             "Habilidades Técnicas":  88,
                             "Resolución de Problemas":  89
                         },
        "fitScore":  89,
        "initialFitScore":  89,
        "summary":  "Consultor Comercial especializado en gestión de negociación B2B, comercialización de soluciones informáticas y desarrollo de clientes en sector privado.",
        "strengths":  [
                          "Negociación B2B Avanzada",
                          "Comercialización Soluciones TI",
                          "Desarrollo de Clientes"
                      ],
        "growths":  [
                        "Ampliar prospección en cuentas del sector público"
                    ],
        "recommendedQuestions":  [

                                 ],
        "suggestedTime":  "",
        "channel":  "LinkedIn",
        "createdAt":  "2026-08-20T18:20:22.668Z",
        "isEncrypted":  false,
        "vacancyId":  "VAC-VENTAS-101",
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "¿De qué forma aplicas las mejores prácticas de negociación B2B para defender el precio y las condiciones contractuales en cierres complejos?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "¿Cómo identificas oportunidades de crecimiento comercial en clientes existentes mediante diagnósticos de necesidades periódicos?"
                                   },
                                   {
                                       "id":  3,
                                       "question":  "Describe cómo manejas la tensión o desacuerdos comerciales con un cliente exigente sin deteriorar la relación a largo plazo."
                                   },
                                   {
                                       "id":  4,
                                       "question":  "¿Cuál es tu estrategia para acelerar el ciclo de decisión del cliente cuando la propuesta lleva semanas en revisión?"
                                   },
                                   {
                                       "id":  5,
                                       "question":  "Platícanos de una negociación exitosa en la que hayas cerrado un contrato relevante compitiendo con 3 firmas rivales."
                                   },
                                   {
                                       "id":  6,
                                       "question":  "¿Cómo aseguras que los datos de las oportunidades y contactos se mantengan 100% limpios y actualizados en el sistema?"
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [

                       ],
        "education":  [

                      ],
        "certifications":  [

                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-v-11",
        "name":  "Lilian García",
        "email":  "lilian.gargomez@gmail.com",
        "phone":  "+52 56 4793 3138",
        "resumeText":  "",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  72,
                             "Comunicación":  88,
                             "Trabajo en Equipo":  82,
                             "Habilidades Técnicas":  81,
                             "Resolución de Problemas":  82
                         },
        "fitScore":  83,
        "initialFitScore":  83,
        "summary":  "Ejecutiva de Ventas B2B enfocado en captación de cuentas nuevas, prospección multicanal y comercialización de servicios de tecnología y consultoría.",
        "strengths":  [
                          "Prospección Multicanal B2B",
                          "Captación de Cuentas Nuevas",
                          "Presentaciones Comerciales"
                      ],
        "growths":  [
                        "Profundizar en negociación de SLAs complejas"
                    ],
        "recommendedQuestions":  [

                                 ],
        "suggestedTime":  "",
        "channel":  "Glassdoor",
        "createdAt":  "2026-08-20T18:20:22.633Z",
        "isEncrypted":  false,
        "vacancyId":  "VAC-VENTAS-101",
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "¿Qué canales de prospección (llamadas en frío, correos personalizados, eventos) te han dado mejor resultado para captar clientes nuevos?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "¿De qué manera preparas tus argumentos comerciales antes de una primera llamada de descubrimiento con un cliente prospecto?"
                                   },
                                   {
                                       "id":  3,
                                       "question":  "Describe tu proceso para dar seguimiento a una propuesta enviada sin generar presión innecesaria en el prospecto."
                                   },
                                   {
                                       "id":  4,
                                       "question":  "¿Cómo evalúas si un prospecto tiene el perfil ideal de cliente (ICP) antes de invertir tiempo en reuniones presenciales?"
                                   },
                                   {
                                       "id":  5,
                                       "question":  "Platícanos sobre la objeción más difícil que te ha presentado un cliente y cómo lograste darle la vuelta."
                                   },
                                   {
                                       "id":  6,
                                       "question":  "¿Cómo colaboras con el equipo operativo para asegurar que la propuesta vendida sea entregada con la máxima calidad?"
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [

                       ],
        "education":  [

                      ],
        "certifications":  [

                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-v-5",
        "name":  "Alexis Garduño",
        "email":  "alex.garduno@icloud.com",
        "phone":  "+52 771 382 4681",
        "resumeText":  "",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  74,
                             "Comunicación":  88,
                             "Trabajo en Equipo":  81,
                             "Habilidades Técnicas":  83,
                             "Resolución de Problemas":  83
                         },
        "fitScore":  84,
        "initialFitScore":  84,
        "summary":  "Ejecutivo Comercial \u0026 Desarrollo de Negocios en servicios informáticos. Orientado a resultados, cierre de contratos de servicios y captación de clientes nuevos.",
        "strengths":  [
                          "Desarrollo de Negocios TI",
                          "Presentaciones Ejecutivas",
                          "Cierre de Ventas"
                      ],
        "growths":  [
                        "Experiencia específica en ecosistemas SAP S/4HANA"
                    ],
        "recommendedQuestions":  [

                                 ],
        "suggestedTime":  "",
        "channel":  "LinkedIn",
        "createdAt":  "2026-08-20T18:20:22.561Z",
        "isEncrypted":  false,
        "vacancyId":  "VAC-VENTAS-101",
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "¿De qué manera estructuras tus presentaciones de venta ejecutivas para captar el interés de Directores en los primeros 10 minutos?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "En la vacante requerimos venta de tecnología y consultoría; ¿cómo explicas técnicamente el valor de un servicio profesional sin abrumar al cliente?"
                                   },
                                   {
                                       "id":  3,
                                       "question":  "¿Cuál ha sido tu récord de ventas mensuales y qué acciones concretas implementaste para alcanzarlo?"
                                   },
                                   {
                                       "id":  4,
                                       "question":  "Describe cómo te adaptas a ciclos de venta cortos versus ciclos de venta consultiva prolongados."
                                   },
                                   {
                                       "id":  5,
                                       "question":  "¿Cómo gestionas la comunicación con el cliente cuando surgen demoras imprevistas en la entrega del proyecto?"
                                   },
                                   {
                                       "id":  6,
                                       "question":  "Platícanos de una ocasión donde tu persistencia comercial fue determinante para lograr un cierre difícil."
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [

                       ],
        "education":  [

                      ],
        "certifications":  [

                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-v-4",
        "name":  "Alejandro Romero",
        "email":  "aleromeari@gmail.com",
        "phone":  "+52 55 2885 5314",
        "resumeText":  "",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  76,
                             "Comunicación":  90,
                             "Trabajo en Equipo":  83,
                             "Habilidades Técnicas":  82,
                             "Resolución de Problemas":  84
                         },
        "fitScore":  85,
        "initialFitScore":  85,
        "summary":  "Ejecutivo de Cuentas Clave con experiencia en comercialización de soluciones tecnológicas, venta consultiva en frío y fidelización de clientes B2B.",
        "strengths":  [
                          "Venta Consultiva B2B",
                          "Gestión de Cuentas Clave",
                          "Prospección Outbound"
                      ],
        "growths":  [
                        "Fortalecer métricas de conversión en CRM"
                    ],
        "recommendedQuestions":  [

                                 ],
        "suggestedTime":  "",
        "channel":  "Referido",
        "createdAt":  "2026-08-20T18:20:22.551Z",
        "isEncrypted":  false,
        "vacancyId":  "VAC-VENTAS-101",
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "¿De qué forma construyes tu plan de prospección semanal para asegurar la llegada constante de nuevos prospectos calificados?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "En tu experiencia comercial, ¿cómo transformas la primera objeción de costo de un cliente en una conversación enfocada en ROI?"
                                   },
                                   {
                                       "id":  3,
                                       "question":  "Describe tu experiencia coordinando demostraciones ejecutivas de tecnología con clientes del sector industrial o servicios."
                                   },
                                   {
                                       "id":  4,
                                       "question":  "¿Cómo mantienes el seguimiento activo con prospectos que han detenido su proceso de compra por incertidumbre presupuestal?"
                                   },
                                   {
                                       "id":  5,
                                       "question":  "¿Qué técnica utilizas para identificar rápidamente al verdadero tomador de decisión dentro de una estructura corporativa compleja?"
                                   },
                                   {
                                       "id":  6,
                                       "question":  "Comparte una historia de éxito donde hayas convertido un contacto frío en uno de tus clientes más rentables."
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [

                       ],
        "education":  [

                      ],
        "certifications":  [

                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-v-3",
        "name":  "Alfonso López",
        "email":  "cabosalfonso@gmail.com",
        "phone":  "+52 56 3000 9999",
        "resumeText":  "",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  80,
                             "Comunicación":  89,
                             "Trabajo en Equipo":  84,
                             "Habilidades Técnicas":  90,
                             "Resolución de Problemas":  88
                         },
        "fitScore":  88,
        "initialFitScore":  88,
        "summary":  "Consultor Comercial B2B especializado en licenciamiento de software y servicios de consultoría SAP. Destacado por su solidez en licitaciones y RFPs corporativos.",
        "strengths":  [
                          "Comercialización Servicios SAP",
                          "Licitaciones y RFPs",
                          "Negociación con Compras"
                      ],
        "growths":  [
                        "Incrementar volumen en prospección inbound digital"
                    ],
        "recommendedQuestions":  [

                                 ],
        "suggestedTime":  "",
        "channel":  "EAS Consulting DB",
        "createdAt":  "2026-08-20T18:20:22.539Z",
        "isEncrypted":  false,
        "vacancyId":  "VAC-VENTAS-101",
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "Tomando en cuenta tu experiencia vendiendo servicios de consultoría SAP, ¿cómo argumentas el costo-beneficio de nuestros consultores especializados frente a competidores de menor precio?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "¿Cuál es tu metodología para estructurar respuestas competitivas ante procesos de licitación o RFPs corporativos bajo presión de tiempo?"
                                   },
                                   {
                                       "id":  3,
                                       "question":  "Describe cómo manejas la interlocución con los departamentos de Compras (Procurement) que buscan recortar las tarifas comerciales."
                                   },
                                   {
                                       "id":  4,
                                       "question":  "¿Qué estrategias aplicas para lograr cross-selling de servicios profesionales en cuentas que actualmente solo consumen soporte?"
                                   },
                                   {
                                       "id":  5,
                                       "question":  "Platícanos sobre una negociación donde lograste cerrar un contrato marco (MSA) de varios años de duración."
                                   },
                                   {
                                       "id":  6,
                                       "question":  "¿Cómo mantienes la relación comercial con el cliente una vez iniciado el proyecto para asegurar renovaciones continuas?"
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [

                       ],
        "education":  [

                      ],
        "certifications":  [

                           ],
        "history":  [

                    ],
        "comments":  ""
    },
    {
        "id":  "cand-v-1",
        "name":  "Nayely Bertado",
        "email":  "naye.bertado@gmail.com",
        "phone":  "+52 55 4360 8236",
        "resumeText":  "",
        "stage":  "Filtrado",
        "competencies":  {
                             "Liderazgo":  78,
                             "Comunicación":  91,
                             "Trabajo en Equipo":  82,
                             "Habilidades Técnicas":  83,
                             "Resolución de Problemas":  85
                         },
        "fitScore":  86,
        "initialFitScore":  86,
        "summary":  "Ejecutiva Comercial con 5 años de trayectoria en prospección B2B y venta de servicios de tecnología. Gran habilidad en concertación de citas directas con tomadores de decisión C-Level.",
        "strengths":  [
                          "Prospección B2B Ejecutiva",
                          "Negociación Comercial C-Level",
                          "Cierre de Acuerdos Comerciales"
                      ],
        "growths":  [
                        "Desarrollo de propuestas técnicas profundas SAP"
                    ],
        "recommendedQuestions":  [

                                 ],
        "suggestedTime":  "",
        "channel":  "LinkedIn",
        "createdAt":  "2026-08-20T18:20:22.505Z",
        "isEncrypted":  false,
        "vacancyId":  "VAC-VENTAS-101",
        "screeningQuestions":  [
                                   {
                                       "id":  1,
                                       "question":  "¿De qué manera has diseñado tus estrategias de prospección B2B para contactar a Directores y Gerentes de TI en corporativos fríos?"
                                   },
                                   {
                                       "id":  2,
                                       "question":  "En tu experiencia en ventas comerciales, ¿cuál ha sido el ciclo de venta promedio desde el primer contacto hasta la firma de contrato?"
                                   },
                                   {
                                       "id":  3,
                                       "question":  "Describe cómo manejas la calificación de oportunidades (BANT/MEDDPICC) antes de elaborar una propuesta formal para el cliente."
                                   },
                                   {
                                       "id":  4,
                                       "question":  "¿Qué metodologías o herramientas CRM utilizas para mantener un pipeline comercial actualizado y predecible mes a mes?"
                                   },
                                   {
                                       "id":  5,
                                       "question":  "Platícanos sobre un caso donde el cliente exigió un descuento agresivo en la propuesta comercial y cómo defendiste el valor y margen del proyecto."
                                   },
                                   {
                                       "id":  6,
                                       "question":  "¿Cómo coordinas las reuniones comerciales ejecutivas cuando participan múltiples tomadores de decisión del área técnica y de compras?"
                                   },
                                   {
                                       "id":  7,
                                       "question":  "¿Cuál es la disponibilidad para integrarse a la vacante?"
                                   },
                                   {
                                       "id":  8,
                                       "question":  "¿Cuál es el sueldo esperado?"
                                   },
                                   {
                                       "id":  9,
                                       "question":  "¿Dónde se ubica geográficamente?"
                                   },
                                   {
                                       "id":  10,
                                       "question":  "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
                                   }
                               ],
        "doubleCheckReport":  null,
        "interviewSpeech":  null,
        "experience":  [

                       ],
        "education":  [

                      ],
        "certifications":  [

                           ],
        "history":  [

                    ],
        "comments":  ""
    }
];

export const INITIAL_INTERVIEWS: InterviewSlot[] = [];

export const INITIAL_METRICS: RecruitmentMetric[] = [];

export const INITIAL_AUDIT_LOGS: SecurityAuditLog[] = [
  {
    id: 'log-1',
    timestamp: '2026-08-25T12:00:00Z',
    action: 'Cifrado automático AES-256 de base de datos de aspirantes',
    user: 'Sistema Automático',
    ip: '127.0.0.1',
    component: 'Base de Datos Gral',
    status: 'SUCCESS'
  }
];