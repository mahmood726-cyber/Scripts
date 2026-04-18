/**
 * RCT EXTRACTION ENGINE v3.0
 * ==========================
 * 
 * Modular architecture with domain-specific extractors for improved accuracy.
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    RCTExtractor v3.0                        │
 * ├─────────────────────────────────────────────────────────────┤
 * │  1. DomainDetector.detect(text) → 'HF' | 'ACS' | 'AF' | ... │
 * ├─────────────────────────────────────────────────────────────┤
 * │  2. CoreExtractor (shared fields)                           │
 * │     - Demographics, comorbidities, common meds              │
 * │     - Study metadata, basic outcomes                        │
 * ├─────────────────────────────────────────────────────────────┤
 * │  3. DomainExtractor[domain] (specialized)                   │
 * │     - HF: EF, NYHA, BNP, devices                           │
 * │     - ACS: STEMI/NSTEMI, troponin, PCI, TIMI               │
 * │     - AF: CHA₂DS₂-VASc, TTR, bleeding                      │
 * │     - Valvular: Gradients, regurgitation, STS score        │
 * ├─────────────────────────────────────────────────────────────┤
 * │  4. DomainValidator[domain]                                 │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * Coverage: 88% of CV trials with 3 main domains (ACS 51%, HF 22%, AF 15%)
 */

// ============================================================
// LAYER 1: TEXT NORMALIZER (shared utility)
// ============================================================
const TextNormalizer = {
    normalize(text) {
        if (!text) return '';
        let s = text;
        s = s.replace(/[\u200B-\u200F\u2028-\u202F\u2060\uFEFF\u00AD]/g, '');
        s = s.replace(/\r\n|\r/g, '\n');
        s = s.replace(/[\u00A0\u2000-\u200A\u205F\u3000]/g, ' ');
        s = s.replace(/[^\S\n]+/g, ' ');
        s = s.replace(/[\u2010-\u2015\u2212\u2043\uFE58\uFE63\uFF0D\u2E3A\u2E3B]/g, '-');
        s = s.replace(/[\u2044\u2215\u29F8\uFF0F]/g, '/');
        s = s.replace(/[\u201C\u201D\u201E\u201F\u2033\uFF02]/g, '"');
        s = s.replace(/[\u2018\u2019\u201A\u201B\u2032\uFF07]/g, "'");
        s = s.replace(/\u2264/g, '<=').replace(/\u2265/g, '>=');
        s = s.replace(/[\u00B2\u2072]/g, '2').replace(/[\u00B3\u2073]/g, '3');
        s = s.replace(/[\u00D7\u2715]/g, 'x');
        s = s.replace(/[\uFF08]/g, '(').replace(/[\uFF09]/g, ')');
        s = s.replace(/[\uFF0C]/g, ',');
        s = s.replace(/[\uFF1A]/g, ':').replace(/[\uFF1B]/g, ';');
        return s;
    }
};

// ============================================================
// LAYER 2: SECTION DETECTOR (shared utility)
// ============================================================
const SectionDetector = {
    detect(text) {
        const sections = {};
        const lines = text.split('\n');
        
        const patterns = [
            { name: 'abstract', markers: [/\babstract\b/i, /\bbackground\b/i] },
            { name: 'methods', markers: [/\bmethods\b/i, /\bstudy\s+design\b/i, /\btrial\s+design\b/i] },
            { name: 'results', markers: [/\bresults\b/i, /\bfindings\b/i] },
            { name: 'discussion', markers: [/\bdiscussion\b/i, /\bconclusion/i] }
        ];
        
        patterns.forEach(p => {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.length < 50 && line.length > 3) {
                    if (p.markers.some(m => m.test(line))) {
                        const charIdx = lines.slice(0, i).join('\n').length;
                        if (!sections[p.name]) {
                            sections[p.name] = { start: charIdx, startLine: i };
                        }
                        break;
                    }
                }
            }
        });
        
        // Calculate end positions
        const sectionOrder = ['abstract', 'methods', 'results', 'discussion'];
        sectionOrder.forEach((name, idx) => {
            if (sections[name]) {
                const nextSection = sectionOrder.slice(idx + 1).find(n => sections[n]);
                sections[name].end = nextSection ? sections[nextSection].start : text.length;
            }
        });
        
        return sections;
    }
};

// ============================================================
// LAYER 3: DOMAIN DETECTOR
// ============================================================
const DomainDetector = {
    DOMAINS: {
        HF: {
            name: 'Heart Failure',
            keywords: [
                'heart failure', 'ejection fraction', 'NYHA', 'HFrEF', 'HFpEF', 'HFmrEF',
                'natriuretic peptide', 'cardiomyopathy', 'left ventricular dysfunction',
                'cardiac resynchronization', 'ventricular assist'
            ],
            exclusions: ['atrial fibrillation trial', 'anticoagulation trial'],
            weight: 1.0
        },
        ACS: {
            name: 'Acute Coronary Syndrome',
            keywords: [
                'acute coronary', 'myocardial infarction', 'STEMI', 'NSTEMI', 'unstable angina',
                'percutaneous coronary', 'PCI', 'troponin', 'coronary artery disease',
                'antiplatelet', 'thrombolysis', 'stent', 'revascularization', 'CABG',
                'ischemic heart disease', 'angina pectoris'
            ],
            weight: 1.0
        },
        AF: {
            name: 'Atrial Fibrillation',
            keywords: [
                'atrial fibrillation', 'atrial flutter', 'anticoagulation', 'stroke prevention',
                'CHADS', 'CHA2DS2', 'warfarin', 'direct oral anticoagulant', 'DOAC',
                'ablation', 'pulmonary vein isolation', 'left atrial appendage',
                'rhythm control', 'rate control'
            ],
            weight: 1.0
        },
        LIPID: {
            name: 'Lipid-Lowering',
            keywords: [
                'LDL cholesterol', 'LDL-C', 'PCSK9', 'statin', 'ezetimibe', 'bempedoic',
                'triglyceride', 'icosapent', 'lipoprotein', 'hyperlipidemia',
                'dyslipidemia', 'atherosclerotic cardiovascular', 'ASCVD'
            ],
            weight: 0.9  // Often subset of CAD prevention
        },
        VALVULAR: {
            name: 'Valvular Heart Disease',
            keywords: [
                'aortic stenosis', 'aortic regurgitation', 'mitral regurgitation',
                'mitral stenosis', 'tricuspid', 'TAVR', 'TAVI', 'transcatheter',
                'valve replacement', 'valve repair', 'MitraClip', 'TEER'
            ],
            weight: 1.0
        }
    },

    detect(text) {
        const textLower = text.toLowerCase();
        const scores = {};
        
        Object.entries(this.DOMAINS).forEach(([domain, config]) => {
            let score = 0;
            config.keywords.forEach(kw => {
                const regex = new RegExp(kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                const matches = textLower.match(regex);
                if (matches) {
                    score += matches.length * config.weight;
                }
            });
            
            // Check exclusions
            if (config.exclusions) {
                config.exclusions.forEach(ex => {
                    if (textLower.includes(ex.toLowerCase())) {
                        score *= 0.5;
                    }
                });
            }
            
            scores[domain] = score;
        });
        
        // Sort by score
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const primary = sorted[0];
        const secondary = sorted[1];
        
        // Determine confidence
        let confidence = 'high';
        if (primary[1] < 5) {
            confidence = 'low';
        } else if (secondary[1] > primary[1] * 0.7) {
            confidence = 'medium';  // Close competition between domains
        }
        
        return {
            primary: primary[0],
            primaryScore: primary[1],
            secondary: secondary[0],
            secondaryScore: secondary[1],
            confidence,
            all: scores,
            name: this.DOMAINS[primary[0]].name
        };
    }
};

// ============================================================
// LAYER 4: TABLE DETECTOR (shared utility)
// ============================================================
const TableDetector = {
    DRUG_NAMES: [
        // HF drugs
        'Dapagliflozin', 'Empagliflozin', 'Canagliflozin', 'Ertugliflozin', 'Sotagliflozin',
        'Sacubitril', 'Valsartan', 'LCZ696', 'Entresto',
        'Omecamtiv', 'Vericiguat', 'Finerenone', 'Eplerenone', 'Spironolactone',
        'Enalapril', 'Ivabradine', 'Digoxin',
        // Antiplatelet
        'Ticagrelor', 'Clopidogrel', 'Prasugrel', 'Cangrelor', 'Aspirin',
        // Lipid
        'Evolocumab', 'Alirocumab', 'Inclisiran', 'Icosapent', 'Bempedoic',
        'Ezetimibe', 'Rosuvastatin', 'Atorvastatin', 'Simvastatin',
        // Anticoagulant
        'Apixaban', 'Rivaroxaban', 'Edoxaban', 'Dabigatran', 'Warfarin',
        // Anti-inflammatory
        'Colchicine', 'Canakinumab', 'Methotrexate',
        // GLP-1 / Metabolic
        'Semaglutide', 'Tirzepatide', 'Liraglutide', 'Dulaglutide'
    ],

    detectTables(text) {
        const tables = [];
        const lines = text.split('\n');
        
        // Simply pass all lines - let detectRows filter for actual data rows
        // This is more robust than trying to detect table boundaries
        tables.push({
            lines: lines,
            startLine: 0,
            endLine: lines.length - 1,
            text: text
        });
        
        return tables;
    },

    detectRows(lines) {
        const rows = [];
        
        // Value patterns to find where label ends and values begin
        const valuePatterns = [
            /\d+(?:\.\d+)?\s*[±+]\s*\d/,           // mean±SD
            /\d{2,}\s*\(\s*\d+(?:\.\d+)?\s*\)/,    // n (%)
            /\d{2,}\s*\(\s*\d+\s*[-–]\s*\d+\s*\)/, // median (IQR)
            /\d+\.\d+\s*\(\s*\d+\.\d+\s+to\s+\d+\.\d+\s*\)/, // HR (CI lo to CI hi)
            /\(\s*%\s*\)\s+\d+/,                   // (%) followed by number
            /(?:yr|%|kg)\s*\)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?$/, // unit then two numbers
            /\s\d{1,3}\s+\d{1,3}\s*$/              // Two simple numbers at line end
        ];
        
        lines.forEach((line, idx) => {
            const trimmed = line.replace(/\r/g, '').trim();
            if (!trimmed || trimmed.length < 3) return;
            
            // Skip header lines
            if (/^(Characteristic|Variable|Outcome|Endpoint|Dapagliflozin|Empagliflozin|Placebo|LCZ696|Enalapril|Eplerenone|Omecamtiv|Sotagliflozin)/i.test(trimmed)) {
                return;
            }
            if (/^\(N\s*=\s*\d+\)/i.test(trimmed)) {
                return;
            }
            
            // Find first value pattern
            let matchIdx = -1;
            for (const vp of valuePatterns) {
                const match = vp.exec(trimmed);
                // Allow short labels (>= 1 char) for Roman numerals like II, III, IV
                if (match && match.index >= 1) {
                    if (matchIdx === -1 || match.index < matchIdx) {
                        matchIdx = match.index;
                    }
                }
            }
            
            if (matchIdx > 0) {
                rows.push({
                    lineNum: idx,
                    label: trimmed.substring(0, matchIdx).trim(),
                    values: trimmed.substring(matchIdx).trim(),
                    raw: line
                });
            }
        });
        
        return rows;
    },
    
    extractNFromHeaders(tableText) {
        const results = {};
        const lines = tableText.split('\n').map(l => l.trim()).filter(l => l);
        const drugPattern = new RegExp(`(${this.DRUG_NAMES.join('|')})`, 'i');
        
        let foundDrugs = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Pattern: DrugName (N = X)
            const sameLineMatch = line.match(new RegExp(`(${this.DRUG_NAMES.join('|')})\\s*\\(N\\s*=\\s*(\\d+)\\)`, 'i'));
            if (sameLineMatch && !/placebo/i.test(line)) {
                foundDrugs.push({ drug: sameLineMatch[1], n: parseInt(sameLineMatch[2]), source: 'table_header' });
                continue;
            }
            
            // Pattern: DrugName on one line, (N = X) on next
            const drugMatch = line.match(drugPattern);
            if (drugMatch && !/placebo/i.test(line) && i + 1 < lines.length) {
                const nMatch = lines[i + 1].match(/^\(N\s*=\s*(\d+)\)$/i);
                if (nMatch) {
                    foundDrugs.push({ drug: drugMatch[1], n: parseInt(nMatch[1]), source: 'table_header' });
                }
            }
            
            // Pattern: Placebo (N = X)
            if (/placebo/i.test(line)) {
                const sameLinePlacebo = line.match(/placebo\s*\(N\s*=\s*(\d+)\)/i);
                if (sameLinePlacebo) {
                    results['arm.control.n'] = { n: parseInt(sameLinePlacebo[1]), source: 'table_header' };
                } else if (i + 1 < lines.length) {
                    const nextLineN = lines[i + 1].match(/^\(N\s*=\s*(\d+)\)$/i);
                    if (nextLineN) {
                        results['arm.control.n'] = { n: parseInt(nextLineN[1]), source: 'table_header' };
                    }
                }
            }
        }
        
        if (foundDrugs.length >= 1) {
            results['arm.treatment.n'] = foundDrugs[0];
        }
        if (foundDrugs.length >= 2 && !results['arm.control.n']) {
            results['arm.control.n'] = foundDrugs[1];
        }
        
        return results;
    }
};

// ============================================================
// LAYER 5: CORE EXTRACTOR (shared fields across all domains)
// ============================================================
const CoreExtractor = {
    // Fields present in virtually all CV trials
    fields: {
        // Demographics (universal)
        'baseline.age': {
            patterns: [/^age\s*[-—]/i, /^age\b/i, /^median\s+age/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [18, 100], sd: [1, 30] }
        },
        'baseline.age.median': {
            patterns: [/^median\s+age/i, /^age.*median/i],
            valuePattern: /(\d{2})\s*\(\s*(\d+)\s*[-–]\s*(\d+)\s*\)/,
            captures: { 1: 'median', 2: 'iqrLo', 3: 'iqrHi' },
            mapTo: 'baseline.age'
        },
        'baseline.age.simple': {
            patterns: [/^median\s+age\s*[-—]/i, /^age\s*[-—]\s*yr/i],
            valuePattern: /(\d{2}(?:\.\d+)?)\s+(\d{2}(?:\.\d+)?)/,
            captures: { 1: 'median' },
            mapTo: 'baseline.age'
        },
        'baseline.sex.female_pct': {
            patterns: [/^female/i, /female\s+sex/i, /^women/i, /^sex.*female/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            validation: { pct: [0, 100] }
        },
        'baseline.sex.male_pct': {
            patterns: [/^male\s+sex/i, /^men\s*[-—]/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            validation: { pct: [0, 100] }
        },
        'baseline.bmi': {
            patterns: [/^body.mass/i, /^bmi\b/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [15, 60], sd: [1, 15] }
        },
        'baseline.weight': {
            patterns: [/^weight\s*[-—]/i, /^body\s+weight/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [30, 200], sd: [5, 50] }
        },

        // Race/Ethnicity (universal)
        'baseline.race.white_pct': {
            patterns: [/^white$/i, /^caucasian/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.race.black_pct': {
            patterns: [/^black$/i, /^african/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.race.asian_pct': {
            patterns: [/^asian$/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.race.hispanic_pct': {
            patterns: [/^hispanic/i, /^latino/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },

        // Geographic Region (universal)
        'baseline.region.north_america_pct': {
            patterns: [/^north\s+america$/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.region.europe_pct': {
            patterns: [/^europe$/i, /^western\s+europe/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.region.asia_pct': {
            patterns: [/^asia\s*[-–]?.*pacific/i, /^asia$/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },

        // Vitals (universal)
        'baseline.hr': {
            patterns: [/heart\s+rate/i, /^pulse\s+rate/i],
            valuePattern: /(\d{2,3}(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [40, 150], sd: [5, 30] }
        },
        'baseline.sbp': {
            patterns: [/systolic\s+blood\s+pressure/i, /^sbp\b/i],
            valuePattern: /(\d{2,3}(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [70, 220], sd: [5, 40] }
        },
        'baseline.dbp': {
            patterns: [/diastolic\s+blood\s+pressure/i, /^dbp\b/i],
            valuePattern: /(\d{2,3}(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [40, 120], sd: [5, 25] }
        },

        // Common Labs (universal)
        'baseline.egfr': {
            patterns: [/eGFR/i, /estimated\s+glomerular/i, /glomerular\s+filtration/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [10, 150], sd: [5, 50] }
        },
        'baseline.egfr_lt60_pct': {
            patterns: [/eGFR.*<\s*60/i, /eGFR\s+less\s+than\s+60/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.creatinine': {
            patterns: [/^creatinine/i, /serum\s+creatinine/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' }
        },
        'baseline.hba1c': {
            patterns: [/hba1c/i, /glycated\s+hemoglobin/i, /hemoglobin\s+a1c/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [4, 15], sd: [0.5, 3] }
        },

        // Universal Comorbidities
        'baseline.diabetes_pct': {
            patterns: [/^diabetes\s+mellitus/i, /^diabetes$/i, /^type\s+2\s+diabetes/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.hypertension_pct': {
            patterns: [/^hypertension\b/i, /^history.*hypertension/i, /^arterial\s+hypertension/i, /^treated\s+hypertension/i, /hypertension\s*[-–—]/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.af_pct': {
            patterns: [/^atrial\s+fibrillation$/i, /^atrial\s+fibrillation.*flutter/i, /^history.*atrial\s+fib/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.prior_mi_pct': {
            patterns: [/^prior\s+myocardial/i, /^previous\s+myocardial/i, /^history.*myocardial/i, /^mi$/i, /^myocardial\s+infarction$/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.prior_stroke_pct': {
            patterns: [/^prior\s+stroke/i, /^previous\s+stroke/i, /^history.*stroke/i, /nonhemorrhagic\s+stroke/i, /^stroke$/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.ckd_pct': {
            patterns: [/^chronic\s+kidney/i, /^ckd\b/i, /chronic\s+renal\s+disease/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.smoker_pct': {
            patterns: [/^current\s+smoker/i, /^habitual\s+smoker/i, /^smoker$/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.dyslipidemia_pct': {
            patterns: [/^dyslipidemia/i, /^hyperlipidemia/i, /^hypercholesterolemia/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },

        // Universal Medications
        'baseline.meds.bb_pct': {
            patterns: [/^beta.?blocker/i, /^b-blocker/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.ace_pct': {
            patterns: [/^ace\s+inhibitor/i, /^acei\b/i, /angiotensin.converting/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.arb_pct': {
            patterns: [/^angiotensin.*receptor\s+blocker/i, /^arb\b/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.statin_pct': {
            patterns: [/^statin/i, /^lipid.lowering/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.diuretic_pct': {
            patterns: [/^diuretic/i, /^loop\s+diuretic/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.anticoag_pct': {
            patterns: [/^anticoagulant/i, /^oral\s+anticoagul/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.aspirin_pct': {
            patterns: [/^aspirin$/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.insulin_pct': {
            patterns: [/^insulin$/i, /^insulin\s+use/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        }
    },

    extract(rows, text) {
        const results = {};
        const lines = text.split('\n');
        
        // First pass: Try direct pattern matching on full lines for tricky formats
        // This handles cases like "Hypertension 6139/9333 (65.8) 6044/9291 (65.1)"
        const directPatterns = {
            'baseline.hypertension_pct': [
                /^Hypertension\s+(\d+)\s*\/\s*\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/im,
                /^Hypertension\s*[-–—]\s*no\.\s*\(\s*%\s*\)\s+(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/im
            ],
            'baseline.prior_mi_pct': [
                /^(?:Prior|Previous)\s+(?:myocardial\s+infarction|MI)\s+(\d+)\s*\/\s*\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/im,
                /^(?:Myocardial\s+infarction|MI)\s+(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/im
            ],
            'baseline.meds.aspirin_pct': [
                /^Aspirin\s+(\d+)\s*\/\s*\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/im,
                /^Aspirin\s+(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/im
            ]
        };
        
        Object.entries(directPatterns).forEach(([fieldId, patterns]) => {
            if (results[fieldId]) return;
            
            for (const line of lines) {
                for (const pattern of patterns) {
                    const match = pattern.exec(line);
                    if (match) {
                        results[fieldId] = {
                            n: parseInt(match[1]),
                            pct: parseFloat(match[2]),
                            source: 'direct_line',
                            rowLabel: line.substring(0, 30)
                        };
                        return;
                    }
                }
            }
        });
        
        // Second pass: Standard row-based extraction
        rows.forEach(row => {
            Object.entries(this.fields).forEach(([fieldId, fieldDef]) => {
                if (results[fieldDef.mapTo || fieldId]) return;  // Already found
                
                const labelMatch = fieldDef.patterns.some(p => p.test(row.label));
                if (!labelMatch) return;
                
                let match = fieldDef.valuePattern.exec(row.values);
                
                // Fallback 1: n/N (pct) format like "6139/9333 (65.8)"
                if (!match && fieldId.endsWith('_pct')) {
                    const nOverNPctPattern = /(\d+)\s*\/\s*\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/;
                    const nOverNMatch = nOverNPctPattern.exec(row.values);
                    if (nOverNMatch) {
                        const targetField = fieldDef.mapTo || fieldId;
                        results[targetField] = { 
                            n: parseInt(nOverNMatch[1]), 
                            pct: parseFloat(nOverNMatch[2]), 
                            source: 'table_n_over_N', 
                            rowLabel: row.label 
                        };
                        return;
                    }
                }
                
                // Fallback 2: simple percentage format
                if (!match && fieldId.endsWith('_pct')) {
                    const simplePctPattern = /^(\d{1,3}(?:\.\d+)?)\s+(\d{1,3}(?:\.\d+)?)/;
                    const simpleMatch = simplePctPattern.exec(row.values);
                    if (simpleMatch) {
                        const pct = parseFloat(simpleMatch[1]);
                        if (pct >= 0 && pct <= 100) {
                            const targetField = fieldDef.mapTo || fieldId;
                            results[targetField] = { pct, source: 'table_simple', rowLabel: row.label };
                            return;
                        }
                    }
                }
                
                if (!match) return;
                
                const extracted = { source: 'table', rowLabel: row.label };
                Object.entries(fieldDef.captures).forEach(([groupNum, name]) => {
                    const val = parseFloat(match[parseInt(groupNum)]);
                    if (!isNaN(val)) extracted[name] = val;
                });
                
                // Validate
                if (fieldDef.validation) {
                    let valid = true;
                    Object.entries(fieldDef.validation).forEach(([key, [min, max]]) => {
                        if (extracted[key] !== undefined && (extracted[key] < min || extracted[key] > max)) {
                            valid = false;
                        }
                    });
                    if (!valid) return;
                }
                
                const targetField = fieldDef.mapTo || fieldId;
                results[targetField] = extracted;
            });
        });
        
        return results;
    }
};

// ============================================================
// LAYER 6: OUTCOMES EXTRACTOR (shared)
// ============================================================
const OutcomesExtractor = {
    OUTCOME_PATTERNS: {
        'outcome.primary': [
            /primary\s+(?:end\s*point|outcome)/i,
            /primary\s+composite/i
        ],
        'outcome.cv_death': [
            /cardiovascular\s+death/i,
            /death\s+from\s+cardiovascular/i,
            /cv\s+death/i
        ],
        'outcome.all_cause_death': [
            /all.cause\s+(?:death|mortality)/i,
            /death\s+from\s+any\s+cause/i,
            /total\s+mortality/i
        ],
        'outcome.hf_hosp': [
            /hospitalization.*heart\s+failure/i,
            /heart\s+failure.*hospitalization/i,
            /hf\s+hospitalization/i
        ],
        'outcome.mi': [
            /myocardial\s+infarction/i,
            /\bmi\b(?!\s*=)/i,
            /nonfatal\s+mi/i,
            /fatal.*nonfatal.*mi/i
        ],
        'outcome.stroke': [
            /\bstroke\b/i,
            /cerebrovascular/i,
            /nonfatal\s+stroke/i
        ],
        'outcome.renal': [
            /renal\s+composite/i,
            /kidney.*endpoint/i,
            /sustained.*egfr/i
        ]
    },

    extract(text) {
        const results = {};
        const lines = text.split('\n');
        
        // Multiple HR/RR patterns to try - ordered by specificity
        const hrPatterns = [
            // Pattern 1: "hazard ratio, 0.84; 95% confidence interval [CI], 0.77 to 0.92" (PLATO style)
            /hazard\s+ratio[,:\s]+(\d+\.\d+)\s*[;,]\s*(?:95%?\s*)?(?:confidence\s+interval)\s*\[?CI\]?[,:\s]*(\d+\.\d+)\s*(?:to|[-–—])\s*(\d+\.\d+)/gi,
            // Pattern 2: "hazard ratio, 0.79; 97.5% CI, 0.63 to 0.99" (ENGAGE-AF multi-arm style)
            /hazard\s+ratio[,:\s]+(\d+\.\d+)\s*[;,]\s*97\.?5%?\s*(?:confidence\s+interval|CI)[,:\s\[]*(\d+\.\d+)\s*(?:to|[-–—])\s*(\d+\.\d+)/gi,
            // Pattern 3: "hazard ratio, 0.74; 95% confidence interval [CI], 0.65 to 0.85" (standard NEJM)
            /hazard\s+ratio[,:\s]+(\d+\.\d+)\s*[;,]?\s*(?:95%?\s*)?(?:CI)[,:\s\[]*(\d+\.\d+)\s*(?:to|[-–—])\s*(\d+\.\d+)/gi,
            // Pattern 4: "hazard ratio of 0.74 (95% CI, 0.65 to 0.85)"
            /hazard\s+ratio\s+(?:of\s+)?(\d+\.\d+)\s*\(\s*(?:95%?\s*CI)?[,:\s]*(\d+\.\d+)\s*(?:to|[-–—])\s*(\d+\.\d+)/gi,
            // Pattern 5: "HR 0.74 (95% CI 0.65-0.85)" or "Hazard ratio, 0.80 (95% CI, 0.73-0.87)"
            /(?:hazard\s+ratio|HR)[,:\s]+(\d+\.\d+)\s*\(\s*(?:95%?\s*)?(?:CI)?[,:\s]*(\d+\.\d+)\s*(?:to|[-–—])\s*(\d+\.\d+)/gi,
            // Pattern 6: "relative risk, 0.66; 95% CI, 0.53 to 0.82" (AF NOAC trials like RE-LY)
            /relative\s+risk[,:\s]+(\d+\.\d+)\s*[;,]\s*(?:95%?\s*)?(?:CI)[,:\s]*(\d+\.\d+)\s*(?:to|[-–—])\s*(\d+\.\d+)/gi,
            // Pattern 7: "relative risk with dabigatran, 0.66; 95% CI, 0.53 to 0.82"
            /relative\s+risk\s+(?:with\s+\w+[,:\s]+)?(\d+\.\d+)\s*[;,]\s*(?:95%?\s*)?(?:CI)[,:\s]*(\d+\.\d+)\s*(?:to|[-–—])\s*(\d+\.\d+)/gi,
            // Pattern 8: "RR 0.66 (95% CI 0.53-0.82)"
            /(?:relative\s+risk|RR)[,:\s]+(\d+\.\d+)\s*\(\s*(?:95%?\s*)?(?:CI)?[,:\s]*(\d+\.\d+)\s*(?:to|[-–—])\s*(\d+\.\d+)/gi,
            // Pattern 9: Simple "0.74 (0.65–0.85)" near hazard/relative ratio
            /(\d+\.\d+)\s*\(\s*(\d+\.\d+)\s*(?:to|[-–—])\s*(\d+\.\d+)\s*\)/g
        ];
        
        // Keywords that signal primary outcome
        const primaryKeywords = [
            'primary outcome', 'primary endpoint', 'primary composite', 'primary end point',
            'primary efficacy', 'for the primary'
        ];
        
        // First pass: Find lines mentioning primary outcome, then look for HR nearby
        let primaryLineIndices = [];
        for (let i = 0; i < lines.length; i++) {
            const lineLower = lines[i].toLowerCase();
            if (primaryKeywords.some(kw => lineLower.includes(kw))) {
                primaryLineIndices.push(i);
            }
        }
        
        // Search within 3 lines of primary outcome mentions
        // For multi-arm trials, collect all comparisons and prefer "superiority" or "high-dose"
        let allContrasts = [];
        
        for (const primaryIdx of primaryLineIndices) {
            const searchStart = Math.max(0, primaryIdx - 1);
            const searchEnd = Math.min(lines.length, primaryIdx + 5);  // Extend to capture multi-arm comparisons
            const contextLines = lines.slice(searchStart, searchEnd).join(' ');
            
            // For each pattern, find all matches in this context
            for (const pattern of hrPatterns.slice(0, 8)) {  // Skip simple fallback
                pattern.lastIndex = 0;
                let match;
                while ((match = pattern.exec(contextLines)) !== null) {
                    const effect = parseFloat(match[1]);
                    const ciLo = parseFloat(match[2]);
                    const ciHi = parseFloat(match[3]);
                    // Validate: HR typically between 0.3 and 2.0, CI should bracket effect
                    if (effect >= 0.3 && effect <= 2.0 && ciLo < effect && effect < ciHi) {
                        // Get surrounding context to check for superiority/noninferiority/dose
                        const matchStart = match.index;
                        const contextAround = contextLines.substring(
                            Math.max(0, matchStart - 150), 
                            Math.min(contextLines.length, matchStart + 50)
                        ).toLowerCase();
                        
                        const isSuperiority = contextAround.includes('superiority');
                        const isNoninferiority = contextAround.includes('noninferiority') || contextAround.includes('non-inferiority');
                        const isHighDose = contextAround.includes('high-dose') || contextAround.includes('high dose');
                        const isLowDose = contextAround.includes('low-dose') || contextAround.includes('low dose');
                        
                        allContrasts.push({
                            effect, ciLo, ciHi,
                            measureType: contextAround.includes('relative risk') ? 'RR' : 'HR',
                            isSuperiority,
                            isNoninferiority,
                            isHighDose,
                            isLowDose,
                            source: 'prose_primary'
                        });
                    }
                }
            }
        }
        
        // Prefer superiority results over noninferiority, and high-dose over low-dose
        if (allContrasts.length > 0) {
            // Sort priority: superiority > high-dose noninferiority > other
            allContrasts.sort((a, b) => {
                // Superiority first
                if (a.isSuperiority && !b.isSuperiority) return -1;
                if (!a.isSuperiority && b.isSuperiority) return 1;
                
                // High-dose over low-dose
                if (a.isHighDose && b.isLowDose) return -1;
                if (a.isLowDose && b.isHighDose) return 1;
                
                // Non-inferiority last
                if (a.isNoninferiority && !b.isNoninferiority) return 1;
                if (!a.isNoninferiority && b.isNoninferiority) return -1;
                
                // If both same priority, prefer lower effect (more significant benefit)
                return a.effect - b.effect;
            });
            
            results.contrast = allContrasts[0];
            delete results.contrast.isSuperiority;
            delete results.contrast.isNoninferiority;
            delete results.contrast.isHighDose;
            delete results.contrast.isLowDose;
        }
        
        // Second pass: Look in abstract/results for "hazard ratio" mentions
        if (!results.contrast) {
            for (const line of lines) {
                const lineLower = line.toLowerCase();
                // Skip lines about subgroups, secondary outcomes
                if (/subgroup|secondary|per.?protocol|sensitivity/i.test(line)) continue;
                
                if (lineLower.includes('hazard ratio') || lineLower.includes('relative risk') || /\b(hr|rr)\s*[,=:]/i.test(line)) {
                    for (const pattern of hrPatterns.slice(0, 7)) {  // Skip simple fallback
                        pattern.lastIndex = 0;
                        const match = pattern.exec(line);
                        if (match) {
                            const effect = parseFloat(match[1]);
                            const ciLo = parseFloat(match[2]);
                            const ciHi = parseFloat(match[3]);
                            if (effect >= 0.3 && effect <= 2.0 && ciLo < effect && effect < ciHi) {
                                results.contrast = {
                                    effect: effect,
                                    ciLo: ciLo,
                                    ciHi: ciHi,
                                    measureType: 'HR',
                                    source: 'prose'
                                };
                                break;
                            }
                        }
                    }
                    if (results.contrast) break;
                }
            }
        }
        
        // Extract p-value
        const pValuePattern = /[pP]\s*[=<]\s*(0\.\d+|<\s*0\.\d+)/;
        for (const line of lines) {
            if (/primary|hazard\s+ratio/i.test(line)) {
                const pMatch = pValuePattern.exec(line);
                if (pMatch) {
                    results.pValue = pMatch[1].replace(/\s+/g, '');
                    break;
                }
            }
        }
        
        // Extract events from outcome tables
        const eventsPattern = /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/g;
        
        Object.entries(this.OUTCOME_PATTERNS).forEach(([outcomeId, patterns]) => {
            for (const line of lines) {
                if (patterns.some(p => p.test(line))) {
                    const matches = [...line.matchAll(eventsPattern)];
                    if (matches.length >= 2) {
                        results[outcomeId] = {
                            treatment: { events: parseInt(matches[0][1]), rate: parseFloat(matches[0][2]) },
                            control: { events: parseInt(matches[1][1]), rate: parseFloat(matches[1][2]) },
                            source: 'table'
                        };
                        break;
                    }
                }
            }
        });
        
        return results;
    }
};

// ============================================================
// LAYER 7: SAFETY EXTRACTOR (shared)
// ============================================================
const SafetyExtractor = {
    fields: {
        'safety.discontinuation_pct': {
            patterns: [/discontinu/i, /withdrew/i, /stopped.*treatment/i]
        },
        'safety.sae_pct': {
            patterns: [/serious\s+adverse/i, /^sae\b/i]
        },
        'safety.death_pct': {
            patterns: [/^death$/i, /fatal\s+event/i]
        }
    },

    extract(text) {
        const results = {};
        const lines = text.split('\n');
        const rows = TableDetector.detectRows(lines);
        
        rows.forEach(row => {
            Object.entries(this.fields).forEach(([fieldId, fieldDef]) => {
                if (results[fieldId]) return;
                
                if (fieldDef.patterns.some(p => p.test(row.label))) {
                    const match = row.values.match(/(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/);
                    if (match) {
                        results[fieldId] = {
                            n: parseInt(match[1]),
                            pct: parseFloat(match[2]),
                            source: 'table'
                        };
                    }
                }
            });
        });
        
        return results;
    }
};

// ============================================================
// LAYER 8: PROSE EXTRACTOR (shared)
// ============================================================
const ProseExtractor = {
    patterns: {
        'study.followUp': [
            /median\s+(?:follow[- ]?up|duration)[^\d]*(\d+(?:\.\d+)?)\s*(months?|years?|days?|weeks?)/i,
            /followed\s+for\s+a\s+median\s+of\s+(\d+(?:\.\d+)?)\s*(months?|years?)/i,
            /(\d+(?:\.\d+)?)\s*(months?|years?)\s+(?:of\s+)?follow[- ]?up/i
        ],
        'study.sites': [
            /(?:conducted|performed)\s+(?:at|in)\s+(\d+)\s+(?:sites|centers|centres)/i,
            /enrolled\s+(?:at|from)\s+(\d+)\s+(?:sites|centers|centres)/i,
            /recruited\s+from\s+(\d+)\s+(?:clinical\s+)?(?:sites|centers|centres)/i,
            /(\d+)\s+(?:clinical\s+)?(?:sites|centers|centres)\s+in\s+\d+\s+countries/i,
            /(\d+)\s+(?:sites|centers|centres)/i
        ],
        'study.countries': [
            /(\d+)\s+countries/i,
            /in\s+(\d+)\s+countries/i
        ]
    },

    // Known trial acronym patterns - high priority extraction
    TRIAL_ACRONYMS: [
        // Heart Failure
        /\b(DAPA-HF)\b/i, /\b(EMPEROR-(?:Reduced|Preserved))\b/i, /\b(DELIVER)\b/i,
        /\b(PARADIGM-HF)\b/i, /\b(PARAGON-HF)\b/i, /\b(EMPHASIS-HF)\b/i,
        /\b(GALACTIC-HF)\b/i, /\b(SOLOIST-WHF)\b/i, /\b(COMMANDER[-\s]?HF)\b/i,
        /\b(VICTORIA)\b/i, /\b(RELAX[-\s]?AHF)\b/i,
        // ACS / Antiplatelet - TRITON before other patterns
        /\b(TRITON[-–]?TIMI)\b/i, /\b(TRITON)\b(?!\s*[-–])/i,
        /\b(PLATO)\b/i, /\b(CHAMPION)\b/i, /\b(ACCOAST)\b/i,
        /\b(COLCOT)\b/i, /\b(CANTOS)\b/i, /\b(COMPASS)\b/i, /\b(PEGASUS)\b/i,
        /\b(THEMIS)\b/i, /\b(ATLAS[-\s]?ACS)\b/i,
        // AF - including TIMI variants
        /\b(ARISTOTLE)\b/i, /\b(RE-LY)\b/i, /\b(ROCKET[-\s]?AF)\b/i, 
        /\b(ENGAGE\s*AF[-\s]?TIMI\s*48)\b/i, /\b(ENGAGE[-\s]?AF)\b/i,
        /\b(CASTLE[-\s]?AF)\b/i, /\b(CABANA)\b/i, /\b(EAST[-\s]?AFNET)\b/i,
        // Lipid
        /\b(FOURIER)\b/i, /\b(ODYSSEY)\b/i, /\b(REDUCE-IT)\b/i, /\b(IMPROVE-IT)\b/i,
        /\b(STRENGTH)\b/i, /\b(CLEAR)\b/i,
        // Valvular
        /\b(PARTNER)\b/i, /\b(COAPT)\b/i, /\b(MITRA-FR)\b/i,
        // Diabetes CV
        /\b(EMPA-REG)\b/i, /\b(CANVAS)\b/i, /\b(DECLARE)\b/i, /\b(LEADER)\b/i,
        /\b(SUSTAIN[-\s]?6)\b/i, /\b(REWIND)\b/i
    ],

    extractAcronym(text) {
        const first500 = text.substring(0, 500);
        const first2000 = text.substring(0, 2000);
        
        // Priority 1: ClinicalTrials.gov registration pattern - highest confidence
        const ctGovPattern = /(?:ClinicalTrials\.gov[^;]*?|Funded by[^;]*?;\s*)([A-Z][A-Z0-9-]{2,15})\s+ClinicalTrials/i;
        const ctGovMatch = ctGovPattern.exec(text);
        if (ctGovMatch) {
            return ctGovMatch[1].toUpperCase();
        }
        
        // Priority 2: "for the TRIAL investigators" pattern
        const investigatorsPattern = /for\s+the\s+([A-Z][A-Z0-9-]{2,15})\s+(?:trial\s+)?investigators/i;
        const invMatch = investigatorsPattern.exec(first2000);
        if (invMatch) {
            const candidate = invMatch[1].toUpperCase();
            if (!['THE'].includes(candidate)) {
                return candidate;
            }
        }
        
        // Priority 3: Look for known acronyms in first 2000 chars and count occurrences
        const acronymCounts = {};
        for (const pattern of this.TRIAL_ACRONYMS) {
            const regex = new RegExp(pattern.source, 'gi');
            const matches = first2000.match(regex);
            if (matches && matches.length > 0) {
                const acronym = matches[0].toUpperCase().replace(/–/g, '-');
                acronymCounts[acronym] = (acronymCounts[acronym] || 0) + matches.length;
            }
        }
        
        // Pick the most frequent known acronym in the first 2000 chars
        if (Object.keys(acronymCounts).length > 0) {
            const sorted = Object.entries(acronymCounts).sort((a, b) => b[1] - a[1]);
            return sorted[0][0];
        }
        
        // Fallback: look for acronyms in specific positions
        const fallbackPatterns = [
            /(?:the|for\s+the)\s+([A-Z][A-Z0-9-]{2,15})\s+(?:trial|study)/i,
            /\b([A-Z][A-Z0-9-]{2,15})\s+(?:Trial|Study)\b/,
            /\(([A-Z]{4,}(?:-[A-Z0-9]+)?)\)/
        ];
        
        for (const pattern of fallbackPatterns) {
            const match = pattern.exec(first500);
            if (match) {
                const candidate = match[1];
                const excluded = ['NEJM', 'NYHA', 'LVEF', 'SGLT', 'METHODS', 'RESULTS', 
                    'BACKGROUND', 'CONCLUSIONS', 'ABSTRACT', 'DISCUSSION', 'THE', 'FOR',
                    'TIMI', 'GUSTO', 'ISTH', 'BARC', 'KDIGO', 'RIFLE', 'AKIN', 'LIFE'];
                if (!excluded.includes(candidate.toUpperCase())) {
                    return candidate.toUpperCase();
                }
            }
        }
        
        return undefined;
    },

    extract(text) {
        const results = {};
        
        // Extract acronym with special handling
        const acronym = this.extractAcronym(text);
        if (acronym) {
            results['study.acronym'] = acronym;
        }
        
        // Extract other metadata
        Object.entries(this.patterns).forEach(([field, patterns]) => {
            for (const pattern of patterns) {
                const match = pattern.exec(text);
                if (match) {
                    if (field === 'study.followUp') {
                        results[field] = {
                            value: parseFloat(match[1]),
                            unit: match[2].toLowerCase().replace(/s$/, ''),
                            source: 'prose'
                        };
                    } else {
                        results[field] = {
                            value: parseInt(match[1]),
                            source: 'prose'
                        };
                    }
                    break;
                }
            }
        });
        
        return results;
    }
};

// ============================================================
// LAYER 9: NNT CALCULATOR (shared)
// ============================================================
const NNTCalculator = {
    calculate(results) {
        const nnt = {};
        
        // Try to calculate from event rates
        if (results['outcome.primary']) {
            const primary = results['outcome.primary'];
            if (primary.treatment?.rate && primary.control?.rate) {
                const ard = primary.control.rate - primary.treatment.rate;
                if (ard > 0) {
                    nnt.nnt = Math.round(100 / ard);
                    nnt.ard = ard;
                    nnt.source = 'calculated';
                }
            }
        }
        
        // Calculate RRR if we have HR
        if (results.contrast?.effect) {
            const hr = results.contrast.effect;
            nnt.rrr = Math.round((1 - hr) * 100);
        }
        
        return nnt;
    }
};

// Export for use in domain modules
if (typeof module !== 'undefined') {
    module.exports = {
        TextNormalizer,
        SectionDetector,
        DomainDetector,
        TableDetector,
        CoreExtractor,
        OutcomesExtractor,
        SafetyExtractor,
        ProseExtractor,
        NNTCalculator
    };
}

// ============================================================
// DOMAIN MODULE: HEART FAILURE
// ============================================================
const HFModule = {
    name: 'Heart Failure',
    
    // HF-specific fields not in Core
    fields: {
        // Cardiac Function
        'baseline.ef': {
            patterns: [/ejection\s+fraction/i, /^lvef\b/i, /^left\s+ventricular\s+ejection/i],
            valuePattern: /(\d{1,2}(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [5, 75], sd: [1, 20] },
            critical: true
        },
        'baseline.ef.median': {
            patterns: [/ejection\s+fraction.*median/i, /median.*ejection\s+fraction/i],
            valuePattern: /(\d{1,2}(?:\.\d+)?)\s*\(\s*(\d+)\s*[-–]\s*(\d+)\s*\)/,
            captures: { 1: 'median', 2: 'iqrLo', 3: 'iqrHi' },
            mapTo: 'baseline.ef'
        },
        
        // NYHA Class
        'baseline.nyha.class1_pct': {
            patterns: [/nyha.*class\s*i(?:\s|$)/i, /^class\s*i(?:\s|$)/i, /^i(?:\s|$)/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.nyha.class2_pct': {
            patterns: [/nyha.*class\s*ii(?:\s|$)/i, /^class\s*ii(?:\s|$)/i, /^ii(?:\s|$)/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            critical: true
        },
        'baseline.nyha.class3_pct': {
            patterns: [/nyha.*class\s*iii(?:\s|$)/i, /^class\s*iii(?:\s|$)/i, /^iii(?:\s|$)/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            critical: true
        },
        'baseline.nyha.class4_pct': {
            patterns: [/nyha.*class\s*iv/i, /^class\s*iv/i, /^iv(?:\s|$)/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // Biomarkers
        'baseline.ntprobnp': {
            patterns: [/nt-?probnp/i, /n-terminal\s+pro.*bnp/i],
            valuePattern: /(\d{3,5})\s*\(\s*(\d+)\s*[-–]\s*(\d+)\s*\)/,
            captures: { 1: 'median', 2: 'iqrLo', 3: 'iqrHi' },
            critical: true
        },
        'baseline.bnp': {
            patterns: [/^bnp\b/i, /^b-type\s+natriuretic/i],
            valuePattern: /(\d{2,4})\s*\(\s*(\d+)\s*[-–]\s*(\d+)\s*\)/,
            captures: { 1: 'median', 2: 'iqrLo', 3: 'iqrHi' }
        },
        'baseline.troponin': {
            patterns: [/troponin/i, /hs-?tnt/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'median', 2: 'iqrLo', 3: 'iqrHi' }
        },
        'baseline.kccq': {
            patterns: [/kccq/i, /kansas\s+city/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' }
        },
        
        // HF History
        'baseline.prior_hf_hosp_pct': {
            patterns: [/prior.*hospitalization.*heart\s+failure/i, /previous.*hf.*hosp/i, /hospitalization.*within/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            critical: true
        },
        'baseline.ischemic_etiology_pct': {
            patterns: [/ischemic\s+(?:etiology|cause|cardiomyopathy)/i, /ischemic\s+heart\s+disease.*cause/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // HF Medications
        'baseline.meds.arni_pct': {
            patterns: [/sacubitril/i, /arni\b/i, /neprilysin/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.mra_pct': {
            patterns: [/mineralocorticoid/i, /aldosterone\s+antagonist/i, /^mra\b/i, /spironolactone.*eplerenone/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            critical: true
        },
        'baseline.meds.sglt2i_pct': {
            patterns: [/sglt2/i, /sglt-?2/i, /sodium.glucose\s+co.?transport/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.digoxin_pct': {
            patterns: [/^digoxin/i, /digitalis/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.ivabradine_pct': {
            patterns: [/ivabradine/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // Devices
        'baseline.device.icd_pct': {
            patterns: [/implantable\s+cardioverter/i, /^icd\b/i, /defibrillator/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.device.crt_pct': {
            patterns: [/cardiac\s+resynchronization/i, /^crt\b/i, /biventricular/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.device.pacemaker_pct': {
            patterns: [/pacemaker/i, /^ppm\b/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        }
    },
    
    // HF-specific outcomes
    outcomes: {
        primary: {
            name: 'CV death or HF hospitalization',
            patterns: [
                /(?:cardiovascular|cv)\s+death.*(?:hospitalization|admission).*heart\s+failure/i,
                /(?:hospitalization|admission).*heart\s+failure.*(?:cardiovascular|cv)\s+death/i,
                /composite.*(?:cv|cardiovascular)\s+death.*hf/i
            ]
        },
        components: ['cv_death', 'hf_hosp', 'all_cause_death', 'urgent_hf_visit']
    },
    
    // HF-specific validation rules
    validation: [
        {
            name: 'NYHA_SUM',
            check: (data) => {
                const c2 = data['baseline.nyha.class2_pct']?.pct || 0;
                const c3 = data['baseline.nyha.class3_pct']?.pct || 0;
                const c4 = data['baseline.nyha.class4_pct']?.pct || 0;
                const sum = c2 + c3 + c4;
                return sum === 0 || (sum > 80 && sum < 110);  // Allow some rounding
            },
            message: 'NYHA class percentages should sum to ~100%'
        },
        {
            name: 'EF_RANGE',
            check: (data) => {
                const ef = data['baseline.ef']?.mean || data['baseline.ef']?.median;
                if (!ef) return true;
                return ef >= 5 && ef <= 75;
            },
            message: 'EF should be between 5% and 75%'
        },
        {
            name: 'NTPROBNP_RANGE',
            check: (data) => {
                const bnp = data['baseline.ntprobnp']?.median;
                if (!bnp) return true;
                return bnp >= 100 && bnp <= 50000;
            },
            message: 'NT-proBNP should be between 100 and 50000'
        }
    ],

    extract(rows, text) {
        const results = {};
        
        rows.forEach(row => {
            Object.entries(this.fields).forEach(([fieldId, fieldDef]) => {
                if (results[fieldDef.mapTo || fieldId]) return;
                
                const labelMatch = fieldDef.patterns.some(p => p.test(row.label));
                if (!labelMatch) return;
                
                const match = fieldDef.valuePattern.exec(row.values);
                if (!match) return;
                
                const extracted = { source: 'table_hf', rowLabel: row.label };
                Object.entries(fieldDef.captures).forEach(([groupNum, name]) => {
                    const val = parseFloat(match[parseInt(groupNum)]);
                    if (!isNaN(val)) extracted[name] = val;
                });
                
                // Validate
                if (fieldDef.validation) {
                    let valid = true;
                    Object.entries(fieldDef.validation).forEach(([key, [min, max]]) => {
                        if (extracted[key] !== undefined && (extracted[key] < min || extracted[key] > max)) {
                            valid = false;
                        }
                    });
                    if (!valid) return;
                }
                
                results[fieldDef.mapTo || fieldId] = extracted;
            });
        });
        
        return results;
    },

    validate(data) {
        const issues = [];
        this.validation.forEach(rule => {
            if (!rule.check(data)) {
                issues.push({ rule: rule.name, message: rule.message });
            }
        });
        return issues;
    }
};

// ============================================================
// DOMAIN MODULE: ACUTE CORONARY SYNDROME
// ============================================================
const ACSModule = {
    name: 'Acute Coronary Syndrome',
    
    // ACS-specific fields
    fields: {
        // ACS Type
        'baseline.stemi_pct': {
            patterns: [/^stemi$/i, /st.*elevation.*mi/i, /st.*segment.*elevation/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            critical: true
        },
        'baseline.nstemi_pct': {
            patterns: [/^nstemi$/i, /non.*st.*elevation.*mi/i, /nste-?acs/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            critical: true
        },
        'baseline.unstable_angina_pct': {
            patterns: [/unstable\s+angina/i, /^ua$/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // Biomarkers
        'baseline.troponin_positive_pct': {
            patterns: [/troponin\s+positive/i, /elevated\s+troponin/i, /positive\s+troponin/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.peak_troponin': {
            patterns: [/peak\s+troponin/i, /troponin.*peak/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'median', 2: 'iqrLo', 3: 'iqrHi' }
        },
        
        // Risk Scores
        'baseline.killip_class_gt1_pct': {
            patterns: [/killip\s+class\s*(?:>|greater|ii|iii|iv)/i, /killip.*[2-4]/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.timi_risk_score': {
            patterns: [/timi\s+risk/i, /timi\s+score/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' }
        },
        'baseline.grace_score': {
            patterns: [/grace\s+(?:risk\s+)?score/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' }
        },
        
        // Procedures
        'baseline.pci_pct': {
            patterns: [/percutaneous\s+coronary/i, /^pci\b/i, /coronary\s+intervention/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            critical: true
        },
        'baseline.cabg_pct': {
            patterns: [/coronary\s+artery\s+bypass/i, /^cabg\b/i, /bypass\s+graft/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.stent_pct': {
            patterns: [/stent\s+implant/i, /coronary\s+stent/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.des_pct': {
            patterns: [/drug.eluting\s+stent/i, /^des\b/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.bms_pct': {
            patterns: [/bare.metal\s+stent/i, /^bms\b/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.thrombolysis_pct': {
            patterns: [/thrombolysis/i, /fibrinolysis/i, /thrombolytic/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // Timing
        'baseline.symptom_onset_hours': {
            patterns: [/symptom\s+onset/i, /time.*symptom/i, /hours.*presentation/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'median', 2: 'iqrLo', 3: 'iqrHi' }
        },
        'baseline.door_to_balloon': {
            patterns: [/door.to.balloon/i, /d2b\s+time/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'median', 2: 'iqrLo', 3: 'iqrHi' }
        },
        
        // Antiplatelet specific
        'baseline.meds.clopidogrel_pct': {
            patterns: [/^clopidogrel$/i, /plavix/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.prasugrel_pct': {
            patterns: [/^prasugrel$/i, /effient/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.ticagrelor_pct': {
            patterns: [/^ticagrelor$/i, /brilinta/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.gp2b3a_pct': {
            patterns: [/gp\s*iib\/iiia/i, /glycoprotein.*iib/i, /abciximab/i, /eptifibatide/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // CAD extent
        'baseline.multivessel_pct': {
            patterns: [/multivessel/i, /multi.vessel/i, /2.*vessel/i, /3.*vessel/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.left_main_pct': {
            patterns: [/left\s+main/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // Prior history
        'baseline.prior_pci_pct': {
            patterns: [/prior\s+pci/i, /previous\s+pci/i, /history.*pci/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.prior_cabg_pct': {
            patterns: [/prior\s+cabg/i, /previous\s+cabg/i, /history.*bypass/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        }
    },
    
    // ACS-specific outcomes
    outcomes: {
        primary: {
            name: 'MACE (CV death, MI, stroke)',
            patterns: [
                /(?:death|mortality).*myocardial\s+infarction.*stroke/i,
                /(?:cv|cardiovascular)\s+death.*(?:mi|myocardial).*stroke/i,
                /composite.*death.*(?:mi|myocardial)/i,
                /major\s+adverse\s+(?:cardiac|cardiovascular)\s+events?/i,
                /mace/i
            ]
        },
        components: ['cv_death', 'mi', 'stroke', 'urgent_revasc', 'stent_thrombosis']
    },
    
    // ACS-specific validation
    validation: [
        {
            name: 'ACS_TYPE_SUM',
            check: (data) => {
                const stemi = data['baseline.stemi_pct']?.pct || 0;
                const nstemi = data['baseline.nstemi_pct']?.pct || 0;
                const ua = data['baseline.unstable_angina_pct']?.pct || 0;
                const sum = stemi + nstemi + ua;
                return sum === 0 || (sum > 85 && sum < 110);
            },
            message: 'STEMI + NSTEMI + UA should sum to ~100%'
        },
        {
            name: 'PCI_REASONABLE',
            check: (data) => {
                const pci = data['baseline.pci_pct']?.pct;
                if (!pci) return true;
                return pci >= 0 && pci <= 100;
            },
            message: 'PCI rate should be between 0% and 100%'
        }
    ],

    extract(rows, text) {
        const results = {};
        
        rows.forEach(row => {
            Object.entries(this.fields).forEach(([fieldId, fieldDef]) => {
                if (results[fieldDef.mapTo || fieldId]) return;
                
                const labelMatch = fieldDef.patterns.some(p => p.test(row.label));
                if (!labelMatch) return;
                
                let match = fieldDef.valuePattern.exec(row.values);
                
                // Fallback for simple percentage format (common in ACS tables)
                if (!match && fieldId.endsWith('_pct')) {
                    const simplePctPattern = /^(\d{1,3}(?:\.\d+)?)\s+(\d{1,3}(?:\.\d+)?)/;
                    const simpleMatch = simplePctPattern.exec(row.values);
                    if (simpleMatch) {
                        const pct = parseFloat(simpleMatch[1]);
                        if (pct >= 0 && pct <= 100) {
                            results[fieldId] = { pct, source: 'table_acs_simple', rowLabel: row.label };
                            return;
                        }
                    }
                }
                
                if (!match) return;
                
                const extracted = { source: 'table_acs', rowLabel: row.label };
                Object.entries(fieldDef.captures).forEach(([groupNum, name]) => {
                    const val = parseFloat(match[parseInt(groupNum)]);
                    if (!isNaN(val)) extracted[name] = val;
                });
                
                results[fieldId] = extracted;
            });
        });
        
        return results;
    },

    validate(data) {
        const issues = [];
        this.validation.forEach(rule => {
            if (!rule.check(data)) {
                issues.push({ rule: rule.name, message: rule.message });
            }
        });
        return issues;
    }
};

// ============================================================
// DOMAIN MODULE: ATRIAL FIBRILLATION
// ============================================================
const AFModule = {
    name: 'Atrial Fibrillation',
    
    // AF-specific fields
    fields: {
        // Risk Scores
        'baseline.chads2_score': {
            patterns: [/chads2\s+score/i, /^chads2$/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            critical: true
        },
        'baseline.cha2ds2vasc_score': {
            patterns: [/cha2ds2.vasc/i, /chads.?vasc/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [0, 9] },
            critical: true
        },
        'baseline.hasbled_score': {
            patterns: [/has.?bled/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [0, 9] }
        },
        
        // AF Type - improved patterns for NOAC trials
        'baseline.af_type.paroxysmal_pct': {
            patterns: [/paroxysmal\s+(?:af|atrial)/i, /^paroxysmal$/i],
            valuePattern: /(\d+)\/\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            fallbackPattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/
        },
        'baseline.af_type.persistent_pct': {
            patterns: [/persistent\s+(?:af|atrial)/i, /^persistent$/i],
            valuePattern: /(\d+)\/\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            fallbackPattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/
        },
        'baseline.af_type.permanent_pct': {
            patterns: [/permanent\s+(?:af|atrial)/i, /^permanent$/i],
            valuePattern: /(\d+)\/\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            fallbackPattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/
        },
        
        // Prior Events - enhanced for multi-line labels
        'baseline.prior_stroke_tia_pct': {
            patterns: [
                /prior\s+stroke.*tia/i, 
                /stroke.*transient/i, 
                /history.*stroke/i,
                /previous\s+stroke.*(?:transient|tia)/i,
                /^previous\s+stroke/i
            ],
            valuePattern: /(\d+)\/\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            fallbackPattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            critical: true
        },
        'baseline.prior_bleed_pct': {
            patterns: [/prior.*bleed/i, /history.*bleed/i, /previous.*hemorrhage/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // Heart failure - important for AF trials
        'baseline.heart_failure_pct': {
            patterns: [/^heart\s+failure$/i, /^congestive\s+heart\s+failure/i, /^chf\b/i, /^hf\b/i],
            valuePattern: /(\d+)\/\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            fallbackPattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/
        },
        
        // Anticoagulation History
        'baseline.prior_warfarin_pct': {
            patterns: [/prior.*warfarin/i, /previous.*warfarin/i, /warfarin.*experienced/i, /vka.*experienced/i, /long.?term\s+vka/i],
            valuePattern: /(\d+)\/\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            fallbackPattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/
        },
        'baseline.vka_naive_pct': {
            patterns: [/vka.?naive/i, /warfarin.?naive/i, /anticoagulant.?naive/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.ttr_pct': {
            patterns: [/time\s+in\s+therapeutic/i, /^ttr\b/i, /inr.*within.*therapeutic/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [0, 100] }
        },
        
        // Cardiac Structure
        'baseline.la_diameter': {
            patterns: [/left\s+atrial.*diameter/i, /la\s+diameter/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' }
        },
        'baseline.lv_ef': {
            patterns: [/left\s+ventricular\s+ejection/i, /^lvef\b/i, /^ejection\s+fraction/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' }
        },
        
        // Procedures
        'baseline.prior_ablation_pct': {
            patterns: [/prior.*ablation/i, /previous.*ablation/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.laa_closure_pct': {
            patterns: [/left\s+atrial\s+appendage.*closure/i, /laa.*closure/i, /watchman/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // Renal function - important for NOAC dosing
        'baseline.creatinine_clearance': {
            patterns: [/creatinine\s+clearance/i, /^crcl\b/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' }
        },
        'baseline.crcl_lt50_pct': {
            patterns: [/creatinine\s+clearance.*<\s*50/i, /crcl.*<\s*50/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        }
    },
    
    // AF-specific outcomes
    outcomes: {
        primary: {
            name: 'Stroke or systemic embolism',
            patterns: [
                /stroke.*systemic\s+embolism/i,
                /systemic\s+embolism.*stroke/i,
                /thromboembolic/i
            ]
        },
        safety: {
            name: 'Major bleeding',
            patterns: [
                /major\s+bleed/i,
                /isth.*major/i,
                /timi\s+major/i,
                /gusto.*severe/i
            ]
        },
        components: ['stroke', 'systemic_embolism', 'major_bleeding', 'intracranial_bleeding', 'gi_bleeding', 'all_cause_death']
    },
    
    // AF-specific validation
    validation: [
        {
            name: 'CHADSVASC_RANGE',
            check: (data) => {
                const score = data['baseline.cha2ds2vasc_score']?.mean;
                if (!score) return true;
                return score >= 0 && score <= 9;
            },
            message: 'CHA2DS2-VASc should be between 0 and 9'
        },
        {
            name: 'AF_TYPE_SUM',
            check: (data) => {
                const parox = data['baseline.af_type.paroxysmal_pct']?.pct || 0;
                const pers = data['baseline.af_type.persistent_pct']?.pct || 0;
                const perm = data['baseline.af_type.permanent_pct']?.pct || 0;
                const sum = parox + pers + perm;
                return sum === 0 || (sum > 85 && sum < 110);
            },
            message: 'AF type percentages should sum to ~100%'
        }
    ],

    extract(rows, text) {
        const results = {};
        
        // Also search the full text for AF-specific patterns that may be missed by table extraction
        const lines = text.split('\n');
        
        rows.forEach(row => {
            Object.entries(this.fields).forEach(([fieldId, fieldDef]) => {
                if (results[fieldDef.mapTo || fieldId]) return;
                
                const labelMatch = fieldDef.patterns.some(p => p.test(row.label));
                if (!labelMatch) return;
                
                // Try primary value pattern first
                let match = fieldDef.valuePattern.exec(row.values);
                
                // If not found and fallback pattern exists, try that
                if (!match && fieldDef.fallbackPattern) {
                    match = fieldDef.fallbackPattern.exec(row.values);
                }
                
                if (!match) return;
                
                const extracted = { source: 'table_af', rowLabel: row.label };
                Object.entries(fieldDef.captures).forEach(([groupNum, name]) => {
                    const val = parseFloat(match[parseInt(groupNum)]);
                    if (!isNaN(val)) extracted[name] = val;
                });
                
                // Validate
                if (fieldDef.validation) {
                    let valid = true;
                    Object.entries(fieldDef.validation).forEach(([key, [min, max]]) => {
                        if (extracted[key] !== undefined && (extracted[key] < min || extracted[key] > max)) {
                            valid = false;
                        }
                    });
                    if (!valid) return;
                }
                
                results[fieldId] = extracted;
            });
        });
        
        // Direct line extraction for common AF patterns from text
        // This helps with labels that span multiple lines or have unusual formatting
        const directPatterns = [
            {
                fieldId: 'baseline.af_type.paroxysmal_pct',
                linePattern: /^paroxysmal\b/i,
                valuePattern: /(\d+)\/\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/
            },
            {
                fieldId: 'baseline.af_type.persistent_pct', 
                linePattern: /^persistent\b/i,
                valuePattern: /(\d+)\/\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/
            },
            {
                fieldId: 'baseline.af_type.permanent_pct',
                linePattern: /^permanent\b/i,
                valuePattern: /(\d+)\/\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/
            },
            {
                fieldId: 'baseline.heart_failure_pct',
                linePattern: /^heart\s+failure\b/i,
                valuePattern: /(\d+)\/\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/
            },
            {
                fieldId: 'baseline.prior_stroke_tia_pct',
                linePattern: /previous\s+stroke.*(?:transient|tia)|^prior\s+stroke/i,
                valuePattern: /(\d+)\/\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/
            },
            {
                fieldId: 'baseline.prior_warfarin_pct',
                linePattern: /long.?term\s+vka|prior.*vka|warfarin.*experienc/i,
                valuePattern: /(\d+)\/\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/
            }
        ];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            for (const dp of directPatterns) {
                if (results[dp.fieldId]) continue;  // Already found
                
                if (dp.linePattern.test(line)) {
                    // Search current line and next line for values
                    const searchText = line + ' ' + (lines[i+1] || '');
                    const match = dp.valuePattern.exec(searchText);
                    if (match) {
                        results[dp.fieldId] = {
                            n: parseInt(match[1]),
                            pct: parseFloat(match[2]),
                            source: 'direct_line_af'
                        };
                    }
                }
            }
        }
        
        // Handle multi-line labels: "Previous stroke or transient ischemic attack — no./total\nno. (%)"
        if (!results['baseline.prior_stroke_tia_pct']) {
            for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i].trim();
                const nextLine = lines[i+1].trim();
                
                // Check for multi-line stroke/TIA label
                if (/previous\s+stroke.*(?:transient|ischemic)/i.test(line) || 
                    (/stroke/i.test(line) && /transient.*ischemic/i.test(nextLine))) {
                    // Search the next 3 lines for values
                    const searchText = [lines[i], lines[i+1], lines[i+2] || '', lines[i+3] || ''].join(' ');
                    const match = /(\d+)\/\d+\s*\(\s*(\d+(?:\.\d+)?)\s*\)/.exec(searchText);
                    if (match) {
                        results['baseline.prior_stroke_tia_pct'] = {
                            n: parseInt(match[1]),
                            pct: parseFloat(match[2]),
                            source: 'multiline_af'
                        };
                        break;
                    }
                }
            }
        }
        
        // Extract TTR from prose if not found in table
        if (!results['baseline.ttr_pct']) {
            const ttrMatch = text.match(/inr\s+was\s+within\s+(?:the\s+)?therapeutic\s+range\s+was\s+(\d+(?:\.\d+)?)\s*%?/i) ||
                            text.match(/time.*inr.*therapeutic.*?(\d+(?:\.\d+)?)\s*%/i) ||
                            text.match(/ttr.*?(\d+(?:\.\d+)?)\s*%/i);
            if (ttrMatch) {
                results['baseline.ttr_pct'] = {
                    mean: parseFloat(ttrMatch[1]),
                    source: 'prose_af'
                };
            }
        }
        
        return results;
    },

    validate(data) {
        const issues = [];
        this.validation.forEach(rule => {
            if (!rule.check(data)) {
                issues.push({ rule: rule.name, message: rule.message });
            }
        });
        return issues;
    }
};

// ============================================================
// MAIN ORCHESTRATOR: RCTExtractor v3.0
// ============================================================
const RCTExtractor = {
    version: '3.0.0',
    
    // Domain modules registry
    domains: {
        HF: HFModule,
        ACS: ACSModule,
        AF: AFModule
    },

    extract(text) {
        const startTime = Date.now();
        
        // Step 1: Normalize text
        const normalizedText = TextNormalizer.normalize(text);
        
        // Step 2: Detect domain
        const domain = DomainDetector.detect(normalizedText);
        
        // Step 3: Detect sections
        const sections = SectionDetector.detect(normalizedText);
        
        // Step 4: Detect tables and rows
        const tables = TableDetector.detectTables(normalizedText);
        const allRows = [];
        tables.forEach(table => {
            const rows = TableDetector.detectRows(table.lines);
            allRows.push(...rows);
        });
        
        // Step 5: Extract arm Ns from table headers
        let armResults = {};
        tables.forEach(table => {
            const armN = TableDetector.extractNFromHeaders(table.text);
            armResults = { ...armResults, ...armN };
        });
        
        // Step 6: Extract core fields (shared across all domains)
        const coreResults = CoreExtractor.extract(allRows, normalizedText);
        
        // Step 7: Extract domain-specific fields
        let domainResults = {};
        const domainModule = this.domains[domain.primary];
        if (domainModule) {
            domainResults = domainModule.extract(allRows, normalizedText);
        }
        
        // Step 8: Extract outcomes - try full text first for primary outcome, then supplement with results section
        const fullOutcomeResults = OutcomesExtractor.extract(normalizedText);
        let outcomeResults = { ...fullOutcomeResults };
        
        // If results section exists, supplement with additional outcomes (but don't override primary contrast)
        if (sections.results) {
            const resultsText = normalizedText.substring(sections.results.start, sections.results.end);
            const sectionOutcomes = OutcomesExtractor.extract(resultsText);
            // Merge but keep the primary contrast from full text if it was from prose_primary
            Object.entries(sectionOutcomes).forEach(([key, value]) => {
                if (key === 'contrast') {
                    // Only use results section contrast if we don't have a primary one
                    if (!outcomeResults.contrast || outcomeResults.contrast.source !== 'prose_primary') {
                        outcomeResults[key] = value;
                    }
                } else if (!outcomeResults[key]) {
                    outcomeResults[key] = value;
                }
            });
        }
        
        // Step 9: Extract safety
        const safetyResults = SafetyExtractor.extract(normalizedText);
        
        // Step 10: Extract prose (study metadata) - use full text first
        const fullTextProse = ProseExtractor.extract(normalizedText);
        const resultsProse = sections.results ? 
            ProseExtractor.extract(normalizedText.substring(sections.results.start, sections.results.end)) : {};
        const proseResults = { ...fullTextProse, ...resultsProse };
        
        // Step 11: Calculate NNT
        const nntResults = NNTCalculator.calculate({ ...outcomeResults });
        
        // Step 12: Validate with domain-specific rules
        const allData = { ...coreResults, ...domainResults };
        let validationIssues = [];
        if (domainModule && domainModule.validate) {
            validationIssues = domainModule.validate(allData);
        }
        
        // Merge all results
        const results = {
            _meta: {
                version: this.version,
                domain: domain.primary,
                domainName: domain.name,
                domainConfidence: domain.confidence,
                domainScores: domain.all,
                extractionTime: Date.now() - startTime,
                validationIssues
            },
            study: {
                acronym: proseResults['study.acronym'],
                followUp: proseResults['study.followUp'],
                sites: proseResults['study.sites'],
                countries: proseResults['study.countries']
            },
            arm: {
                treatment: armResults['arm.treatment.n'],
                control: armResults['arm.control.n']
            },
            baseline: {},
            outcomes: outcomeResults,
            safety: safetyResults,
            derived: nntResults
        };
        
        // Organize baseline fields
        Object.entries({ ...coreResults, ...domainResults }).forEach(([key, value]) => {
            if (key.startsWith('baseline.')) {
                const parts = key.replace('baseline.', '').split('.');
                let target = results.baseline;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!target[parts[i]]) target[parts[i]] = {};
                    target = target[parts[i]];
                }
                target[parts[parts.length - 1]] = value;
            }
        });
        
        // Add contrast from outcomes
        if (outcomeResults.contrast) {
            results.contrast = outcomeResults.contrast;
        }
        
        return results;
    },

    flatten(result) {
        const flat = {};
        
        const walk = (obj, prefix = '') => {
            if (!obj || typeof obj !== 'object') return;
            
            Object.entries(obj).forEach(([key, value]) => {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                
                if (key === '_meta') return;  // Skip metadata
                
                if (value === null || value === undefined) return;
                
                if (typeof value === 'object' && !Array.isArray(value)) {
                    // Handle value objects with specific properties
                    if ('mean' in value || 'median' in value || 'pct' in value || 
                        'n' in value || 'effect' in value || 'value' in value) {
                        
                        if (value.mean !== undefined) flat[`${fullKey}.mean`] = value.mean;
                        if (value.median !== undefined) flat[`${fullKey}.median`] = value.median;
                        if (value.sd !== undefined) flat[`${fullKey}.sd`] = value.sd;
                        if (value.iqrLo !== undefined) flat[`${fullKey}.iqrLo`] = value.iqrLo;
                        if (value.iqrHi !== undefined) flat[`${fullKey}.iqrHi`] = value.iqrHi;
                        
                        // For percentage fields: if key already ends in _pct, don't add another _pct
                        if (value.pct !== undefined) {
                            const pctKey = fullKey.endsWith('_pct') ? fullKey : `${fullKey}_pct`;
                            flat[pctKey] = value.pct;
                        }
                        if (value.n !== undefined) flat[`${fullKey}.n`] = value.n;
                        
                        if (value.effect !== undefined) flat[`${fullKey}.effect`] = value.effect;
                        if (value.ciLo !== undefined) flat[`${fullKey}.ciLo`] = value.ciLo;
                        if (value.ciHi !== undefined) flat[`${fullKey}.ciHi`] = value.ciHi;
                        if (value.value !== undefined) {
                            flat[fullKey] = value.value;
                            if (value.unit) flat[`${fullKey}.unit`] = value.unit;
                        }
                        if (value.drug !== undefined) flat[`${fullKey}.drug`] = value.drug;
                        
                    } else if (value.treatment || value.control) {
                        // Arm-level data
                        if (value.treatment) {
                            if (value.treatment.n !== undefined) flat[`${fullKey}.treatment.n`] = value.treatment.n;
                            if (value.treatment.events !== undefined) flat[`${fullKey}.treatment.events`] = value.treatment.events;
                            if (value.treatment.rate !== undefined) flat[`${fullKey}.treatment.rate`] = value.treatment.rate;
                            if (value.treatment.drug !== undefined) flat[`${fullKey}.treatment.drug`] = value.treatment.drug;
                        }
                        if (value.control) {
                            if (value.control.n !== undefined) flat[`${fullKey}.control.n`] = value.control.n;
                            if (value.control.events !== undefined) flat[`${fullKey}.control.events`] = value.control.events;
                            if (value.control.rate !== undefined) flat[`${fullKey}.control.rate`] = value.control.rate;
                        }
                    } else {
                        // Recurse into nested objects
                        walk(value, fullKey);
                    }
                } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                    flat[fullKey] = value;
                }
            });
        };
        
        walk(result);
        
        // Calculate female percentage from male if not available
        if (flat['baseline.sex.male_pct'] !== undefined && flat['baseline.sex.female_pct'] === undefined) {
            flat['baseline.sex.female_pct'] = 100 - flat['baseline.sex.male_pct'];
        }
        
        return flat;
    },

    // Get expected fields for a domain
    getExpectedFields(domain) {
        const coreFields = Object.keys(CoreExtractor.fields);
        const domainModule = this.domains[domain];
        const domainFields = domainModule ? Object.keys(domainModule.fields) : [];
        
        return {
            core: coreFields,
            domain: domainFields,
            total: [...coreFields, ...domainFields]
        };
    },

    // Get summary statistics
    getSummary(result) {
        const flat = this.flatten(result);
        const fieldCount = Object.keys(flat).filter(k => !k.startsWith('_')).length;
        
        return {
            domain: result._meta?.domain,
            domainName: result._meta?.domainName,
            confidence: result._meta?.domainConfidence,
            fieldCount,
            extractionTime: result._meta?.extractionTime,
            validationIssues: result._meta?.validationIssues?.length || 0,
            acronym: result.study?.acronym,
            treatmentN: result.arm?.treatment?.n,
            controlN: result.arm?.control?.n,
            primaryHR: result.contrast?.effect,
            primaryCI: result.contrast ? `${result.contrast.ciLo}-${result.contrast.ciHi}` : null
        };
    }
};

// Export
if (typeof module !== 'undefined') {
    module.exports = {
        RCTExtractor,
        DomainDetector,
        TextNormalizer,
        SectionDetector,
        TableDetector,
        CoreExtractor,
        OutcomesExtractor,
        SafetyExtractor,
        ProseExtractor,
        NNTCalculator,
        HFModule,
        ACSModule,
        AFModule
    };
}
