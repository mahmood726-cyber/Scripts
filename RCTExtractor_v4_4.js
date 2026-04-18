/**
 * RCT EXTRACTION ENGINE v4.4
 * ==========================
 * 
 * v4.4 Updates (DIG + Val-HeFT + SOLOIST-WHF + CIBIS-II + SHIFT validation):
 * - Added plain percentage table format: "Female sex 22.2 22.5" (two-column no parentheses)
 * - Added NYHA plain percentage: "II 53.3" format for older trials
 * - Added "risk ratio" pattern alongside "relative risk" for effect extraction
 * - Added "mortality was unaffected" to isMainMortalityResult for neutral outcomes
 * - Added valuePattern updates for multi-column plain percentage tables
 * - Fixed detectRows to recognize plain percentage pairs
 * - Added "Coronary heart disease" pattern to ischemic etiology (Val-HeFT)
 * - Fixed AF pattern anchor (removed $) to match "Atrial fibrillation (% of patients)"
 * - SOLOIST-WHF: Added EF "Median value (IQR) — % 35 (28–47)" multiline pattern
 * - SOLOIST-WHF: Updated NT-proBNP to handle decimals "1816.8 (854.7–3658.5)"
 * - CIBIS-II: Added middle dot (·) normalization for Lancet format
 * - CIBIS-II: Added "Mean (range) age" pattern for age extraction
 * - CIBIS-II: Added "Sex (M/F)" combined pattern for male/female pct
 * - CIBIS-II: Added "left-ventricular" (hyphenated) pattern for EF
 * - CIBIS-II: Added mean (sd) parenthesized value pattern for EF
 * - CIBIS-II: Fixed digoxin pattern to handle % in values
 * - CIBIS-II: Stop HR search at "Secondary endpoints" marker
 * - SHIFT: Added Greek beta (β) normalization for "β blocker" format
 * - SHIFT: Added follow-up pattern with IQR: "22.9 (IQR 18-28) months"
 * - SHIFT: Added "Sex (male)" pattern for male percentage
 * - SHIFT: Added "Age (years)" with parenthesized SD format
 * - SHIFT: Added "LVEF (%)" with "29.0% (5.1)" format (% before SD)
 * - SHIFT: Added "Antialdosterone agents" to MRA patterns
 * - SHIFT: Added "Cardiac glycosides" to digoxin patterns
 * 
 * v4.3 Updates (VICTORIA validation):
 * - Added NYHA n/total format: "II 1478/2523 (58.6)" with optional /total component
 * - Added NT-proBNP median-only pattern: "median NT-proBNP level was 2816 pg"
 * - Added age prose pattern: "mean age of the enrolled patients was 67 years"
 * - Added ARNI prose pattern: "15% received an angiotensin-neprilysin inhibitor"
 * - Added ICD prose pattern with line-break handling: "32% had an implantable cardioverter-defibrillator"
 * 
 * v4.2 Updates (EMPEROR-Reduced/DELIVER/PARADIGM-HF/GALACTIC-HF validation):
 * - Fixed EF multiline extraction: "Mean value 27.7±6.0" and "Mean — % 54.0±8.6" formats
 * - Added ARNI pattern for "With neprilysin inhibitor" (sacubitril-valsartan)
 * - Added HR pattern: "hazard ratio for X, 0.75; 95% CI, 0.65 to 0.86"
 * - Added HR pattern: "hazard ratio in the X group, 0.80; 95% CI..." (PARADIGM-HF format)
 * - Fixed NT-proBNP to not match plain BNP when both reported
 * - Fixed NT-proBNP pattern for "N-terminal pro–B-type natriuretic peptide" (full name)
 * - Added multi-word drug name support: "Omecamtiv Mecarbil (N = 4120)"
 * - Added "Ischemic heart failure" pattern for ischemic etiology
 * - Added "ARN inhibitor" and "ARNI" patterns
 * - Fixed CRT pattern to handle hyphens: "Cardiac-resynchronization therapy"
 * - Added "primary-outcome" (hyphenated) to primary outcome keyword detection
 * 
 * v4.1 Updates (DAPA-HF validation):
 * - Fixed arm N extraction when both drug+placebo on same line (NEJM table format)
 * - Added male_pct calculation from female_pct
 * - Added eGFR extraction patterns for HF module
 * - Added "Over a median of X months" follow-up pattern
 * 
 * v4.0 Updates:
 * - FULL HF MODULE: Ported from v1.5 with 20+ HF-specific extraction patterns
 *   - EF (mean±SD, median with IQR, categories <30%, 30-40%)
 *   - NYHA class distribution (I, II, III, IV) with Roman numeral table support
 *   - Biomarkers: NT-proBNP, BNP, troponin, KCCQ, 6MWT
 *   - HF history: prior hospitalization, ischemic etiology, duration
 *   - HF medications: ARNI, MRA, SGLT2i, digoxin, ivabradine, hydralazine, nitrates
 *   - Devices: ICD, CRT, pacemaker
 *   - HF type: HFrEF, HFpEF, HFmrEF
 * - Added HF trial acronym patterns: DAPA-HF, EMPEROR-Reduced/Preserved, DELIVER,
 *   PARADIGM-HF, PARAGON-HF, GALACTIC-HF, EMPHASIS-HF, SOLOIST-WHF, RALES, etc.
 * - HF module validation: EF range check, NYHA sum check, NT-proBNP IQR validation
 * 
 * v3.9 Updates (AVERROES):
 * - Added AVERROES acronym detection
 * - Added HR pattern for drug-named format ("hazard ratio with apixaban")
 * - Enhanced primary outcome detection to exclude death-specific HRs
 * 
 * v3.8 Updates:
 * - Added AFFIRM and RACE II acronym detection
 * - Added prose comorbidity extraction: "X percent had [condition]"
 * - Added HR pattern for "95 percent confidence interval" (AFFIRM format)
 * - Added rate-control/rhythm-control arm N extraction
 * - Added mean follow-up duration pattern
 * - Fixed primary outcome extraction for mortality trials
 * - Added INR therapeutic range pattern for TTR
 * 
 * v3.7 Updates:
 * - Added RE-LY acronym pattern "(RE-LY)"
 * - Fixed aspirin pattern for n/total (pct) format
 * - Added TTR pattern "was within the therapeutic range was X%"
 * - Added "Diabetes" pattern (not just "Diabetes mellitus")
 * - Added multiline CHADS2 score extraction
 * 
 * Supported Domains:
 * - Heart Failure (HF): 10 trials targeted
 * - Atrial Fibrillation (AF): 8 trials validated (100%)
 * - Acute Coronary Syndrome (ACS): placeholder
 * - Valvular Heart Disease: planned
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
        // v4.4: Normalize middle dot (·) to decimal point for Lancet format (e.g., "0·66" → "0.66")
        s = s.replace(/\u00B7/g, '.');
        // v4.4: Normalize Greek beta (β) to "beta" for SHIFT format (e.g., "β blocker" → "beta blocker")
        s = s.replace(/\u03B2/g, 'beta');
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
                'rhythm control', 'rate control', 'rivaroxaban', 'edoxaban', 'apixaban',
                'dabigatran', 'catheter ablation'
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
            weight: 0.9
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
            
            if (config.exclusions) {
                config.exclusions.forEach(ex => {
                    if (textLower.includes(ex.toLowerCase())) {
                        score *= 0.5;
                    }
                });
            }
            
            scores[domain] = score;
        });
        
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const primary = sorted[0];
        const secondary = sorted[1];
        
        let confidence = 'high';
        if (primary[1] < 5) {
            confidence = 'low';
        } else if (secondary[1] > primary[1] * 0.7) {
            confidence = 'medium';
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
// LAYER 4: TABLE DETECTOR (enhanced for median values and ablation trials)
// ============================================================
const TableDetector = {
    DRUG_NAMES: [
        'Dapagliflozin', 'Empagliflozin', 'Canagliflozin', 'Ertugliflozin', 'Sotagliflozin',
        'Sacubitril', 'Valsartan', 'LCZ696', 'Entresto',
        'Omecamtiv', 'Vericiguat', 'Finerenone', 'Eplerenone', 'Spironolactone',
        'Enalapril', 'Ivabradine', 'Digoxin',
        // Beta-blockers (v4.2: MERIT-HF, CIBIS-II, COPERNICUS)
        'Metoprolol', 'Bisoprolol', 'Carvedilol', 'Nebivolol',
        'Ticagrelor', 'Clopidogrel', 'Prasugrel', 'Cangrelor', 'Aspirin',
        'Evolocumab', 'Alirocumab', 'Inclisiran', 'Icosapent', 'Bempedoic',
        'Ezetimibe', 'Rosuvastatin', 'Atorvastatin', 'Simvastatin',
        'Apixaban', 'Rivaroxaban', 'Edoxaban', 'Dabigatran', 'Warfarin',
        'Colchicine', 'Canakinumab', 'Methotrexate',
        'Semaglutide', 'Tirzepatide', 'Liraglutide', 'Dulaglutide'
    ],

    detectTables(text) {
        const tables = [];
        const lines = text.split('\n');
        
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
        
        const valuePatterns = [
            /\d+(?:\.\d+)?\s*[±+]\s*\d/,
            /\d{2,}\/\d+\s*\(\s*\d+(?:\.\d+)?\s*%?\s*\)/,  // n/total (pct) format - RE-LY style
            /\d{2,}\s*\(\s*\d+(?:\.\d+)?\s*%?\s*\)/,       // v4.2: Added %? for MERIT-HF format
            /\d{2,}\s*\(\s*\d+\s*[-–]\s*\d+\s*\)/,
            /\d+\.\d+\s*\(\s*\d+\.\d+\s+to\s+\d+\.\d+\s*\)/,
            /(?:yr|%|kg)\s*\)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?$/,
            /\s\d{1,3}\s+\d{1,3}\s*$/,
            // v4.2: Mean (SD) format like "Mean (SD) 63·9 (9·6)" - MERIT-HF style
            /Mean\s*\(SD\)\s*\d+[·.]\d+\s*\(\s*\d+[·.]\d+\s*\)/i,
            // v4.4: Plain percentage pairs like "22.2                22.5" - DIG format
            /\s\d+\.\d\s+\d+\.\d/,
            // v4.4: CIBIS-II format: mean (sd) values like "27.6 (5.5)" after label ending in "(%)"
            /\d{1,2}\.\d+\s*\(\s*\d+\.\d+\s*\)/,
            // v4.4: SHIFT format: "29.0% (5.1)" - value with % before SD in parens
            /\d{1,2}\.\d+\s*%\s*\(\s*\d+\.\d+\s*\)/
        ];
        
        lines.forEach((line, idx) => {
            const trimmed = line.replace(/\r/g, '').trim();
            if (!trimmed || trimmed.length < 3) return;
            
            if (/^(Characteristic|Variable|Outcome|Endpoint|Dapagliflozin|Empagliflozin|Placebo|LCZ696|Enalapril|Eplerenone|Omecamtiv|Sotagliflozin)/i.test(trimmed)) {
                return;
            }
            if (/^\(N\s*=\s*\d+\)/i.test(trimmed)) {
                return;
            }
            
            let matchIdx = -1;
            for (const vp of valuePatterns) {
                const match = vp.exec(trimmed);
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
            
            // Pattern: DrugName (N = X) or (n=X) - handles multiple drugs on same line
            // Use global regex to find ALL drug matches on the line
            // v4.2: Allow extra words between drug name and (N=X) for multi-word drugs like "Omecamtiv Mecarbil"
            // v4.2: Also handle lowercase (n=X) for older trials like MERIT-HF
            const drugRegex = new RegExp(`(${this.DRUG_NAMES.join('|')})(?:[\\s\\w/-]+)?\\([Nn]\\s*=\\s*(\\d+)\\)`, 'gi');
            let drugMatchGlobal;
            while ((drugMatchGlobal = drugRegex.exec(line)) !== null) {
                foundDrugs.push({ drug: drugMatchGlobal[1], n: parseInt(drugMatchGlobal[2]), source: 'table_header' });
            }
            
            // Pattern: DrugName on one line, (N = X) on next
            const singleDrugMatch = line.match(drugPattern);
            if (singleDrugMatch && !/placebo/i.test(line) && i + 1 < lines.length) {
                const nMatch = lines[i + 1].match(/^\([Nn]\s*=\s*(\d+)\)$/i);
                if (nMatch) {
                    foundDrugs.push({ drug: singleDrugMatch[1], n: parseInt(nMatch[1]), source: 'table_header' });
                }
            }
            
            // Pattern: Placebo (N = X) or (n=X) - use global regex to handle multiple matches
            const placeboRegex = /placebo(?:\s+group)?\s*\([Nn]\s*=\s*(\d+)\)/gi;
            let placeboMatch;
            while ((placeboMatch = placeboRegex.exec(line)) !== null) {
                if (!results['arm.control.n']) {
                    results['arm.control.n'] = { n: parseInt(placeboMatch[1]), source: 'table_header' };
                }
            }
            // Also check next line for standalone (N = X) or (n=X) after "Placebo" header
            if (/placebo/i.test(line) && !results['arm.control.n'] && i + 1 < lines.length) {
                const nextLineN = lines[i + 1].match(/^\([Nn]\s*=\s*(\d+)\)$/i);
                if (nextLineN) {
                    results['arm.control.n'] = { n: parseInt(nextLineN[1]), source: 'table_header' };
                }
            }
            
            // Pattern for ablation trials: "Ablation (N=X)" or "catheter ablation group (n = X)"
            const ablationMatch = line.match(/(?:catheter\s+)?ablation(?:\s+group)?\s*\(n\s*=\s*(\d+)\)/i);
            if (ablationMatch) {
                foundDrugs.push({ drug: 'Ablation', n: parseInt(ablationMatch[1]), source: 'table_header' });
            }
            
            // Pattern for ablation trials: "Medical therapy (N=X)" or "drug therapy group (n = X)"
            const medTherapyMatch = line.match(/(?:medical|drug)\s+therapy(?:\s+group)?\s*\(n\s*=\s*(\d+)\)/i);
            if (medTherapyMatch && !results['arm.control.n']) {
                results['arm.control.n'] = { n: parseInt(medTherapyMatch[1]), source: 'table_header' };
            }
        }
        
        if (foundDrugs.length >= 1) {
            results['arm.treatment.n'] = foundDrugs[0];
        }
        if (foundDrugs.length >= 2 && !results['arm.control.n']) {
            results['arm.control.n'] = foundDrugs[1];
        }
        
        return results;
    },
    
    // NEW: Extract arm Ns from prose for ablation trials
    extractArmNsFromProse(text) {
        const results = {};
        
        // Pattern: "X patients were assigned to [ablation/catheter ablation]"
        const ablationNMatch = text.match(/(?:ablation|catheter\s+ablation)\s+group\s*\(n\s*=\s*(\d+)\)/i) ||
                               text.match(/(\d+)\s+(?:patients?\s+)?(?:were\s+)?(?:assigned|randomized)\s+to\s+(?:catheter\s+)?ablation/i) ||
                               text.match(/(?:catheter\s+)?ablation\s+group\s*\(n\s*=\s*(\d+)\)/i);
        if (ablationNMatch) {
            results['arm.treatment.n'] = { n: parseInt(ablationNMatch[1]), source: 'prose' };
        }
        
        // Pattern: "X patients were assigned to medical/drug therapy"
        const medicalNMatch = text.match(/(?:medical|drug)\s+therapy\s+group\s*\(n\s*=\s*(\d+)\)/i) ||
                              text.match(/(\d+)\s+(?:patients?\s+)?(?:were\s+)?(?:assigned|randomized)\s+to\s+(?:medical|drug)\s+therapy/i);
        if (medicalNMatch) {
            results['arm.control.n'] = { n: parseInt(medicalNMatch[1]), source: 'prose' };
        }
        
        // CABANA-specific: "catheter ablation group (n = 1108)" and "drug therapy group (n = 1096)"
        const cabanaAblation = text.match(/catheter\s+ablation\s+group\s*\(n\s*=\s*(\d+)\)/i);
        const cabanaDrug = text.match(/drug\s+therapy\s+group\s*\(n\s*=\s*(\d+)\)/i);
        if (cabanaAblation && !results['arm.treatment.n']) {
            results['arm.treatment.n'] = { n: parseInt(cabanaAblation[1]), source: 'prose' };
        }
        if (cabanaDrug && !results['arm.control.n']) {
            results['arm.control.n'] = { n: parseInt(cabanaDrug[1]), source: 'prose' };
        }
        
        // CASTLE-AF: look for "179 Were included in the primary analysis" for ablation
        const castlePattern = /(\d+)\s+Were\s+included\s+in\s+the\s+primary\s+analysis/gi;
        let match;
        const inclusions = [];
        while ((match = castlePattern.exec(text)) !== null) {
            inclusions.push(parseInt(match[1]));
        }
        if (inclusions.length >= 2) {
            if (!results['arm.treatment.n']) {
                results['arm.treatment.n'] = { n: inclusions[0], source: 'prose' };
            }
            if (!results['arm.control.n']) {
                results['arm.control.n'] = { n: inclusions[1], source: 'prose' };
            }
        }
        
        // AFFIRM/RACE: Rate-control vs Rhythm-control arms
        // Pattern: "RATE-CONTROL GROUP (N=2027)" or "rhythm-control group (N=2033)"
        const rateControlMatch = text.match(/rate[- ]?control\s+group\s*\(n\s*=\s*(\d+)\)/i) ||
                                 text.match(/(\d+)\s+(?:patients?\s+)?(?:were\s+)?(?:assigned|randomized)\s+to\s+(?:the\s+)?rate[- ]?control/i);
        const rhythmControlMatch = text.match(/rhythm[- ]?control\s+group\s*\(n\s*=\s*(\d+)\)/i) ||
                                   text.match(/(\d+)\s+(?:patients?\s+)?(?:were\s+)?(?:assigned|randomized)\s+to\s+(?:the\s+)?rhythm[- ]?control/i);
        
        if (rateControlMatch && !results['arm.control.n']) {
            results['arm.control.n'] = { n: parseInt(rateControlMatch[1]), source: 'prose_rate_rhythm' };
        }
        if (rhythmControlMatch && !results['arm.treatment.n']) {
            results['arm.treatment.n'] = { n: parseInt(rhythmControlMatch[1]), source: 'prose_rate_rhythm' };
        }
        
        return results;
    },
    
    // NEW: Extract median values from separate lines AND prose
    extractMediansFromLines(lines) {
        const results = {};
        const fullText = lines.join('\n');
        
        // ====== PROSE PATTERNS: Extract from running text (like CABANA) ======
        
        // Pattern: "median age, 68 years" or "median age of 68 years"
        const ageProsePatterns = [
            /median\s+age[,:\s]+(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:years?|yr)?/i,
            /(?:the\s+)?median\s+age\s+(?:was\s+)?(\d+(?:\.\d+)?)\s*(?:years?|yr)?/i,
            /age[,:]?\s+median[,:\s]+(\d+(?:\.\d+)?)/i
        ];
        for (const pattern of ageProsePatterns) {
            const match = fullText.match(pattern);
            if (match && !results['baseline.age']) {
                const age = parseFloat(match[1]);
                if (age >= 18 && age <= 100) {
                    results['baseline.age'] = { median: age, source: 'prose_median' };
                    break;
                }
            }
        }
        
        // Pattern: "median BMI of 30" or "median body-mass index, 30"
        const bmiProsePatterns = [
            /median\s+(?:body[- ]?mass\s+index|bmi)[,:\s]+(?:of\s+)?(\d+(?:\.\d+)?)/i,
            /(?:body[- ]?mass\s+index|bmi)[,:]?\s+median[,:\s]+(\d+(?:\.\d+)?)/i
        ];
        for (const pattern of bmiProsePatterns) {
            const match = fullText.match(pattern);
            if (match && !results['baseline.bmi']) {
                const bmi = parseFloat(match[1]);
                if (bmi >= 15 && bmi <= 60) {
                    results['baseline.bmi'] = { median: bmi, source: 'prose_median' };
                    break;
                }
            }
        }
        
        // ====== MULTILINE TABLE PATTERNS ======
        
        for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim().toLowerCase();
            const nextLine = lines[i + 1].trim();
            
            // Pattern: "Age — yr" followed by "Median 73"
            if (/^age\s*[-—–]/.test(line) || line === 'age') {
                // Look for "Median XX" on next or following lines
                for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                    const searchLine = lines[j].trim();
                    const medianMatch = searchLine.match(/^Median\s+(\d+(?:\.\d+)?)/i);
                    if (medianMatch) {
                        // Only set if not already found from prose
                        if (!results['baseline.age']) {
                            results['baseline.age'] = { median: parseFloat(medianMatch[1]), source: 'multiline_median' };
                        }
                        
                        // Look for IQR on next line
                        if (j + 1 < lines.length) {
                            const iqrLine = lines[j + 1].trim();
                            const iqrMatch = iqrLine.match(/^(?:Interquartile\s+range|IQR)\s+(\d+)\s*[-–]\s*(\d+)/i);
                            if (iqrMatch) {
                                results['baseline.age'].iqrLo = parseInt(iqrMatch[1]);
                                results['baseline.age'].iqrHi = parseInt(iqrMatch[2]);
                            }
                        }
                        break;
                    }
                }
            }
            
            // Pattern: "Body-mass index" followed by "Median 28.3"
            if (/^body.?mass/i.test(line) || /^bmi\b/i.test(line)) {
                for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                    const searchLine = lines[j].trim();
                    
                    // Standard pattern: "Median 28.3"
                    const medianMatch = searchLine.match(/^Median\s+(\d+(?:\.\d+)?)/i);
                    if (medianMatch) {
                        if (!results['baseline.bmi']) {
                            results['baseline.bmi'] = { median: parseFloat(medianMatch[1]), source: 'multiline_median' };
                        }
                        
                        if (j + 1 < lines.length) {
                            const iqrLine = lines[j + 1].trim();
                            const iqrMatch = iqrLine.match(/^(?:Interquartile\s+range|IQR)\s+(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/i);
                            if (iqrMatch) {
                                results['baseline.bmi'].iqrLo = parseFloat(iqrMatch[1]);
                                results['baseline.bmi'].iqrHi = parseFloat(iqrMatch[2]);
                            }
                        }
                        break;
                    }
                    
                    // CABANA pattern: "median (Q1, Q3)c" header followed by "30 (27, 34)"
                    if (/^median\s*\(/i.test(searchLine)) {
                        // Next line should have the values: "30 (27, 34) 30 (26, 35)"
                        if (j + 1 < lines.length) {
                            const valueLine = lines[j + 1].trim();
                            // Match: 30 (27, 34) - median followed by IQR in parentheses
                            const cabanaMatch = valueLine.match(/^(\d+(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)/);
                            if (cabanaMatch && !results['baseline.bmi']) {
                                const bmi = parseFloat(cabanaMatch[1]);
                                if (bmi >= 15 && bmi <= 60) {
                                    results['baseline.bmi'] = { 
                                        median: bmi, 
                                        iqrLo: parseFloat(cabanaMatch[2]),
                                        iqrHi: parseFloat(cabanaMatch[3]),
                                        source: 'cabana_multiline' 
                                    };
                                }
                            }
                        }
                        break;
                    }
                }
            }
            
            // Pattern: "Creatinine clearance — ml/min" followed by "Median 67"
            if (/creatinine\s+clearance/i.test(line)) {
                for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                    const searchLine = lines[j].trim();
                    const medianMatch = searchLine.match(/^Median\s+(\d+(?:\.\d+)?)/i);
                    if (medianMatch) {
                        results['baseline.creatinine_clearance'] = { median: parseFloat(medianMatch[1]), source: 'multiline_median' };
                        break;
                    }
                }
            }
            
            // Pattern: "Left ventricular ejection fraction" followed by "Median — % 32.5" or "Median value (IQR) — % 35 (28–47)"
            if (/left\s+ventricular\s+ejection/i.test(line) || /^lvef\b/i.test(line) || /^ejection\s+fraction/i.test(line)) {
                for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                    const searchLine = lines[j].trim();
                    // v4.4: Handle "Median value (IQR) — % 35 (28–47)" format (SOLOIST)
                    const medianIqrMatch = searchLine.match(/^Median\s+value.*?(\d+)\s*\(\s*(\d+)\s*[-–]\s*(\d+)\s*\)/i);
                    if (medianIqrMatch) {
                        results['baseline.ef'] = { 
                            median: parseFloat(medianIqrMatch[1]), 
                            iqrLo: parseFloat(medianIqrMatch[2]),
                            iqrHi: parseFloat(medianIqrMatch[3]),
                            source: 'multiline_median' 
                        };
                        break;
                    }
                    const medianMatch = searchLine.match(/^Median\s*[-—–]?\s*%?\s*(\d+(?:\.\d+)?)/i);
                    if (medianMatch) {
                        results['baseline.ef'] = { median: parseFloat(medianMatch[1]), source: 'multiline_median' };
                        break;
                    }
                }
            }
        }
        
        return results;
    }
};

// ============================================================
// LAYER 5: CORE EXTRACTOR (shared fields across all domains)
// ============================================================
const CoreExtractor = {
    fields: {
        // Demographics
        'baseline.age': {
            patterns: [/^age\s*[-—]/i, /^age\b/i, /^median\s+age/i, /^mean\s*\(range\)\s*age/i, /^age\s*\(years?\)/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [18, 100], sd: [1, 30] }
        },
        // v4.4: SHIFT format: "Age (years) 60.7 (11.2)" - SD in parentheses
        'baseline.age.paren_sd': {
            patterns: [/^age\s*\(years?\)/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'mean', 2: 'sd' },
            mapTo: 'baseline.age',
            validation: { mean: [18, 100], sd: [1, 30] }
        },
        'baseline.age.median': {
            patterns: [/^median\s+age/i, /^age.*median/i],
            valuePattern: /(\d{2})\s*\(\s*(\d+)\s*[-–]\s*(\d+)\s*\)/,
            captures: { 1: 'median', 2: 'iqrLo', 3: 'iqrHi' },
            mapTo: 'baseline.age'
        },
        // v4.4: CIBIS-II format: "Mean (range) age (years) 61 (22–80)"
        'baseline.age.mean_range': {
            patterns: [/^mean\s*\(range\)\s*age/i],
            valuePattern: /\)\s*(\d{2})\s*\(/,
            captures: { 1: 'mean' },
            mapTo: 'baseline.age'
        },
        'baseline.sex.female_pct': {
            patterns: [/^female/i, /female\s+sex/i, /^women/i, /^sex.*female/i],
            valuePattern: /(?:(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)|(\d+(?:\.\d+)?)(?:\s|$))/,
            captures: { 1: 'n', 2: 'pct', 3: 'pct' },
            validation: { pct: [0, 100] }
        },
        'baseline.sex.male_pct': {
            patterns: [/^male\s+sex/i, /^men\s*[-—]/i, /^male\b/i, /^sex\s*\(male\)/i],
            valuePattern: /(?:(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)|(\d+(?:\.\d+)?)(?:\s|$))/,  // v4.4: plain pct
            captures: { 1: 'n', 2: 'pct', 3: 'pct' },
            validation: { pct: [0, 100] }
        },
        // v4.4: CIBIS-II format: "Sex (M/F) 1062 (80%)/258 (20%)"
        'baseline.sex.mf_combined': {
            patterns: [/^sex\s*\(\s*m\s*\/\s*f\s*\)/i],
            valuePattern: /(\d+)\s*\(\s*(\d+)\s*%\s*\)\s*\/\s*(\d+)\s*\(\s*(\d+)\s*%\s*\)/,
            captures: { 1: 'male_n', 2: 'male_pct', 3: 'female_n', 4: 'female_pct' },
            validation: { male_pct: [0, 100], female_pct: [0, 100] }
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

        // Race/Ethnicity
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

        // Vitals
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

        // Labs
        'baseline.egfr': {
            patterns: [/eGFR/i, /estimated\s+glomerular/i, /glomerular\s+filtration/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [10, 150], sd: [5, 50] }
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

        // Comorbidities
        'baseline.diabetes_pct': {
            patterns: [/^diabetes\s+mellitus/i, /^diabetes\b/i, /^type\s+2\s+diabetes/i],
            valuePattern: /(?:(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)|(\d+(?:\.\d+)?)(?:\s|$))/,  // v4.4: Also plain pct
            captures: { 1: 'n', 2: 'pct', 3: 'pct' }
        },
        'baseline.hypertension_pct': {
            patterns: [/^hypertension\b/i, /^history.*hypertension/i, /^arterial\s+hypertension/i, /^treated\s+hypertension/i, /hypertension\s*[-–—]/i],
            valuePattern: /(?:(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)|(\d+(?:\.\d+)?)(?:\s|$))/,  // v4.4: Also plain pct
            captures: { 1: 'n', 2: 'pct', 3: 'pct' }
        },
        'baseline.af_pct': {
            patterns: [/^atrial\s+fibrillation/i, /^atrial\s+fibrillation.*flutter/i, /^history.*atrial\s+fib/i],
            valuePattern: /(?:(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)|(\d+(?:\.\d+)?)(?:\s|$))/,  // v4.4: plain pct
            captures: { 1: 'n', 2: 'pct', 3: 'pct' }
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
        'baseline.sleep_apnea_pct': {
            patterns: [/^sleep\s+apnea/i, /^obstructive\s+sleep/i, /^osa\b/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.cad_pct': {
            patterns: [/^coronary\s+artery\s+disease/i, /^cad\b/i, /^ischemic\s+heart\s+disease/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.pad_pct': {
            patterns: [/^peripheral\s+(?:artery|arterial|vascular)/i, /^pad\b/i, /^pvd\b/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.copd_pct': {
            patterns: [/^chronic\s+obstructive/i, /^copd\b/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },

        // Medications
        'baseline.meds.bb_pct': {
            patterns: [/^beta.?blocker/i, /^b-blocker/i],
            valuePattern: /(?:(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)|(\d+(?:\.\d+)?)(?:\s|$))/,  // v4.4: plain pct
            captures: { 1: 'n', 2: 'pct', 3: 'pct' }
        },
        'baseline.meds.ace_pct': {
            patterns: [/^ace\s+inhibitor/i, /^acei\b/i, /angiotensin.converting/i],
            valuePattern: /(?:(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)|(\d+(?:\.\d+)?)(?:\s|$))/,  // v4.4: plain pct format
            captures: { 1: 'n', 2: 'pct', 3: 'pct' }
        },
        'baseline.meds.arb_pct': {
            patterns: [/^angiotensin.*receptor\s+blocker/i, /^arb\b/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)/,  // v4.2: Added %? for MERIT-HF
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.statin_pct': {
            patterns: [/^statin/i, /^lipid.lowering/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)/,  // v4.2: Added %? for MERIT-HF
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.diuretic_pct': {
            patterns: [/^diuretic/i, /^loop\s+diuretic/i],
            valuePattern: /(?:(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)|(\d+(?:\.\d+)?)(?:\s|$))/,  // v4.4: plain pct
            captures: { 1: 'n', 2: 'pct', 3: 'pct' }
        },
        'baseline.meds.anticoag_pct': {
            patterns: [/^anticoagulant/i, /^oral\s+anticoagul/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.aspirin_pct': {
            patterns: [/^aspirin$/i],
            valuePattern: /(\d+)(?:\/\d+)?\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,  // Handle n/total (pct) or n (pct)
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
        
        rows.forEach(row => {
            // v4.2: Special handling for combined "Male/female 1539 (77%)/451 (23%)" format (MERIT-HF)
            // v4.4: Also handle "Sex (M/F) 1062 (80%)/258 (20%)" format (CIBIS-II)
            if ((/male\/female/i.test(row.label) || /^sex\s*\(\s*m\s*\/\s*f\s*\)/i.test(row.label)) && !results['baseline.sex.male_pct']) {
                const combinedMatch = row.values.match(/(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)\s*\/\s*(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)/);
                if (combinedMatch) {
                    results['baseline.sex.male_pct'] = { n: parseInt(combinedMatch[1]), pct: parseFloat(combinedMatch[2]), source: 'table_combined' };
                    results['baseline.sex.female_pct'] = { n: parseInt(combinedMatch[3]), pct: parseFloat(combinedMatch[4]), source: 'table_combined' };
                    return;  // Skip standard matching for this row
                }
            }
            
            // v4.2: Handle "Mean (SD) 63.9 (9.6)" format for age (MERIT-HF)
            // Also handles middle dot · as decimal separator
            if (/^age/i.test(row.label) && !results['baseline.age']) {
                const meanSdMatch = row.values.match(/Mean\s*\(SD\)\s*(\d+[·.]\d+)\s*\(\s*(\d+[·.]\d+)\s*\)/i);
                if (meanSdMatch) {
                    const mean = parseFloat(meanSdMatch[1].replace('·', '.'));
                    const sd = parseFloat(meanSdMatch[2].replace('·', '.'));
                    if (mean >= 18 && mean <= 100 && sd >= 1 && sd <= 30) {
                        results['baseline.age'] = { mean, sd, source: 'table_mean_sd' };
                        return;
                    }
                }
            }
            
            Object.entries(this.fields).forEach(([fieldId, fieldDef]) => {
                if (results[fieldDef.mapTo || fieldId]) return;
                
                const labelMatch = fieldDef.patterns.some(p => p.test(row.label));
                if (!labelMatch) return;
                
                const match = fieldDef.valuePattern.exec(row.values);
                if (!match) return;
                
                const extracted = { source: 'table_core', rowLabel: row.label };
                Object.entries(fieldDef.captures).forEach(([groupNum, name]) => {
                    const val = parseFloat(match[parseInt(groupNum)]);
                    if (!isNaN(val)) extracted[name] = val;
                });
                
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
        
        // Calculate female % from male % if needed
        if (results['baseline.sex.male_pct'] && !results['baseline.sex.female_pct']) {
            results['baseline.sex.female_pct'] = {
                pct: 100 - results['baseline.sex.male_pct'].pct,
                source: 'calculated'
            };
        }
        
        // Calculate male % from female % if needed (v4.1: DAPA-HF reports female only)
        if (results['baseline.sex.female_pct'] && !results['baseline.sex.male_pct']) {
            results['baseline.sex.male_pct'] = {
                pct: Math.round((100 - results['baseline.sex.female_pct'].pct) * 10) / 10,
                source: 'calculated'
            };
        }
        
        return results;
    }
};

// ============================================================
// LAYER 6: OUTCOMES EXTRACTOR (enhanced for AF and HF trials)
// ============================================================
const OutcomesExtractor = {
    extract(text) {
        const results = {};
        const lines = text.split('\n');
        
        const hrPatterns = [
            // v4.2: PARADIGM-HF format: "hazard ratio in the LCZ696 group, 0.80; 95% confidence interval [CI], 0.73 to 0.87"
            /hazard\s+ratio\s+in\s+(?:the\s+)?\w+\s+group,?\s*(\d+\.\d+)[;,]?\s*(?:97\.5%?|95%?)\s*confidence\s+interval\s*\[?CI\]?,?\s*(\d+\.\d+)\s*(?:to|-|–)\s*(\d+\.\d+)/gi,
            // v4.2: EMPEROR format: "hazard ratio for X, 0.75; 95% confidence interval [CI], 0.65 to 0.86"
            /hazard\s+ratio\s+for\s+[^,]+,\s*(\d+\.\d+)[;,]\s*(?:97\.5%?|95%?)\s*confidence\s+interval\s*\[?CI\]?,?\s*(\d+\.\d+)\s*(?:to|-|–)\s*(\d+\.\d+)/gi,
            // HF trial format: "hazard ratio was 0.74 (95% CI, 0.65 to 0.85; P<0.001)"
            /hazard\s+ratio\s+(?:was\s+)?(\d+\.\d+)\s*\(\s*(?:97\.5%?\s*|95%?\s*)?CI[,:\s]*(\d+\.\d+)\s*(?:to|[-–])\s*(\d+\.\d+)(?:[^)]*)\)/gi,
            // HF trial format without parentheses: "hazard ratio was 0.74; 95% CI, 0.65 to 0.85"
            /hazard\s+ratio\s+(?:was\s+)?(\d+\.\d+)[;,]\s*(?:97\.5%?\s*|95%?\s*)?CI[,:\s]*(\d+\.\d+)\s*(?:to|[-–])\s*(\d+\.\d+)/gi,
            // Standard patterns with 95% or 97.5% CI
            /hazard\s+ratio\s*[:,]?\s*(\d+\.\d+)\s*[;,]?\s*(?:97\.5%?\s*|95%?\s*)?(?:CI|confidence)[,:\s]*(\d+\.\d+)\s*(?:to|[-–])\s*(\d+\.\d+)/gi,
            /hazard\s+ratio[^,]+,\s*(\d+\.\d+)\s*\(\s*(?:97\.5%?\s*|95%?\s*)?(?:CI)?[,:\s]*(\d+\.\d+)\s*(?:to|[-–])\s*(\d+\.\d+)/gi,
            /\(hazard\s+ratio[,:\s]+(\d+\.\d+)[;,]\s*(?:97\.5%?\s*|95%?\s*)?(?:CI)[,:\s]*(\d+\.\d+)\s*(?:to|[-–])\s*(\d+\.\d+)/gi,
            /(?:hazard\s+ratio|HR)[,:\s]+(\d+\.\d+)\s*\[\s*(?:97\.5%?\s*|95%?\s*)?(?:CI)?[,:\s]*(\d+\.\d+)\s*[-–]\s*(\d+\.\d+)\s*\]/gi,
            /(?:hazard\s+ratio|HR)[,:\s]+(\d+\.\d+)\s*\(\s*(?:97\.5%?\s*|95%?\s*)?(?:CI)?[,:\s]*(\d+\.\d+)\s*[-–]\s*(\d+\.\d+)/gi,
            // ENGAGE-AF format: "hazard ratio, 0.79; 97.5% confidence interval [CI], 0.63 to 0.99"
            /hazard\s+ratio,?\s*(\d+\.\d+)[;,]?\s*(?:97\.5%?|95%?)\s*confidence\s+interval\s*\[?CI\]?,?\s*(\d+\.\d+)\s*(?:to|-|–)\s*(\d+\.\d+)/gi,
            // AFFIRM format: "hazard ratio, 1.15 [95 percent confidence interval, 0.99 to 1.34]"
            /hazard\s+ratio,?\s*(\d+\.\d+)\s*\[\s*(?:97\.5|95)\s*percent\s+confidence\s+interval,?\s*(\d+\.\d+)\s*(?:to|-|–)\s*(\d+\.\d+)\s*\]/gi,
            // AVERROES format: "hazard ratio with apixaban, 0.45; 95% confidence interval [CI], 0.32 to 0.62"
            /hazard\s+ratio\s+with\s+\w+,?\s*(\d+\.\d+)[;,]?\s*(?:97\.5%?|95%?)\s*confidence\s+interval\s*\[?CI\]?,?\s*(\d+\.\d+)\s*(?:to|-|–)\s*(\d+\.\d+)/gi,
            // HF trial format: "HR 0.74; 95% CI 0.65-0.85" or "HR, 0.74 (95% CI, 0.65-0.85)"
            /\bHR[,:\s]+(\d+\.\d+)[;,]?\s*(?:97\.5%?\s*|95%?\s*)?CI[,:\s]*(\d+\.\d+)\s*[-–]\s*(\d+\.\d+)/gi,
            // Relative risk patterns
            /relative\s+risk[,:\s]+(\d+\.\d+)\s*[;,]\s*(?:97\.5%?\s*|95%?\s*)?(?:CI)[,:\s]*(\d+\.\d+)\s*(?:to|[-–])\s*(\d+\.\d+)/gi,
            /(?:relative\s+risk|RR)[,:\s]+(\d+\.\d+)\s*\(\s*(?:97\.5%?\s*|95%?\s*)?(?:CI)?[,:\s]*(\d+\.\d+)\s*(?:to|[-–])\s*(\d+\.\d+)/gi,
            // v4.2: MERIT-HF format: "relative risk 0.66 [95% CI 0.53–0.81]" or with middle dot ·
            /relative\s+risk\s+(\d+[·.]\d+)\s*\[\s*(?:97\.5%?\s*|95%?\s*)?CI\s+(\d+[·.]\d+)\s*[-–]\s*(\d+[·.]\d+)\s*\]/gi,
            // v4.2: RALES format: "relative risk of death, 0.70; 95 percent confidence interval, 0.60 to 0.82"
            /relative\s+risk(?:\s+of\s+\w+)?,?\s*(\d+[·.]\d+)[;,]\s*(?:97\.5|95)\s*percent\s+confidence\s+interval,?\s*(\d+[·.]\d+)\s*(?:to|-|–)\s*(\d+[·.]\d+)/gi,
            // v4.4: DIG format: "risk ratio when digoxin was compared with placebo, 0.99; 95 percent confidence interval, 0.91 to 1.07"
            /risk\s+ratio[^,]*,?\s*(\d+[·.]\d+)[;,]\s*(?:97\.5|95)\s*percent\s+confidence\s+interval,?\s*(\d+[·.]\d+)\s*(?:to|-|–)\s*(\d+[·.]\d+)/gi,
            // Generic pattern for HR value with CI
            /(\d+\.\d+)\s*\(\s*(?:97\.5%?\s*|95%?\s*)?(?:CI)?[,:\s]*(\d+\.\d+)\s*(?:to|[-–])\s*(\d+\.\d+)\s*\)/gi
        ];
        
        // Keywords indicating secondary/safety outcomes to AVOID
        const excludeKeywords = [
            'hemorrhagic stroke', 'ischemic stroke', 'bleeding', 'hemorrhage',
            'intracranial', 'major bleeding', 'minor bleeding', 'gi bleeding',
            'death from cardiovascular', 'cardiovascular death', 'all-cause mortality',
            'death from any cause', 'any cause', 'died from any cause',
            'secondary end', 'safety end', 'net clinical', 'key secondary',
            'hospitalization', 'worsening heart failure'
        ];
        
        const primaryKeywords = [
            'primary outcome', 'primary-outcome', 'primary endpoint', 'primary composite', 'primary end point',
            'primary efficacy', 'for the primary'
        ];
        
        let primaryLineIndices = [];
        for (let i = 0; i < lines.length; i++) {
            const lineLower = lines[i].toLowerCase();
            if (primaryKeywords.some(kw => lineLower.includes(kw))) {
                primaryLineIndices.push(i);
            }
        }
        
        let allContrasts = [];
        
        for (const primaryIdx of primaryLineIndices) {
            const searchStart = Math.max(0, primaryIdx - 1);
            let searchEnd = Math.min(lines.length, primaryIdx + 8);  // Extended range for AFFIRM
            
            // v4.4: Stop search at "Secondary" marker to avoid picking up secondary endpoints
            for (let i = primaryIdx + 1; i < searchEnd; i++) {
                if (/^secondary\s+endpoint/i.test(lines[i].trim())) {
                    searchEnd = i;
                    break;
                }
            }
            
            const contextLines = lines.slice(searchStart, searchEnd).join(' ');
            
            for (const pattern of hrPatterns.slice(0, 20)) {  // Include all HR patterns (v4.2: +3 for PARADIGM, MERIT-HF & RALES)
                pattern.lastIndex = 0;
                let match;
                while ((match = pattern.exec(contextLines)) !== null) {
                    // v4.2: Replace middle dot (·) with regular decimal point for older papers
                    const effect = parseFloat(match[1].replace('·', '.'));
                    const ciLo = parseFloat(match[2].replace('·', '.'));
                    const ciHi = parseFloat(match[3].replace('·', '.'));
                    if (effect >= 0.3 && effect <= 2.0 && ciLo < effect && effect < ciHi) {
                        const matchStart = match.index;
                        const contextAround = contextLines.substring(
                            Math.max(0, matchStart - 150),  // Increased to catch primary keyword
                            Math.min(contextLines.length, matchStart + 50)
                        ).toLowerCase();
                        
                        // Skip if this looks like a secondary outcome
                        // BUT don't exclude if "primary" is explicitly in the broader context
                        // v4.2: Also don't exclude mortality if it appears to be THE result (HF/beta-blocker trials)
                        const hasPrimaryKeyword = contextAround.includes('primary') || 
                                                  contextLines.toLowerCase().includes('primary outcome');
                        // v4.2: Check if this is the main mortality result (not a component)
                        const isMainMortalityResult = contextAround.includes('mortality was lower') ||
                                                      contextAround.includes('deaths') ||
                                                      /\d+\s+vs\s+\d+\s+deaths/i.test(contextAround);
                        // Also skip if context mentions death rates (not stroke/embolism)
                        const isDeathOutcome = !isMainMortalityResult && (
                            contextAround.includes('rate of death') || 
                            contextAround.includes('rates of death') ||
                            (contextAround.includes('death') && !contextAround.includes('stroke') && !contextAround.includes('cardiovascular death'))
                        );
                        const isExcluded = !hasPrimaryKeyword && !isMainMortalityResult && (excludeKeywords.some(kw => contextAround.includes(kw)) || isDeathOutcome);
                        if (isExcluded) continue;
                        
                        const isSuperiority = contextAround.includes('superiority');
                        const isNoninferiority = contextAround.includes('noninferiority') || contextAround.includes('non-inferiority');
                        const isHighDose = contextAround.includes('high-dose') || contextAround.includes('high dose');
                        const isLowDose = contextAround.includes('low-dose') || contextAround.includes('low dose');
                        const isPerProtocol = contextAround.includes('per-protocol') || contextAround.includes('per protocol');
                        const isITT = contextAround.includes('intention-to-treat') || contextAround.includes('intention to treat');
                        
                        allContrasts.push({
                            effect, ciLo, ciHi,
                            measureType: contextAround.includes('relative risk') ? 'RR' : 'HR',
                            isSuperiority,
                            isNoninferiority,
                            isHighDose,
                            isLowDose,
                            isPerProtocol,
                            isITT,
                            source: 'prose_primary'
                        });
                    }
                }
            }
        }
        
        if (allContrasts.length > 0) {
            // For NOAC trials, prefer per-protocol result for primary analysis
            // For other trials, prefer superiority or ITT
            allContrasts.sort((a, b) => {
                // Superiority first
                if (a.isSuperiority && !b.isSuperiority) return -1;
                if (!a.isSuperiority && b.isSuperiority) return 1;
                
                // Per-protocol for NOAC trials
                if (a.isPerProtocol && !b.isPerProtocol) return -1;
                if (!a.isPerProtocol && b.isPerProtocol) return 1;
                
                // High-dose over low-dose
                if (a.isHighDose && b.isLowDose) return -1;
                if (a.isLowDose && b.isHighDose) return 1;
                
                // Non-inferiority last
                if (a.isNoninferiority && !b.isNoninferiority) return 1;
                if (!a.isNoninferiority && b.isNoninferiority) return -1;
                
                return a.effect - b.effect;
            });
            
            results.contrast = allContrasts[0];
            delete results.contrast.isSuperiority;
            delete results.contrast.isNoninferiority;
            delete results.contrast.isHighDose;
            delete results.contrast.isLowDose;
            delete results.contrast.isPerProtocol;
            delete results.contrast.isITT;
        }
        
        // Fallback: Look for HR in text, but still filter out secondary outcomes
        if (!results.contrast) {
            for (const line of lines) {
                const lineLower = line.toLowerCase();
                
                // Skip lines that look like secondary/safety outcomes
                if (/subgroup|secondary|per.?protocol|sensitivity/i.test(line)) continue;
                
                // v4.2: Check if this is the main mortality result (MERIT-HF, CIBIS-II)
                // These have all-cause mortality as primary endpoint
                const isMainMortalityResult = lineLower.includes('mortality was lower') ||
                                              lineLower.includes('mortality was higher') ||
                                              lineLower.includes('mortality was unaffected') ||  // v4.4: DIG neutral result
                                              /\d+\s+vs\s+\d+\s+deaths/i.test(line) ||
                                              (lineLower.includes('deaths') && (lineLower.includes('relative risk') || lineLower.includes('risk ratio')));
                
                // Skip excluded keywords unless it's the main mortality result
                if (!isMainMortalityResult && excludeKeywords.some(kw => lineLower.includes(kw))) continue;
                
                if (lineLower.includes('hazard ratio') || lineLower.includes('relative risk') || lineLower.includes('risk ratio') || /\b(hr|rr)\s*[,=:]/i.test(line)) {
                    for (const pattern of hrPatterns.slice(0, 20)) {  // v4.2: Use all patterns including RR
                        pattern.lastIndex = 0;
                        const match = pattern.exec(line);
                        if (match) {
                            // v4.2: Replace middle dot (·) with regular decimal point for older papers
                            const effect = parseFloat(match[1].toString().replace('·', '.'));
                            const ciLo = parseFloat(match[2].toString().replace('·', '.'));
                            const ciHi = parseFloat(match[3].toString().replace('·', '.'));
                            if (effect >= 0.3 && effect <= 2.0 && ciLo < effect && effect < ciHi) {
                                results.contrast = {
                                    effect: effect,
                                    ciLo: ciLo,
                                    ciHi: ciHi,
                                    measureType: lineLower.includes('relative risk') || lineLower.includes('risk ratio') ? 'RR' : 'HR',
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
        
        // v4.2: Special pattern for "X percent decrease/reduction" format (COPERNICUS)
        // "35 percent decrease in the risk of death ... (95 percent confidence interval, 19 to 48 percent"
        if (!results.contrast) {
            const decreasePattern = /(\d+)\s*percent\s+(?:decrease|reduction)\s+in\s+(?:the\s+)?risk\s+of\s+death.*?\(\s*(?:97\.5|95)\s*percent\s+confidence\s+interval,?\s*(\d+)\s*to\s*(\d+)\s*percent/i;
            const match = text.match(decreasePattern);
            if (match) {
                const decreasePct = parseInt(match[1]);
                const ciLoPct = parseInt(match[2]);  // This is the LOWER bound of % decrease = UPPER bound of HR
                const ciHiPct = parseInt(match[3]);  // This is the UPPER bound of % decrease = LOWER bound of HR
                
                // Convert percent decrease to relative risk
                // 35% decrease = RR of 0.65
                const effect = 1 - (decreasePct / 100);
                const ciLo = 1 - (ciHiPct / 100);  // Flip: higher % decrease = lower HR
                const ciHi = 1 - (ciLoPct / 100);  // Flip: lower % decrease = higher HR
                
                if (effect >= 0.3 && effect <= 1.0 && ciLo < effect && effect < ciHi) {
                    results.contrast = {
                        effect: Math.round(effect * 100) / 100,
                        ciLo: Math.round(ciLo * 100) / 100,
                        ciHi: Math.round(ciHi * 100) / 100,
                        measureType: 'RR',
                        source: 'prose_decrease'
                    };
                }
            }
        }
        
        return results;
    }
};

// ============================================================
// LAYER 7: SAFETY EXTRACTOR
// ============================================================
const SafetyExtractor = {
    extract(text) {
        const results = {};
        return results;
    }
};

// ============================================================
// LAYER 8: PROSE EXTRACTOR (enhanced for AF trials)
// ============================================================
const ProseExtractor = {
    extract(text) {
        const results = {};
        
        // Look for acronyms first in the most prominent positions (titles, abstracts)
        // Pattern priority: explicit trial name > parenthetical > generic
        const lines = text.split('\n');
        
        // First try: Look in the first 80 lines for explicit trial names
        const firstPartText = lines.slice(0, Math.min(80, lines.length)).join('\n');
        
        // HF trial-specific patterns (high priority)
        const hfTrialPatterns = [
            { pattern: /\bDAPA-?HF\b/i, name: 'DAPA-HF' },
            { pattern: /\bEMPEROR[- ]?Reduced\b/i, name: 'EMPEROR-Reduced' },
            { pattern: /\bEMPEROR[- ]?Preserved\b/i, name: 'EMPEROR-Preserved' },
            { pattern: /\bDELIVER\b/i, name: 'DELIVER' },
            { pattern: /\bPARADIGM[- ]?HF\b/i, name: 'PARADIGM-HF' },
            { pattern: /\bPARAGON[- ]?HF\b/i, name: 'PARAGON-HF' },
            { pattern: /\bGALACTIC[- ]?HF\b/i, name: 'GALACTIC-HF' },
            { pattern: /\bEMPHASIS[- ]?HF\b/i, name: 'EMPHASIS-HF' },
            { pattern: /\bSOLOIST[- ]?WHF\b/i, name: 'SOLOIST-WHF' },
            { pattern: /\bRALES\b/i, name: 'RALES' },
            { pattern: /\bCOPERNICUS\b/i, name: 'COPERNICUS' },
            { pattern: /\bMERIT[- ]?HF\b/i, name: 'MERIT-HF' },
            { pattern: /\bSHIFT\b/i, name: 'SHIFT' },
            { pattern: /\bVal[- ]?HeFT\b/i, name: 'Val-HeFT' },
            { pattern: /\bATLAS\b(?!.*ACS)/i, name: 'ATLAS' },
            { pattern: /\bHEAAL\b/i, name: 'HEAAL' },
            { pattern: /\bCHARM[- ]?(?:Added|Alternative|Preserved|Overall)?\b/i, name: 'CHARM' },
            { pattern: /\bSOLVD\b/i, name: 'SOLVD' },
            { pattern: /Dapagliflozin\s+(?:and\s+Prevention|in\s+Patients\s+with)\s+Heart\s+Failure/i, name: 'DAPA-HF' },
            { pattern: /Empagliflozin.*Heart\s+Failure.*Reduced\s+Ejection/i, name: 'EMPEROR-Reduced' },
            { pattern: /Empagliflozin.*Heart\s+Failure.*Preserved\s+Ejection/i, name: 'EMPEROR-Preserved' }
        ];
        
        // AF trial-specific patterns (high priority)
        const afTrialPatterns = [
            { pattern: /\bCABANA\b(?:\s+(?:trial|study))?/i, name: 'CABANA' },
            { pattern: /\bCASTLE[- ]?AF\b/i, name: 'CASTLE-AF' },
            { pattern: /\bROCKET[- ]?AF\b/i, name: 'ROCKET AF' },
            { pattern: /\bENGAGE[- ]?AF(?:[- ]?TIMI\s*48)?\b/i, name: 'ENGAGE AF-TIMI 48' },
            { pattern: /\(RE[- ]?LY\)/i, name: 'RE-LY' },  // Parenthetical format
            { pattern: /\bRE[- ]?LY\b/i, name: 'RE-LY' },
            { pattern: /\bARISTOTLE\b/i, name: 'ARISTOTLE' },
            { pattern: /\bAFFIRM\b/i, name: 'AFFIRM' },
            { pattern: /\bRACE\s*(?:II|2)\b/i, name: 'RACE II' },
            { pattern: /Atrial\s+Fibrillation\s+Follow[- ]?up\s+Investigation\s+of\s+Rhythm\s+Management/i, name: 'AFFIRM' },
            { pattern: /\bAVERROES\b/i, name: 'AVERROES' },
            { pattern: /Apixaban\s+Versus\s+Acetylsalicylic\s+Acid/i, name: 'AVERROES' }
        ];
        
        // Combine all trial patterns (HF first, then AF)
        const allTrialPatterns = [...hfTrialPatterns, ...afTrialPatterns];
        
        // First priority: Check for explicit trial names
        for (const { pattern, name } of allTrialPatterns) {
            if (pattern.test(firstPartText)) {
                results['study.acronym'] = name;
                break;
            }
        }
        
        // If not found, try broader patterns
        if (!results['study.acronym']) {
            const acronymPatterns = [
                /\bthe\s+(\w+(?:-\w+)?)\s+(?:trial|study)\b/i,
                /\b(\w+(?:-\w+)?)\s+(?:trial|study)\s+(?:was|is)/i,
                /\(([A-Z]{3,}(?:-[A-Z]+)?)\)/
            ];
            
            for (const pattern of acronymPatterns) {
                const match = firstPartText.match(pattern);
                if (match) {
                    let acronym = match[1].trim();
                    if (acronym.length >= 3 && !/^(THE|AND|FOR|WITH)$/i.test(acronym)) {
                        results['study.acronym'] = acronym;
                        break;
                    }
                }
            }
        }
        
        // Sites and countries
        const sitesPatterns = [
            /(\d+)\s+(?:participating\s+)?(?:clinical\s+)?(?:sites|centers|centres)\s+(?:in|across)\s+(\d+)\s+countries/i,
            // v4.2: MERIT-HF format "313 investigational sites in 13 European countries and in the USA" 
            /(\d+)\s+(?:investigational\s+)?(?:clinical\s+)?(?:sites|centers|centres)\s+in\s+(\d+)\s+\w+\s+countries\s+and\s+(?:in\s+)?the\s+USA/i,
            /(\d+)\s+(?:investigational\s+)?(?:clinical\s+)?(?:sites|centers|centres)/i,
            /recruited\s+(?:at|from)\s+(\d+)\s+(?:clinical\s+)?(?:sites|centers|centres)/i,
            /involving\s+(\d+)\s+centers\s+in\s+(\d+)\s+countries/i,
            /multicenter.*?(\d+)\s+(?:sites|centers)/i
        ];
        
        for (const pattern of sitesPatterns) {
            const match = text.match(pattern);
            if (match) {
                results['study.sites'] = parseInt(match[1]);
                if (match[2]) {
                    // v4.2: Check if pattern matched "X countries and USA" - add 1 for USA
                    if (/and\s+(?:in\s+)?the\s+USA/i.test(match[0])) {
                        results['study.countries'] = parseInt(match[2]) + 1;
                    } else {
                        results['study.countries'] = parseInt(match[2]);
                    }
                }
                break;
            }
        }
        
        // Countries only
        if (!results['study.countries']) {
            const countryMatch = text.match(/in\s+(\d+)\s+countries/i);
            if (countryMatch) {
                results['study.countries'] = parseInt(countryMatch[1]);
            }
        }
        
        // Follow-up duration - enhanced patterns with prioritization
        // Priority: actual median follow-up > mean follow-up > median duration > planned follow-up
        const followUpPatterns = [
            // HIGH PRIORITY: Explicit "median follow-up was X years/months"
            { pattern: /median\s+(?:duration\s+of\s+)?follow[- ]?up(?:\s+(?:was|of))?\s+(\d+(?:\.\d+)?)\s*(years?|months?)/i, priority: 1 },
            { pattern: /median\s+follow[- ]?up\s+(?:time|period|duration)?\s*(?:was|of|:)?\s*(\d+(?:\.\d+)?)\s*(years?|months?)/i, priority: 1 },
            // "The median follow-up was 2.8 years"
            { pattern: /(?:the\s+)?median\s+follow[- ]?up\s+(?:was\s+)?(\d+(?:\.\d+)?)\s*(years?|months?)/i, priority: 1 },
            // v4.4: SHIFT format: "Median follow-up was 22.9 (IQR 18-28) months" - IQR between number and unit
            { pattern: /median\s+(?:duration\s+of\s+)?follow[- ]?up\s+(?:was\s+)?(\d+(?:\.\d+)?)\s*\([^)]+\)\s*(years?|months?)/i, priority: 1 },
            
            // v4.1: DAPA-HF format: "Over a median of 18.2 months"
            { pattern: /over\s+a\s+median\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(years?|months?)/i, priority: 1 },
            // "median of X months/years" in results context
            { pattern: /median\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(years?|months?)[,.\s]/i, priority: 1 },
            
            // AFFIRM format: "mean follow-up time was 3.5 years" or "mean followup time"
            { pattern: /mean\s+follow[- ]?up\s+(?:time|period|duration)?\s*(?:was|of|:)?\s*(\d+(?:\.\d+)?)\s*(years?|months?)/i, priority: 1 },
            { pattern: /(?:the\s+)?mean\s+follow[- ]?up\s+(?:was\s+)?(\d+(?:\.\d+)?)\s*(years?|months?)/i, priority: 1 },
            { pattern: /mean\s+followup\s+(?:time|period|duration)?\s*(?:was|of|:)?\s*(\d+(?:\.\d+)?)\s*(years?|months?)/i, priority: 1 },
            // v4.2: COPERNICUS format: "mean duration of follow-up was 10.4 months"
            { pattern: /mean\s+duration\s+of\s+follow[- ]?up\s+(?:was\s+)?(\d+(?:\.\d+)?)\s*(years?|months?)/i, priority: 1 },
            
            // MEDIUM PRIORITY: General patterns
            { pattern: /followed\s+(?:up\s+)?for\s+(?:a\s+)?median\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(years?|months?)/i, priority: 2 },
            { pattern: /median\s+(?:duration\s+(?:of\s+)?)?(\d+(?:\.\d+)?)\s*(years?|months?)\s+(?:of\s+)?follow[- ]?up/i, priority: 2 },
            { pattern: /followed\s+(?:up\s+)?for\s+(?:a\s+)?mean\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(years?|months?)/i, priority: 2 },
            
            // LOW PRIORITY: Less specific patterns (avoid picking up planned durations)
            { pattern: /(\d+(?:\.\d+)?)\s*(years?|months?)\s+(?:of\s+)?(?:median\s+)?follow[- ]?up/i, priority: 3 },
            
            // YEARS without "median" - lower priority, only if nothing else found
            { pattern: /follow[- ]?up.*?(\d+(?:\.\d+)?)\s*(years?)/i, priority: 4 }
        ];
        
        let bestMatch = null;
        let bestPriority = 99;
        
        for (const { pattern, priority } of followUpPatterns) {
            const match = text.match(pattern);
            if (match && priority < bestPriority) {
                let duration = parseFloat(match[1]);
                const unit = match[2].toLowerCase();
                
                // Skip if this looks like planned/intended duration in study design
                const matchContext = text.substring(
                    Math.max(0, match.index - 100),
                    Math.min(text.length, match.index + match[0].length + 50)
                ).toLowerCase();
                
                // Skip if context suggests planned/intended rather than actual
                if (matchContext.includes('planned') || 
                    matchContext.includes('intended') ||
                    matchContext.includes('minimum') ||
                    matchContext.includes('at least') ||
                    matchContext.includes('study design')) {
                    continue;
                }
                
                // Convert to appropriate unit
                if (unit.startsWith('year') && duration < 10) {
                    // Keep as years for values < 10 years
                    bestMatch = { duration, unit: 'years' };
                } else if (unit.startsWith('month')) {
                    bestMatch = { duration, unit: 'months' };
                } else {
                    bestMatch = { duration, unit: unit };
                }
                bestPriority = priority;
            }
        }
        
        if (bestMatch) {
            results['study.followUp'] = bestMatch.duration;
            results['study.followUpUnit'] = bestMatch.unit;
        }
        
        // TTR (Time in Therapeutic Range) for AF trials - enhanced patterns
        const ttrPatterns = [
            // "mean of 55% of the time" - ROCKET-AF style
            /(?:mean|average)\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*%\s+of\s+the\s+time/i,
            // Standard patterns
            /therapeutic\s+range[^.]*?(\d+(?:\.\d+)?)\s*%\s+of\s+the\s+time/i,
            /(?:time\s+in|within)\s+(?:the\s+)?therapeutic\s+range[,:\s]+(?:median[,:\s]+)?(\d+(?:\.\d+)?)\s*%/i,
            /ttr[,:\s]+(\d+(?:\.\d+)?)\s*%/i,
            // "INR values were within the therapeutic range a mean of X%"
            /inr\s+values?\s+(?:were\s+)?(?:within|in)\s+(?:the\s+)?therapeutic\s+range\s+(?:a\s+)?(?:mean\s+of\s+)?(\d+(?:\.\d+)?)\s*%/i,
            /median[,:]?\s*(\d+(?:\.\d+)?)\s*%[^.]*therapeutic\s+range/i,
            // "within the therapeutic range (2.0 to 3.0) a mean of 55%"
            /therapeutic\s+range\s*\([^)]*\)\s*(?:a\s+)?(?:mean\s+of\s+)?(\d+(?:\.\d+)?)\s*%/i,
            // "therapeutic range, 68.4%" - ENGAGE-AF style in parentheses
            /therapeutic\s+range,?\s+(\d+(?:\.\d+)?)\s*%/i,
            // "mean time in therapeutic range was X%"
            /mean\s+(?:\([^)]*\)\s+)?time\s+in\s+(?:the\s+)?therapeutic\s+range\s+(?:was\s+)?(\d+(?:\.\d+)?)\s*%/i,
            // RE-LY style: "was within the therapeutic range was 64%"
            /(?:was|were)\s+(?:within|in)\s+(?:the\s+)?therapeutic\s+range\s+(?:was\s+)?(\d+(?:\.\d+)?)\s*%/i,
            // "in the therapeutic range...X%"
            /in\s+(?:the\s+)?therapeutic\s+range[^.]*?(\d+(?:\.\d+)?)\s*%/i
        ];
        
        for (const pattern of ttrPatterns) {
            const match = text.match(pattern);
            if (match) {
                const ttr = parseFloat(match[1]);
                if (ttr >= 30 && ttr <= 100) {
                    results['study.ttr_pct'] = ttr;
                    break;
                }
            }
        }
        
        return results;
    }
};

// ============================================================
// LAYER 9: NNT CALCULATOR
// ============================================================
const NNTCalculator = {
    calculate(outcomeData) {
        const results = {};
        return results;
    }
};

// ============================================================
// LAYER 10: AF-SPECIFIC MODULE (enhanced)
// ============================================================
const AFModule = {
    fields: {
        // Risk Scores - enhanced for various label formats
        'baseline.chads2_score': {
            patterns: [/^chads2\s*(?:score|risk)/i, /^chads2$/i, /^mean\s+score/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [0, 6] },
            critical: true
        },
        'baseline.cha2ds2vasc_score': {
            patterns: [/cha2ds2.vasc/i, /chads.?vasc/i, /cha.?ds.?vasc/i],
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
        
        // AF Type
        'baseline.af_type.paroxysmal_pct': {
            patterns: [/paroxysmal\s+(?:af|atrial)/i, /^paroxysmal$/i, /^paroxysmal\s+AF/i],
            valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.af_type.persistent_pct': {
            patterns: [/persistent\s+(?:af|atrial)/i, /^persistent$/i, /^persistent\s+AF/i],
            valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.af_type.permanent_pct': {
            patterns: [/permanent\s+(?:af|atrial)/i, /^permanent$/i],
            valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // Prior Events - enhanced for combined patterns
        'baseline.prior_stroke_tia_pct': {
            patterns: [
                /prior\s+stroke.*tia/i, 
                /stroke.*transient/i, 
                /history.*stroke/i,
                /previous\s+stroke.*(?:transient|tia)/i,
                /^previous\s+stroke/i,
                /stroke.*systemic\s+embolism.*transient/i,
                /prior\s+stroke.*systemic\s+embol/i,
                /^prior\s+cva\s+or\s+tia/i,  // CABANA: "Prior CVA or TIA"
                /^prior\s+cva/i,
                /^cva\s+or\s+tia/i
            ],
            valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            critical: true
        },
        'baseline.prior_bleed_pct': {
            patterns: [/prior.*bleed/i, /history.*bleed/i, /previous.*hemorrhage/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // Heart failure
        'baseline.heart_failure_pct': {
            patterns: [/^heart\s+failure$/i, /^congestive\s+heart\s+failure/i, /^chf\b/i, /^hf\b/i],
            valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // Anticoagulation History
        'baseline.prior_vka_pct': {
            patterns: [/prior.*(?:warfarin|vka)/i, /previous.*(?:warfarin|vka)/i, /(?:warfarin|vka).*experienc/i, /long.?term\s+vka/i, /vitamin\s+k\s+antagonist/i],
            valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
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
        'baseline.ef': {
            patterns: [/left\s+ventricular\s+ejection/i, /^lvef\b/i, /^ejection\s+fraction/i, /^lv\s+ejection/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' }
        },
        
        // HF/AF overlap: NYHA class
        'baseline.nyha.class1_pct': {
            patterns: [/^nyha.*(?:class\s+)?i\b(?!\s*i)/i, /^i$/],
            valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.nyha.class2_pct': {
            patterns: [/^nyha.*(?:class\s+)?ii\b(?!\s*i)/i, /^ii$/],
            valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.nyha.class3_pct': {
            patterns: [/^nyha.*(?:class\s+)?iii\b/i, /^iii$/],
            valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.nyha.class4_pct': {
            patterns: [/^nyha.*(?:class\s+)?iv\b/i, /^iv$/],
            valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // Device therapy (for ablation trials)
        'baseline.device.icd_pct': {
            patterns: [/^icd\s+implanted/i, /^implantable\s+cardioverter/i],
            valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.device.crt_pct': {
            patterns: [/^crt.?d?\s+implanted/i, /^cardiac[\s-]+resynchronization/i],
            valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // HF etiology (for AF+HF trials)
        'baseline.ischemic_hf_pct': {
            patterns: [/^isch(?:ae|e)mic$/i, /cause.*isch(?:ae|e)mic/i, /isch(?:ae|e)mic.*cardiomyopathy/i],
            valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)/,  // v4.2: Added %? for MERIT-HF
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // Renal function
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

    extract(rows, text) {
        const results = {};
        const lines = text.split('\n');
        
        rows.forEach(row => {
            Object.entries(this.fields).forEach(([fieldId, fieldDef]) => {
                if (results[fieldDef.mapTo || fieldId]) return;
                
                const labelMatch = fieldDef.patterns.some(p => p.test(row.label));
                if (!labelMatch) return;
                
                const match = fieldDef.valuePattern.exec(row.values);
                if (!match) return;
                
                const extracted = { source: 'table_af', rowLabel: row.label };
                Object.entries(fieldDef.captures).forEach(([groupNum, name]) => {
                    const val = parseFloat(match[parseInt(groupNum)]);
                    if (!isNaN(val)) extracted[name] = val;
                });
                
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
        const directPatterns = [
            { fieldId: 'baseline.af_type.paroxysmal_pct', linePattern: /^paroxysmal\b/i, valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/ },
            { fieldId: 'baseline.af_type.persistent_pct', linePattern: /^persistent\b/i, valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/ },
            { fieldId: 'baseline.af_type.permanent_pct', linePattern: /^permanent\b/i, valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/ },
            { fieldId: 'baseline.heart_failure_pct', linePattern: /^(?:congestive\s+)?heart\s+failure\b/i, valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/ },
            { fieldId: 'baseline.prior_stroke_tia_pct', linePattern: /previous\s+stroke.*(?:transient|tia|systemic)|^prior\s+stroke/i, valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/ },
            { fieldId: 'baseline.prior_vka_pct', linePattern: /long.?term\s+vka|prior.*vka|vitamin\s+k\s+antag|previous.*(?:warfarin|vka)/i, valuePattern: /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/ }
        ];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            for (const dp of directPatterns) {
                if (results[dp.fieldId]) continue;
                
                if (dp.linePattern.test(line)) {
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
        
        // Handle multiline stroke/TIA/embolism pattern
        if (!results['baseline.prior_stroke_tia_pct']) {
            for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i].trim();
                const nextLine = lines[i+1].trim();
                
                if (/previous\s+stroke.*(?:transient|ischemic)/i.test(line) || 
                    (/stroke/i.test(line) && /transient.*ischemic/i.test(nextLine)) ||
                    (/stroke.*systemic\s+embol/i.test(line))) {
                    const searchText = [lines[i], lines[i+1], lines[i+2] || '', lines[i+3] || ''].join(' ');
                    const match = /(\d+)\/?\d*\s*\(\s*(\d+(?:\.\d+)?)\s*\)/.exec(searchText);
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
            const ttrPatterns = [
                /inr\s+(?:values?\s+)?(?:were?\s+)?(?:within|in)\s+(?:the\s+)?therapeutic\s+range[^.]*?(\d+(?:\.\d+)?)\s*%\s+of\s+the\s+time/i,
                /inr\s+(?:values?\s+)?(?:were?\s+)?(?:within|in)\s+(?:the\s+)?therapeutic\s+range\s+(?:a\s+mean\s+of\s+)?(\d+(?:\.\d+)?)\s*%/i,
                /therapeutic\s+range[^.]*?(\d+(?:\.\d+)?)\s*%\s+of\s+the\s+time/i,
                /time.*inr.*therapeutic.*?(\d+(?:\.\d+)?)\s*%/i,
                /ttr.*?(\d+(?:\.\d+)?)\s*%/i,
                /(\d+(?:\.\d+)?)\s*%\s+of\s+the\s+time[^.]*inr/i,
                // AFFIRM format: "X percent of INR values...were within the recommended range"
                /(\d+(?:\.\d+)?)\s*percent\s+of\s+inr\s+values.*?(?:were\s+)?within\s+(?:the\s+)?(?:recommended|therapeutic)\s+range/i
            ];
            
            for (const pattern of ttrPatterns) {
                const match = text.match(pattern);
                if (match) {
                    const ttr = parseFloat(match[1]);
                    if (ttr >= 30 && ttr <= 100) {
                        results['baseline.ttr_pct'] = { mean: ttr, source: 'prose_af' };
                        break;
                    }
                }
            }
        }
        
        // PROSE EXTRACTION: Comorbidities from prose (AFFIRM format)
        // "X percent had a history of hypertension"
        if (!results['baseline.hypertension_pct']) {
            const htPatterns = [
                /(\d+(?:\.\d+)?)\s*percent\s+(?:of\s+(?:the\s+)?patients?\s+)?had\s+(?:a\s+history\s+of\s+)?hypertension/i,
                /(\d+(?:\.\d+)?)\s*percent\s+(?:of\s+(?:the\s+)?patients?\s+)?had\s+hypertension/i,
                /(\d+(?:\.\d+)?)\s*%\s+(?:of\s+(?:the\s+)?patients?\s+)?had\s+(?:a\s+)?(?:history\s+of\s+)?hypertension/i,
                /hypertension\s+(?:was\s+)?(?:present\s+)?in\s+(\d+(?:\.\d+)?)\s*(?:%|percent)/i
            ];
            for (const pattern of htPatterns) {
                const match = text.match(pattern);
                if (match) {
                    const pct = parseFloat(match[1]);
                    if (pct > 0 && pct <= 100) {
                        results['baseline.hypertension_pct'] = { pct: pct, source: 'prose_comorbidity' };
                        break;
                    }
                }
            }
        }
        
        // "X percent had coronary artery disease"
        if (!results['baseline.cad_pct']) {
            const cadPatterns = [
                /(\d+(?:\.\d+)?)\s*percent\s+(?:of\s+(?:the\s+)?patients?\s+)?had\s+coronary\s+artery\s+disease/i,
                /(\d+(?:\.\d+)?)\s*%\s+(?:of\s+(?:the\s+)?patients?\s+)?had\s+coronary\s+artery\s+disease/i,
                /coronary\s+artery\s+disease\s+(?:was\s+)?(?:present\s+)?in\s+(\d+(?:\.\d+)?)\s*(?:%|percent)/i
            ];
            for (const pattern of cadPatterns) {
                const match = text.match(pattern);
                if (match) {
                    const pct = parseFloat(match[1]);
                    if (pct > 0 && pct <= 100) {
                        results['baseline.cad_pct'] = { pct: pct, source: 'prose_comorbidity' };
                        break;
                    }
                }
            }
        }
        
        // "X percent had heart failure" / "History of congestive heart failure"
        // First, check for multiline table format: "History of congestive heart failure" + next lines
        for (let i = 0; i < lines.length - 3; i++) {
            const line = lines[i].trim().toLowerCase();
            // Look for "History of congestive heart failure" header
            if (/history\s+of\s+(?:congestive\s+)?heart\s+failure/i.test(line)) {
                // Check next few lines for "no. (%)" or values
                for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                    const valueLine = lines[j].trim();
                    // Pattern: "939 (23.1)" or "939 (23.1) 475 (23.4) 464 (22.8)"
                    const valueMatch = valueLine.match(/^(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/);
                    if (valueMatch) {
                        const n = parseInt(valueMatch[1]);
                        const pct = parseFloat(valueMatch[2]);
                        // Only accept if it looks like a reasonable baseline (n > 100, pct > 5)
                        if (n > 100 && pct > 5 && pct <= 100) {
                            results['baseline.heart_failure_pct'] = { 
                                n: n,
                                pct: pct, 
                                source: 'multiline_baseline' 
                            };
                            break;
                        }
                    }
                }
                if (results['baseline.heart_failure_pct']) break;
            }
        }
        
        if (!results['baseline.heart_failure_pct']) {
            const hfPatterns = [
                /(\d+(?:\.\d+)?)\s*percent\s+(?:of\s+(?:the\s+)?patients?\s+)?had\s+(?:a\s+)?(?:history\s+of\s+)?(?:congestive\s+)?heart\s+failure/i,
                /(\d+(?:\.\d+)?)\s*%\s+(?:of\s+(?:the\s+)?patients?\s+)?had\s+(?:a\s+)?(?:history\s+of\s+)?(?:congestive\s+)?heart\s+failure/i,
                /(?:congestive\s+)?heart\s+failure\s+(?:was\s+)?(?:present\s+)?in\s+(\d+(?:\.\d+)?)\s*(?:%|percent)/i,
                // Table format with line break: "History of congestive heart failure — no. (%)" then "939 (23.1)"
                /history\s+of\s+(?:congestive\s+)?heart\s+failure.*?(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/i
            ];
            for (const pattern of hfPatterns) {
                const match = text.match(pattern);
                if (match) {
                    // Handle both prose format (single capture) and table format (n and pct)
                    const pct = match[2] ? parseFloat(match[2]) : parseFloat(match[1]);
                    if (pct > 0 && pct <= 100) {
                        results['baseline.heart_failure_pct'] = { 
                            pct: pct, 
                            n: match[2] ? parseInt(match[1]) : undefined,
                            source: 'prose_comorbidity' 
                        };
                        break;
                    }
                }
            }
        }
        
        // Also extract CHADS2 from prose for ROCKET-AF style "CHADS2 risk...Mean score"
        if (!results['baseline.chads2_score']) {
            for (let i = 0; i < lines.length - 2; i++) {
                const line = lines[i].trim();
                if (/chads2\s*(?:score)?$/i.test(line) || /chads2\s+(?:risk|score)/i.test(line)) {
                    // Look for "Mean" or "Mean score" on next line
                    const nextLine = lines[i + 1].trim();
                    // Pattern 1: "Mean score X ± Y" or "Mean X±Y X±Y"
                    const meanMatch = nextLine.match(/^mean(?:\s+score)?\s*\(?.*?\)?\s*(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/i);
                    if (meanMatch) {
                        results['baseline.chads2_score'] = {
                            mean: parseFloat(meanMatch[1]),
                            sd: parseFloat(meanMatch[2]),
                            source: 'multiline_chads2'
                        };
                        break;
                    }
                }
            }
        }
        
        // PROSE EXTRACTION: Prior stroke/TIA from prose (e.g., "15.3% had...previous stroke or TIA")
        if (!results['baseline.prior_stroke_tia_pct']) {
            const strokeProsePatterns = [
                // "X% had a prior stroke"
                /(\d+(?:\.\d+)?)\s*%\s+(?:had\s+)?(?:a\s+)?(?:prior|previous)\s+(?:stroke|tia)/i,
                // "prior stroke or TIA (X%)"
                /(?:prior|previous)\s+stroke.*?(?:tia|transient)[^)]*?\((\d+(?:\.\d+)?)\s*%\)/i,
                // "stroke or TIA in X%"
                /stroke.*?(?:tia|transient).*?(?:in|among)\s+(\d+(?:\.\d+)?)\s*%/i,
                // "history of stroke...X%"
                /history\s+of\s+(?:stroke|tia).*?(\d+(?:\.\d+)?)\s*%/i
            ];
            
            for (const pattern of strokeProsePatterns) {
                const match = text.match(pattern);
                if (match) {
                    const pct = parseFloat(match[1]);
                    if (pct > 0 && pct < 100) {
                        results['baseline.prior_stroke_tia_pct'] = { pct: pct, source: 'prose_af' };
                        break;
                    }
                }
            }
        }
        
        // ENHANCED AF TYPE EXTRACTION: Handle "long-standing persistent" and combined categories
        // For CABANA: persistent + long-standing persistent = total persistent
        // ALWAYS check for this pattern, even if persistent_pct was already found
        let longStandingPersistent = 0;
        let foundLongStanding = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Look for "Type of atrial fibrillation" or "Type of AF" header
            if (/type\s+of\s+(?:atrial\s+)?(?:fibrillation|af)/i.test(line)) {
                let persistentInHeader = 0;
                let paroxysmalInHeader = 0;
                let foundInHeader = false;
                
                // Search next 12 lines for AF types
                for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
                    const typeLine = lines[j].trim();
                    
                    // Paroxysmal: "Paroxysmal 476 (42.9)" or "Paroxysmal 470 (42.4) 476 (43.5)"
                    const paroxMatch = typeLine.match(/^paroxysmal\s+(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/i);
                    if (paroxMatch) {
                        paroxysmalInHeader = parseFloat(paroxMatch[2]);
                        foundInHeader = true;
                    }
                    
                    // Persistent (not long-standing): "Persistent 524 (47.3)"
                    const persistMatch = typeLine.match(/^persistent\s+(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/i);
                    if (persistMatch && !/long.?standing/i.test(typeLine)) {
                        persistentInHeader = parseFloat(persistMatch[2]);
                        foundInHeader = true;
                    }
                    
                    // Long-standing persistent: "Long-standing persistent 114 (10.3)"
                    const longStandMatch = typeLine.match(/long.?standing\s+persistent\s+(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/i);
                    if (longStandMatch) {
                        longStandingPersistent = parseFloat(longStandMatch[2]);
                        foundLongStanding = true;
                        foundInHeader = true;
                    }
                }
                
                if (foundInHeader) {
                    // Set paroxysmal if not already found
                    if (!results['baseline.af_type.paroxysmal_pct'] && paroxysmalInHeader > 0) {
                        results['baseline.af_type.paroxysmal_pct'] = { pct: paroxysmalInHeader, source: 'af_type_header' };
                    }
                    
                    // Sum persistent + long-standing persistent
                    const totalPersistent = persistentInHeader + longStandingPersistent;
                    if (totalPersistent > 0) {
                        // Override if we have a better value (summed)
                        if (foundLongStanding || !results['baseline.af_type.persistent_pct']) {
                            results['baseline.af_type.persistent_pct'] = { 
                                pct: Math.round(totalPersistent * 10) / 10, 
                                source: foundLongStanding ? 'af_type_header_summed' : 'af_type_header' 
                            };
                        }
                    }
                }
                break;  // Only process first AF type header
            }
        }
        
        // Calculate persistent from 100 - paroxysmal if paroxysmal found but not persistent
        if (results['baseline.af_type.paroxysmal_pct'] && !results['baseline.af_type.persistent_pct']) {
            const paroxPct = results['baseline.af_type.paroxysmal_pct'].pct;
            if (paroxPct > 0 && paroxPct < 100) {
                // Check if permanent exists
                const permPct = results['baseline.af_type.permanent_pct']?.pct || 0;
                const calculatedPersistent = 100 - paroxPct - permPct;
                if (calculatedPersistent > 0) {
                    results['baseline.af_type.persistent_pct'] = { 
                        pct: Math.round(calculatedPersistent * 10) / 10, 
                        source: 'calculated' 
                    };
                }
            }
        }
        
        // Extract NYHA class from tables with Roman numeral labels
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Check for NYHA header
            if (/new\s+york\s+heart\s+association/i.test(line) || /^nyha\b/i.test(line)) {
                // Look at next few lines for Roman numeral class values
                for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
                    const classLine = lines[j].trim();
                    
                    // v4.2: Simpler patterns for MERIT-HF format "II 811 (41%)"
                    const class1Match = classLine.match(/^I\s+(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)/);
                    if (class1Match && !results['baseline.nyha.class1_pct']) {
                        results['baseline.nyha.class1_pct'] = { n: parseInt(class1Match[1]), pct: parseFloat(class1Match[2]), source: 'table_nyha' };
                    }
                    
                    const class2Match = classLine.match(/^II\s+(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)/);
                    if (class2Match && !results['baseline.nyha.class2_pct']) {
                        results['baseline.nyha.class2_pct'] = { n: parseInt(class2Match[1]), pct: parseFloat(class2Match[2]), source: 'table_nyha' };
                    }
                    
                    const class3Match = classLine.match(/^III\s+(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)/);
                    if (class3Match && !results['baseline.nyha.class3_pct']) {
                        results['baseline.nyha.class3_pct'] = { n: parseInt(class3Match[1]), pct: parseFloat(class3Match[2]), source: 'table_nyha' };
                    }
                    
                    const class4Match = classLine.match(/^IV\s+(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)/);
                    if (class4Match && !results['baseline.nyha.class4_pct']) {
                        results['baseline.nyha.class4_pct'] = { n: parseInt(class4Match[1]), pct: parseFloat(class4Match[2]), source: 'table_nyha' };
                    }
                }
            }
        }
        
        return results;
    },

    validate(data) {
        const issues = [];
        return issues;
    }
};

// ============================================================
// LAYER 11: HF MODULE (Full Implementation - ported from v1.5)
// ============================================================
const HFModule = {
    fields: {
        // Cardiac Function - EF
        'baseline.ef': {
            patterns: [/ejection\s+fraction/i, /^lvef\b/i, /^left\s+ventricular\s+ejection/i, /^lv\s+ejection/i, /left-ventricular\s+ejection/i],
            valuePattern: /(\d{1,2}(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [5, 75], sd: [1, 20] },
            critical: true
        },
        // v4.4: SHIFT format: "LVEF (%) 29.0% (5.1)" - % sign in value, SD in parentheses
        'baseline.ef_pct_paren': {
            patterns: [/^lvef\s*\(%\)/i, /ejection\s+fraction\s*\(%\)/i],
            valuePattern: /(\d{1,2}(?:\.\d+)?)\s*%?\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [5, 75], sd: [1, 20] },
            mapTo: 'baseline.ef'
        },
        // v4.4: CIBIS-II format: "Mean (SD) left-ventricular ejection fraction (%) 27.6 (5.5)"
        'baseline.ef_mean_sd_paren': {
            patterns: [/ejection\s+fraction/i, /left-ventricular\s+ejection/i],
            valuePattern: /\)\s*(\d{1,2}(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [5, 75], sd: [1, 20] },
            mapTo: 'baseline.ef'
        },
        'baseline.ef_median': {
            patterns: [/ejection\s+fraction/i, /^lvef\b/i],
            valuePattern: /(\d{1,2}(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'median', 2: 'iqrLo', 3: 'iqrHi' },
            mapTo: 'baseline.ef'
        },
        'baseline.ef_lt30_pct': {
            patterns: [/ejection\s+fraction.*<\s*30/i, /lvef.*<\s*30/i, /<\s*30\s*%/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.ef_30to40_pct': {
            patterns: [/ejection\s+fraction.*30.*40/i, /lvef.*30.*40/i, /30.*to.*40/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // NYHA Class Distribution
        'baseline.nyha.class1_pct': {
            patterns: [/nyha.*class\s*i(?:\s|$)/i, /^class\s*i(?:\s|$)/i, /^i\s+\d+\s*\(/],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.nyha.class2_pct': {
            patterns: [/nyha.*class\s*ii(?:\s|$)/i, /^class\s*ii(?:\s|$)/i, /^ii\s+\d+\s*\(/],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            critical: true
        },
        'baseline.nyha.class3_pct': {
            patterns: [/nyha.*class\s*iii(?:\s|$)/i, /^class\s*iii(?:\s|$)/i, /^iii\s+\d+\s*\(/],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            critical: true
        },
        'baseline.nyha.class4_pct': {
            patterns: [/nyha.*class\s*iv/i, /^class\s*iv/i, /^iv\s+\d+\s*\(/],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // Biomarkers - NT-proBNP (median with IQR)
        'baseline.ntprobnp': {
            patterns: [/nt-?pro-?bnp/i, /n-terminal\s+pro.*bnp/i],
            valuePattern: /(\d{3,5})\s*\(\s*(\d+)\s*[-–,]\s*(\d+)\s*\)/,
            captures: { 1: 'median', 2: 'iqrLo', 3: 'iqrHi' },
            critical: true
        },
        'baseline.bnp': {
            patterns: [/^bnp\b(?!.*nt)/i, /^b-type\s+natriuretic/i],
            valuePattern: /(\d{2,4})\s*\(\s*(\d+)\s*[-–,]\s*(\d+)\s*\)/,
            captures: { 1: 'median', 2: 'iqrLo', 3: 'iqrHi' }
        },
        'baseline.troponin': {
            patterns: [/troponin/i, /hs-?tnt/i, /hs-?tn/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*[-–,]\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'median', 2: 'iqrLo', 3: 'iqrHi' }
        },
        
        // Renal Function (v4.1: Added for DAPA-HF)
        'baseline.egfr': {
            patterns: [/estimated\s+(?:glomerular\s+filtration\s+rate|gfr)/i, /^egfr\b/i, /^gfr\b/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [15, 120], sd: [5, 50] }
        },
        
        // Quality of Life
        'baseline.kccq': {
            patterns: [/kccq/i, /kansas\s+city/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' }
        },
        'baseline.6mwt': {
            patterns: [/6-?min.*walk/i, /six-?min.*walk/i, /6mwt/i, /6mwd/i],
            valuePattern: /(\d{2,3}(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' },
            validation: { mean: [50, 600], sd: [20, 200] }
        },
        
        // HF History
        'baseline.prior_hf_hosp_pct': {
            patterns: [
                /prior.*hospitalization.*heart\s+failure/i, 
                /previous.*hf.*hosp/i, 
                /hospitalization.*(?:for|with).*heart\s+failure/i,
                /hospitalized.*heart\s+failure/i,
                /heart\s+failure.*hospitalization/i
            ],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            critical: true
        },
        'baseline.ischemic_etiology_pct': {
            patterns: [
                /isch(?:ae|e)mic\s+(?:etiology|cause|cardiomyopathy)/i, 
                /isch(?:ae|e)mic\s+heart\s+(?:disease|failure)/i,  // v4.2: Added "ischemic heart failure"
                /cause.*isch(?:ae|e)mic/i,
                /^isch(?:ae|e)mic$/i,                              // v4.2: Support British spelling "ischaemic"
                /heart\s+failure.*isch(?:ae|e)mic/i,              // v4.2: "Heart failure Ischaemic" format
                /^coronary\s+(?:heart|artery)\s+disease/i         // v4.4: Val-HeFT format
            ],
            valuePattern: /(?:(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)|(\d+(?:\.\d+)?)(?:\s|$))/,  // v4.4: Also plain pct
            captures: { 1: 'n', 2: 'pct', 3: 'pct' }
        },
        'baseline.hf_duration': {
            patterns: [/duration.*heart\s+failure/i, /heart\s+failure.*duration/i, /hf\s+duration/i],
            valuePattern: /(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/,
            captures: { 1: 'mean', 2: 'sd' }
        },
        
        // HF-Specific Medications
        'baseline.meds.arni_pct': {
            // v4.2: Updated to match "With neprilysin inhibitor" and "ARN inhibitor" (GALACTIC-HF format)
            patterns: [/sacubitril/i, /arni?\b/i, /^with\s+neprilysin/i, /lcz696/i, /entresto/i, /arn\s+inhibitor/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.mra_pct': {
            patterns: [
                /mineralocorticoid/i, 
                /aldosterone\s+(?:receptor\s+)?antagonist/i, 
                /^mra\b/i, 
                /spironolactone.*eplerenone/i,
                /eplerenone.*spironolactone/i,
                /antialdosterone/i  // v4.4: SHIFT format
            ],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)/,
            captures: { 1: 'n', 2: 'pct' },
            critical: true
        },
        'baseline.meds.sglt2i_pct': {
            patterns: [/sglt-?2/i, /sodium.glucose\s+co-?transport/i, /gliflozin/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.digoxin_pct': {
            patterns: [/^digoxin/i, /digitalis/i, /cardiac\s+glycoside/i],  // v4.4: Added cardiac glycosides for SHIFT
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)/,  // v4.4: Added %? for CIBIS-II format
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.ivabradine_pct': {
            patterns: [/ivabradine/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.hydralazine_pct': {
            patterns: [/hydralazine/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.meds.nitrate_pct': {
            patterns: [/nitrate/i, /isosorbide/i],
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
            // v4.2: Handle "Cardiac-resynchronization" with hyphen (GALACTIC-HF format)
            patterns: [/cardiac[\s-]+resynchronization/i, /^crt\b/i, /biventricular/i, /crt-?d/i, /crt-?p/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.device.pacemaker_pct': {
            patterns: [/pacemaker/i, /^ppm\b/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        
        // HF Type (for HFpEF/HFmrEF trials)
        'baseline.hfref_pct': {
            patterns: [/hfref/i, /reduced\s+ejection\s+fraction/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.hfpef_pct': {
            patterns: [/hfpef/i, /preserved\s+ejection\s+fraction/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        },
        'baseline.hfmref_pct': {
            patterns: [/hfmref/i, /mildly\s+reduced/i, /mid-?range/i],
            valuePattern: /(\d+)\s*\(\s*(\d+(?:\.\d+)?)\s*\)/,
            captures: { 1: 'n', 2: 'pct' }
        }
    },

    extract(rows, text) {
        const results = {};
        const lines = text.split('\n');
        
        // Table-based extraction
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
        
        // NYHA Class extraction from Roman numeral tables (v4.4: added plain pct for DIG format)
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Check for NYHA header
            if (/new\s+york\s+heart\s+association/i.test(line) || /^nyha\s+(?:functional\s+)?class/i.test(line)) {
                // Look at next few lines for Roman numeral class values
                for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                    const classLine = lines[j].trim();
                    
                    // Class I: "I 123 (5.2)" or "I 0/2523 (0.1)" or "I 13.7" (plain pct)
                    let class1Match = classLine.match(/^(?:Class\s+)?I\s+(\d+)(?:\/\d+)?\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)/i);
                    if (!class1Match) class1Match = classLine.match(/^I\s+(\d+(?:\.\d+)?)(?:\s|$)/);
                    if (class1Match && !results['baseline.nyha.class1_pct']) {
                        const pct = parseFloat(class1Match[2] || class1Match[1]);
                        const n = class1Match[2] ? parseInt(class1Match[1]) : null;
                        results['baseline.nyha.class1_pct'] = n ? { n, pct, source: 'table_nyha' } : { pct, source: 'table_nyha' };
                    }
                    
                    // Class II: "II 1600 (67.5)" or "II 1478/2523 (58.6)" or "II 53.3" (plain pct)
                    if (!/III/.test(classLine)) {
                        let class2Match = classLine.match(/^(?:Class\s+)?II\s+(\d+)(?:\/\d+)?\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)/i);
                        if (!class2Match) class2Match = classLine.match(/^II\s+(\d+(?:\.\d+)?)(?:\s|$)/);
                        if (class2Match && !results['baseline.nyha.class2_pct']) {
                            const pct = parseFloat(class2Match[2] || class2Match[1]);
                            const n = class2Match[2] ? parseInt(class2Match[1]) : null;
                            results['baseline.nyha.class2_pct'] = n ? { n, pct, source: 'table_nyha' } : { pct, source: 'table_nyha' };
                        }
                    }
                    
                    // Class III: "III 750 (31.6)" or "III 1010/2523 (40.0)" or "III 30.7" (plain pct)
                    let class3Match = classLine.match(/^(?:Class\s+)?III\s+(\d+)(?:\/\d+)?\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)/i);
                    if (!class3Match) class3Match = classLine.match(/^III\s+(\d+(?:\.\d+)?)(?:\s|$)/);
                    if (class3Match && !results['baseline.nyha.class3_pct']) {
                        const pct = parseFloat(class3Match[2] || class3Match[1]);
                        const n = class3Match[2] ? parseInt(class3Match[1]) : null;
                        results['baseline.nyha.class3_pct'] = n ? { n, pct, source: 'table_nyha' } : { pct, source: 'table_nyha' };
                    }
                    
                    // Class IV: "IV 15 (0.6)" or "IV 35/2523 (1.4)" or "IV 2.2" (plain pct)
                    let class4Match = classLine.match(/^(?:Class\s+)?IV\s+(\d+)(?:\/\d+)?\s*\(\s*(\d+(?:\.\d+)?)\s*%?\s*\)/i);
                    if (!class4Match) class4Match = classLine.match(/^IV\s+(\d+(?:\.\d+)?)(?:\s|$)/);
                    if (class4Match && !results['baseline.nyha.class4_pct']) {
                        const pct = parseFloat(class4Match[2] || class4Match[1]);
                        const n = class4Match[2] ? parseInt(class4Match[1]) : null;
                        results['baseline.nyha.class4_pct'] = n ? { n, pct, source: 'table_nyha' } : { pct, source: 'table_nyha' };
                    }
                }
            }
        }
        
        // NT-proBNP extraction from prose (various formats)
        if (!results['baseline.ntprobnp']) {
            const ntprobnpPatterns = [
                // "median NT-proBNP level was 1437 pg per milliliter (IQR, 857 to 2653)"
                /nt-?pro-?bnp.*?(\d{3,5}(?:\.\d+)?)\s*(?:pg|ng).*?\(\s*(?:iqr|interquartile)[,:\s]*(\d+(?:\.\d+)?)\s*(?:to|[-–,])\s*(\d+(?:\.\d+)?)\s*\)/i,
                // "Median NT-proBNP (IQR) — pg/ml 1816.8 (854.7–3658.5)" - v4.4 SOLOIST format
                /nt-?pro-?bnp.*?(\d{3,5}(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*[-–,]\s*(\d+(?:\.\d+)?)\s*\)/i,
                // "NT-proBNP 1437 (857-2653)" or "NT-proBNP 1437 (857, 2653)"
                /nt-?pro-?bnp[,:\s]+(\d{3,5}(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*[-–,]\s*(\d+(?:\.\d+)?)\s*\)/i,
                // Table format: "N-terminal pro-B-type... 1437 (857, 2653)" - with or without "bnp"
                /n-terminal\s+pro[^)]*?(\d{3,5}(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*[,–-]\s*(\d+(?:\.\d+)?)\s*\)/i,
                // Just "1437 (857, 2653)" on a line containing NT-proBNP context
                /(\d{3,5}(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*[,–-]\s*(\d+(?:\.\d+)?)\s*\)/i
            ];
            
            // First try specific patterns
            for (let i = 0; i < ntprobnpPatterns.length - 1; i++) {
                const match = text.match(ntprobnpPatterns[i]);
                if (match) {
                    results['baseline.ntprobnp'] = {
                        median: Math.round(parseFloat(match[1])),
                        iqrLo: Math.round(parseFloat(match[2])),
                        iqrHi: Math.round(parseFloat(match[3])),
                        source: 'prose_hf'
                    };
                    break;
                }
            }
            
            // If not found, try line-by-line for table format
            if (!results['baseline.ntprobnp']) {
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    // v4.2 fix: Be specific - must have "nt-pro" or "n-terminal" to avoid matching plain BNP
                    // PARADIGM-HF has both BNP and NT-proBNP on separate lines
                    // Also match "N-terminal pro-B-type natriuretic peptide" (full name without BNP abbrev)
                    if (/nt-?pro-?b?np|n-terminal\s+pro/i.test(line)) {
                        // Check this line and next line for values
                        for (let j = i; j <= Math.min(i + 1, lines.length - 1); j++) {
                            const valueLine = lines[j];
                            const valueMatch = valueLine.match(/(\d{3,5})\s*\(\s*(\d+)\s*[,–-]\s*(\d+)\s*\)/);
                            if (valueMatch) {
                                const median = parseInt(valueMatch[1]);
                                const iqrLo = parseInt(valueMatch[2]);
                                const iqrHi = parseInt(valueMatch[3]);
                                // Validate it looks like NT-proBNP values (median > 100, IQR makes sense)
                                if (median > 100 && iqrLo < median && median < iqrHi * 2) {
                                    results['baseline.ntprobnp'] = { median, iqrLo, iqrHi, source: 'table_hf' };
                                    break;
                                }
                            }
                        }
                        if (results['baseline.ntprobnp']) break;
                    }
                }
            }
        }
        
        // v4.3: NT-proBNP median without IQR (VICTORIA format)
        // "The median NT-proBNP level was 2816 pg per milliliter"
        if (!results['baseline.ntprobnp']) {
            const medianOnlyPatterns = [
                /(?:the\s+)?median\s+(?:nt-?pro-?bnp|n-terminal\s+pro[^)]*)\s+(?:level\s+)?was\s+(\d{3,5})\s*(?:pg|ng)/i,
                /nt-?pro-?bnp\s+(?:level\s+)?(?:was\s+)?(\d{3,5})\s*(?:pg|ng)/i
            ];
            
            for (const pattern of medianOnlyPatterns) {
                const match = text.match(pattern);
                if (match) {
                    const median = parseInt(match[1]);
                    if (median > 100 && median < 50000) {
                        results['baseline.ntprobnp'] = { median, source: 'prose_hf_median_only' };
                        break;
                    }
                }
            }
        }
        
        // v4.2: Age multiline extraction (MERIT-HF format)
        // "Age (years)" header followed by "Mean (SD) 63·9 (9·6)" value line
        if (!results['baseline.age']) {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (/^age\s*\(/i.test(line) || /^age$/i.test(line)) {
                    // Look at next few lines for Mean (SD) format
                    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                        const valueLine = lines[j].trim();
                        // Match "Mean (SD) 63·9 (9·6)" with middle dot or regular decimal
                        const meanSdMatch = valueLine.match(/^Mean\s*\(SD\)\s*(\d+[·.]\d+)\s*\(\s*(\d+[·.]\d+)\s*\)/i);
                        if (meanSdMatch) {
                            const mean = parseFloat(meanSdMatch[1].replace('·', '.'));
                            const sd = parseFloat(meanSdMatch[2].replace('·', '.'));
                            if (mean >= 18 && mean <= 100 && sd >= 1 && sd <= 30) {
                                results['baseline.age'] = { mean, sd, source: 'multiline_mean_sd' };
                                break;
                            }
                        }
                    }
                    if (results['baseline.age']) break;
                }
            }
        }
        
        // v4.3: Age extraction from prose (VICTORIA format)
        // "The mean age of the enrolled patients was 67 years"
        if (!results['baseline.age']) {
            const ageProsePatterns = [
                /(?:the\s+)?mean\s+age\s+(?:of\s+(?:the\s+)?(?:enrolled\s+)?patients\s+)?was\s+(\d+(?:\.\d+)?)\s*(?:years|yr)/i,
                /mean\s+age\s+(?:was\s+)?(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)\s*(?:years|yr)?/i,
                /patients?\s+(?:had\s+)?(?:a\s+)?mean\s+age\s+(?:of\s+)?(\d+(?:\.\d+)?)/i
            ];
            
            for (const pattern of ageProsePatterns) {
                const match = text.match(pattern);
                if (match) {
                    const mean = parseFloat(match[1]);
                    const sd = match[2] ? parseFloat(match[2]) : null;
                    if (mean >= 18 && mean <= 100) {
                        results['baseline.age'] = sd 
                            ? { mean, sd, source: 'prose_age' }
                            : { mean, source: 'prose_age' };
                        break;
                    }
                }
            }
        }
        
        // EF extraction from prose
        if (!results['baseline.ef']) {
            const efPatterns = [
                // "mean ejection fraction was 31 ± 7%"
                /(?:mean\s+)?(?:left\s+ventricular\s+)?ejection\s+fraction\s+(?:was\s+)?(\d{1,2}(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)\s*%/i,
                // "LVEF 31±7%"
                /lvef\s*(?:of\s+)?(\d{1,2}(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)\s*%/i,
                // "ejection fraction of 31% (SD 7)"
                /ejection\s+fraction\s+(?:of\s+)?(\d{1,2}(?:\.\d+)?)\s*%\s*\(\s*(?:sd|s\.d\.)\s*(\d+(?:\.\d+)?)\s*\)/i
            ];
            
            for (const pattern of efPatterns) {
                const match = text.match(pattern);
                if (match) {
                    const ef = parseFloat(match[1]);
                    const sd = parseFloat(match[2]);
                    if (ef >= 5 && ef <= 75 && sd >= 1 && sd <= 20) {
                        results['baseline.ef'] = { mean: ef, sd: sd, source: 'prose_hf' };
                        break;
                    }
                }
            }
        }
        
        // v4.2: EF multiline extraction (EMPEROR/DELIVER format)
        // "Left ventricular ejection fraction" header followed by "Mean value 27.7±6.0" or "Mean — % 54.0±8.6"
        if (!results['baseline.ef']) {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim().toLowerCase();
                if (/left\s+ventricular\s+ejection\s+fraction|^lvef\b|^ejection\s+fraction/i.test(line)) {
                    // Look at next few lines for Mean value
                    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                        const valueLine = lines[j].trim();
                        // v4.2: Match "Mean value 27.7±6.0" or "Mean 27.7±6.0" or "Mean — % 54.0±8.6"
                        const meanMatch = valueLine.match(/^mean\s*(?:value|[—–-]\s*%?)?\s*(\d{1,2}(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/i);
                        if (meanMatch) {
                            const mean = parseFloat(meanMatch[1]);
                            const sd = parseFloat(meanMatch[2]);
                            if (mean >= 5 && mean <= 75 && sd >= 1 && sd <= 20) {
                                results['baseline.ef'] = { mean, sd, source: 'multiline_hf' };
                                break;
                            }
                        }
                    }
                    if (results['baseline.ef']) break;
                }
            }
        }
        
        // v4.2: EF in decimal format for older trials (MERIT-HF: "Ejection fraction 0·28 (0·07)")
        // Convert 0.XX to XX% (multiply by 100)
        if (!results['baseline.ef']) {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                // Match "Ejection fraction 0.28 (0.07)" - decimal format with SD in parens
                const decimalMatch = line.match(/ejection\s+fraction\s+(0[·.]\d{2})\s*\(\s*(0[·.]\d{2})\s*\)/i);
                if (decimalMatch) {
                    const meanDecimal = parseFloat(decimalMatch[1].replace('·', '.'));
                    const sdDecimal = parseFloat(decimalMatch[2].replace('·', '.'));
                    const mean = Math.round(meanDecimal * 100);  // 0.28 -> 28
                    const sd = Math.round(sdDecimal * 100);      // 0.07 -> 7
                    if (mean >= 5 && mean <= 75 && sd >= 1 && sd <= 20) {
                        results['baseline.ef'] = { mean, sd, source: 'decimal_hf' };
                        break;
                    }
                }
            }
        }
        
        // v4.1: eGFR extraction from multiline table (DAPA-HF format)
        // "Estimated GFR" header followed by "Mean — ml/min/1.73 m2 66.0±19.6"
        if (!results['baseline.egfr']) {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim().toLowerCase();
                if (/estimated\s+(?:glomerular\s+filtration|gfr)|^gfr\b|^egfr\b/i.test(line)) {
                    // Look at next few lines for Mean value
                    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                        const valueLine = lines[j].trim();
                        // Match "Mean — ml/min/1.73 m2 66.0±19.6" or "Mean 66.0±19.6"
                        const meanMatch = valueLine.match(/^mean.*?(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/i);
                        if (meanMatch) {
                            const mean = parseFloat(meanMatch[1]);
                            const sd = parseFloat(meanMatch[2]);
                            if (mean >= 15 && mean <= 120 && sd >= 5 && sd <= 50) {
                                results['baseline.egfr'] = { mean, sd, source: 'multiline_hf' };
                                break;
                            }
                        }
                    }
                    if (results['baseline.egfr']) break;
                }
            }
        }
        
        // Prior HF hospitalization from prose
        if (!results['baseline.prior_hf_hosp_pct']) {
            const hfHospPatterns = [
                // "X% had been hospitalized for heart failure"
                /(\d+(?:\.\d+)?)\s*%\s+(?:had\s+been\s+)?hospitalized.*heart\s+failure/i,
                // "hospitalization for heart failure in X%"
                /hospitalization.*heart\s+failure.*?(\d+(?:\.\d+)?)\s*%/i,
                // "prior heart failure hospitalization (X%)"
                /prior.*heart\s+failure.*hospitalization.*?(\d+(?:\.\d+)?)\s*%/i
            ];
            
            for (const pattern of hfHospPatterns) {
                const match = text.match(pattern);
                if (match) {
                    const pct = parseFloat(match[1]);
                    if (pct > 0 && pct <= 100) {
                        results['baseline.prior_hf_hosp_pct'] = { pct: pct, source: 'prose_hf' };
                        break;
                    }
                }
            }
        }
        
        // KCCQ from prose
        if (!results['baseline.kccq']) {
            const kccqPatterns = [
                /kccq.*?(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/i,
                /kansas\s+city.*?(\d+(?:\.\d+)?)\s*[±+]\s*(\d+(?:\.\d+)?)/i
            ];
            
            for (const pattern of kccqPatterns) {
                const match = text.match(pattern);
                if (match) {
                    results['baseline.kccq'] = { mean: parseFloat(match[1]), sd: parseFloat(match[2]), source: 'prose_hf' };
                    break;
                }
            }
        }
        
        // v4.3: ARNI from prose (VICTORIA format)
        // "15% received an angiotensin-neprilysin inhibitor"
        if (!results['baseline.meds.arni_pct']) {
            const arniProsePatterns = [
                /([\d.]+)\s*%\s+(?:of\s+(?:the\s+)?patients\s+)?received\s+(?:an?\s+)?(?:angiotensin[–-]?neprilysin\s+inhibitor|arni|sacubitril)/i,
                /(?:angiotensin[–-]?neprilysin\s+inhibitor|arni|sacubitril).*?([\d.]+)\s*%/i,
                /([\d.]+)\s*%.*(?:were|was)\s+(?:on|receiving|taking)\s+(?:an?\s+)?(?:arni|sacubitril)/i
            ];
            
            for (const pattern of arniProsePatterns) {
                const match = text.match(pattern);
                if (match) {
                    const pct = parseFloat(match[1]);
                    if (pct > 0 && pct <= 100) {
                        results['baseline.meds.arni_pct'] = { pct, source: 'prose_hf' };
                        break;
                    }
                }
            }
        }
        
        // v4.3: ICD/CRT from prose (VICTORIA format)
        // "32% of the patients had an implantable cardioverter-defibrillator"
        if (!results['baseline.device.icd_pct']) {
            // First normalize text to handle line breaks
            const textJoined = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');
            const icdProsePatterns = [
                // Handle "cardioverter- defibrillator" with optional space after hyphen
                /([\d.]+)\s*%\s+(?:of\s+(?:the\s+)?patients\s+)?had\s+(?:an?\s+)?(?:implantable\s+)?cardioverter[–-]?\s*defibrillator/i,
                /([\d.]+)\s*%\s+(?:of\s+(?:the\s+)?patients\s+)?had\s+(?:an?\s+)?icd/i,
                /(?:implantable\s+)?(?:cardioverter[–-]?\s*defibrillator|icd).*?([\d.]+)\s*%/i,
                /([\d.]+)\s*%.*(?:had|with)\s+(?:an?\s+)?(?:icd|defibrillator)/i
            ];
            
            for (const pattern of icdProsePatterns) {
                const match = textJoined.match(pattern);
                if (match) {
                    const pct = parseFloat(match[1]);
                    if (pct > 0 && pct <= 100) {
                        results['baseline.device.icd_pct'] = { pct, source: 'prose_hf' };
                        break;
                    }
                }
            }
        }
        
        return results;
    },

    validate(data) {
        const issues = [];
        
        // Validate EF is in expected range for HF trials
        if (data['baseline.ef']) {
            const ef = data['baseline.ef'].mean || data['baseline.ef'].median;
            if (ef && ef > 65) {
                issues.push({ field: 'baseline.ef', issue: 'EF unusually high for HF trial', value: ef });
            }
        }
        
        // Validate NYHA percentages sum to ~100
        const nyhaSum = (data['baseline.nyha.class1_pct']?.pct || 0) +
                        (data['baseline.nyha.class2_pct']?.pct || 0) +
                        (data['baseline.nyha.class3_pct']?.pct || 0) +
                        (data['baseline.nyha.class4_pct']?.pct || 0);
        if (nyhaSum > 0 && (nyhaSum < 95 || nyhaSum > 105)) {
            issues.push({ field: 'baseline.nyha', issue: 'NYHA percentages do not sum to 100%', value: nyhaSum });
        }
        
        // Validate NT-proBNP IQR makes sense
        if (data['baseline.ntprobnp']) {
            const { median, iqrLo, iqrHi } = data['baseline.ntprobnp'];
            if (median && iqrLo && iqrHi) {
                if (iqrLo > median || iqrHi < median) {
                    issues.push({ field: 'baseline.ntprobnp', issue: 'IQR does not contain median', value: data['baseline.ntprobnp'] });
                }
            }
        }
        
        return issues;
    }
};

// ============================================================
// LAYER 12: ACS MODULE (placeholder)
// ============================================================
const ACSModule = {
    fields: {},
    extract(rows, text) { return {}; },
    validate(data) { return []; }
};

// ============================================================
// MAIN ORCHESTRATOR: RCTExtractor v3.3
// ============================================================
const RCTExtractor = {
    version: '4.2.0',
    
    domains: {
        HF: HFModule,
        ACS: ACSModule,
        AF: AFModule
    },

    extract(text) {
        const startTime = Date.now();
        
        // Step 1: Normalize text
        const normalizedText = TextNormalizer.normalize(text);
        const lines = normalizedText.split('\n');
        
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
        
        // Step 5b: If no arm Ns found, try extracting from prose (for ablation trials)
        if (!armResults['arm.treatment.n'] || !armResults['arm.control.n']) {
            const proseArms = TableDetector.extractArmNsFromProse(normalizedText);
            armResults = { ...armResults, ...proseArms };
        }
        
        // Step 5c: Extract median values from multiline patterns
        const medianResults = TableDetector.extractMediansFromLines(lines);
        
        // Step 6: Extract core fields (shared across all domains)
        const coreResults = CoreExtractor.extract(allRows, normalizedText);
        
        // Merge median results with core results (prefer median if not already found)
        Object.entries(medianResults).forEach(([key, value]) => {
            if (!coreResults[key]) {
                coreResults[key] = value;
            }
        });
        
        // Step 7: Extract domain-specific fields
        let domainResults = {};
        const domainModule = this.domains[domain.primary];
        if (domainModule) {
            domainResults = domainModule.extract(allRows, normalizedText);
        }
        
        // Step 8: Extract outcomes
        const outcomeResults = OutcomesExtractor.extract(normalizedText);
        
        // Step 9: Extract safety
        const safetyResults = SafetyExtractor.extract(normalizedText);
        
        // Step 10: Extract prose (study metadata)
        const proseResults = ProseExtractor.extract(normalizedText);
        
        // Step 11: Calculate NNT
        const nntResults = NNTCalculator.calculate({ ...outcomeResults });
        
        // Step 12: Validate
        let validationIssues = [];
        if (domainModule && domainModule.validate) {
            validationIssues = domainModule.validate({ ...coreResults, ...domainResults });
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
                countries: proseResults['study.countries'],
                ttr_pct: proseResults['study.ttr_pct']
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
                
                if (key === '_meta') return;
                
                if (value === null || value === undefined) return;
                
                if (typeof value === 'object' && !Array.isArray(value)) {
                    if ('mean' in value || 'median' in value || 'pct' in value || 
                        'n' in value || 'effect' in value || 'value' in value) {
                        
                        if (value.mean !== undefined) flat[`${fullKey}.mean`] = value.mean;
                        if (value.median !== undefined) flat[`${fullKey}.median`] = value.median;
                        if (value.sd !== undefined) flat[`${fullKey}.sd`] = value.sd;
                        if (value.iqrLo !== undefined) flat[`${fullKey}.iqrLo`] = value.iqrLo;
                        if (value.iqrHi !== undefined) flat[`${fullKey}.iqrHi`] = value.iqrHi;
                        
                        if (value.pct !== undefined) {
                            const pctKey = fullKey.endsWith('_pct') ? fullKey : `${fullKey}_pct`;
                            flat[pctKey] = value.pct;
                        }
                        if (value.n !== undefined) flat[`${fullKey}.n`] = value.n;
                        
                        if (value.effect !== undefined) flat[`${fullKey}.effect`] = value.effect;
                        if (value.ciLo !== undefined) flat[`${fullKey}.ciLo`] = value.ciLo;
                        if (value.ciHi !== undefined) flat[`${fullKey}.ciHi`] = value.ciHi;
                        if (value.drug !== undefined) flat[`${fullKey}.drug`] = value.drug;
                        
                    } else if (value.treatment || value.control) {
                        if (value.treatment) {
                            if (value.treatment.n !== undefined) flat[`${fullKey}.treatment.n`] = value.treatment.n;
                            if (value.treatment.drug !== undefined) flat[`${fullKey}.treatment.drug`] = value.treatment.drug;
                        }
                        if (value.control) {
                            if (value.control.n !== undefined) flat[`${fullKey}.control.n`] = value.control.n;
                            if (value.control.drug !== undefined) flat[`${fullKey}.control.drug`] = value.control.drug;
                        }
                    } else {
                        walk(value, fullKey);
                    }
                } else if (typeof value !== 'object') {
                    flat[fullKey] = value;
                }
            });
        };
        
        walk(result);
        
        // Also add TTR from study if present
        if (result.study?.ttr_pct && !flat['baseline.ttr_pct']) {
            flat['baseline.ttr_pct'] = result.study.ttr_pct;
        }
        
        return flat;
    },

    getSummary(result) {
        const flat = this.flatten(result);
        return {
            acronym: result.study?.acronym || 'Unknown',
            domain: result._meta?.domain,
            treatmentN: flat['arm.treatment.n'],
            controlN: flat['arm.control.n'],
            primaryHR: flat['contrast.effect'],
            fieldCount: Object.keys(flat).length
        };
    }
};

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RCTExtractor, DomainDetector, TextNormalizer };
}
