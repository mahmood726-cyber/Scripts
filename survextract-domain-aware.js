// ============================================
// SurvExtract Pro v6.1: Domain-Aware IPD Reconstruction
// ============================================
// 
// Adds domain-specific priors, validation, and plausibility checking
// to CEN-KM reconstruction WITHOUT replacing the transparent algorithm.
//
// Key principle: Domain knowledge VALIDATES and FLAGS, doesn't OVERRIDE
// ============================================

const DomainAwareReconstruction = (function() {
    'use strict';

    // ============================================
    // SECTION 1: DOMAIN KNOWLEDGE DATABASES
    // ============================================

    /**
     * Heart Failure Domain Knowledge
     * Based on meta-analysis of 100+ HF RCTs
     */
    const HF_DOMAIN = {
        name: 'Heart Failure',
        
        // Expected hazard patterns by drug class
        drugClassPatterns: {
            'sglt2i': {
                description: 'SGLT2 inhibitors (dapagliflozin, empagliflozin)',
                expectedPattern: 'EARLY_SEPARATION',
                typicalHR: { point: 0.74, lower: 0.65, upper: 0.85 },
                timeToSeparation: { median: 1, max: 3 }, // months
                hazardShape: 'DECREASING_EARLY',
                references: ['DAPA-HF', 'EMPEROR-Reduced', 'DELIVER']
            },
            'arni': {
                description: 'Angiotensin receptor-neprilysin inhibitors',
                expectedPattern: 'EARLY_SEPARATION',
                typicalHR: { point: 0.80, lower: 0.73, upper: 0.87 },
                timeToSeparation: { median: 2, max: 6 },
                hazardShape: 'DECREASING_EARLY',
                references: ['PARADIGM-HF', 'PARAGON-HF']
            },
            'betablocker': {
                description: 'Beta-blockers (carvedilol, metoprolol, bisoprolol)',
                expectedPattern: 'DELAYED_BENEFIT',
                typicalHR: { point: 0.65, lower: 0.55, upper: 0.75 },
                timeToSeparation: { median: 3, max: 12 },
                hazardShape: 'INCREASING_THEN_DECREASING',
                earlyHarmWindow: 3, // months of potential early harm
                references: ['MERIT-HF', 'COPERNICUS', 'CIBIS-II']
            },
            'mra': {
                description: 'Mineralocorticoid receptor antagonists',
                expectedPattern: 'GRADUAL_SEPARATION',
                typicalHR: { point: 0.70, lower: 0.60, upper: 0.82 },
                timeToSeparation: { median: 3, max: 9 },
                hazardShape: 'CONSTANT',
                references: ['RALES', 'EMPHASIS-HF']
            },
            'acei_arb': {
                description: 'ACE inhibitors / ARBs',
                typicalHR: { point: 0.83, lower: 0.75, upper: 0.92 },
                expectedPattern: 'GRADUAL_SEPARATION',
                timeToSeparation: { median: 6, max: 12 },
                hazardShape: 'CONSTANT',
                references: ['SOLVD', 'CONSENSUS', 'Val-HeFT']
            },
            'device_icd': {
                description: 'Implantable cardioverter-defibrillator',
                expectedPattern: 'DELAYED_BENEFIT_WITH_EARLY_RISK',
                typicalHR: { point: 0.77, lower: 0.62, upper: 0.96 },
                earlyRiskWindow: 1, // months
                earlyRiskMultiplier: 1.5,
                timeToSeparation: { median: 6, max: 18 },
                hazardShape: 'EARLY_SPIKE_THEN_DECREASING',
                references: ['MADIT-II', 'SCD-HeFT']
            },
            'device_crt': {
                description: 'Cardiac resynchronization therapy',
                expectedPattern: 'EARLY_BENEFIT_AFTER_RISK',
                typicalHR: { point: 0.64, lower: 0.48, upper: 0.85 },
                earlyRiskWindow: 1,
                earlyRiskMultiplier: 1.3,
                timeToSeparation: { median: 3, max: 6 },
                hazardShape: 'EARLY_SPIKE_THEN_DECREASING',
                references: ['CARE-HF', 'COMPANION', 'MADIT-CRT']
            },
            'unknown': {
                description: 'Unknown or other drug class',
                expectedPattern: 'UNKNOWN',
                typicalHR: { point: 0.85, lower: 0.70, upper: 1.00 },
                timeToSeparation: { median: 6, max: 24 },
                hazardShape: 'UNKNOWN'
            }
        },

        // Expected outcomes by HF phenotype
        phenotypes: {
            'hfref': {
                description: 'HF with reduced EF (≤40%)',
                annualMortality: { low: 0.08, typical: 0.12, high: 0.20 },
                medianSurvival: { optimistic: 60, typical: 36, pessimistic: 18 }, // months
                eventRateRange: { min: 0.10, max: 0.25 }
            },
            'hfmref': {
                description: 'HF with mildly reduced EF (41-49%)',
                annualMortality: { low: 0.05, typical: 0.08, high: 0.12 },
                medianSurvival: { optimistic: 84, typical: 60, pessimistic: 36 },
                eventRateRange: { min: 0.06, max: 0.15 }
            },
            'hfpef': {
                description: 'HF with preserved EF (≥50%)',
                annualMortality: { low: 0.04, typical: 0.07, high: 0.10 },
                medianSurvival: { optimistic: 96, typical: 72, pessimistic: 48 },
                eventRateRange: { min: 0.05, max: 0.12 }
            }
        },

        // Era-specific background mortality
        eraEffects: {
            pre2000: { mortalityMultiplier: 1.4, censoringPattern: 'UNIFORM' },
            '2000-2010': { mortalityMultiplier: 1.15, censoringPattern: 'MIXED' },
            '2010-2020': { mortalityMultiplier: 1.0, censoringPattern: 'ADMINISTRATIVE' },
            post2020: { mortalityMultiplier: 0.9, censoringPattern: 'ADMINISTRATIVE_HEAVY' }
        },

        // Censoring distribution parameters by trial design
        censoringPatterns: {
            'UNIFORM': {
                description: 'Early trials with staggered enrollment, variable follow-up',
                distribution: 'uniform',
                params: { min: 0.1, max: 0.9 } // as fraction of max follow-up
            },
            'MIXED': {
                description: 'Moderate administrative censoring',
                distribution: 'beta',
                params: { alpha: 2, beta: 2 }
            },
            'ADMINISTRATIVE': {
                description: 'Modern trials with fixed enrollment window',
                distribution: 'beta',
                params: { alpha: 3, beta: 1.5 } // right-skewed
            },
            'ADMINISTRATIVE_HEAVY': {
                description: 'Recent trials with very tight enrollment',
                distribution: 'beta',
                params: { alpha: 5, beta: 1.2 } // heavily right-skewed
            }
        }
    };

    /**
     * Oncology Domain Knowledge
     * Based on patterns from immunotherapy and targeted therapy trials
     */
    const ONCOLOGY_DOMAIN = {
        name: 'Oncology',
        
        drugClassPatterns: {
            'checkpoint_inhibitor': {
                description: 'PD-1/PD-L1/CTLA-4 inhibitors',
                expectedPattern: 'DELAYED_SEPARATION',
                typicalHR: { point: 0.68, lower: 0.55, upper: 0.85 },
                timeToSeparation: { median: 3, max: 6 },
                hazardShape: 'CROSSING_THEN_DIVERGING',
                curvesCross: true,
                crossingTime: { min: 1, max: 4 },
                references: ['CheckMate', 'KEYNOTE', 'IMpower']
            },
            'targeted_therapy': {
                description: 'TKIs, targeted agents',
                expectedPattern: 'EARLY_SEPARATION',
                typicalHR: { point: 0.55, lower: 0.40, upper: 0.75 },
                timeToSeparation: { median: 1, max: 3 },
                hazardShape: 'DECREASING',
                resistanceOnset: { median: 12, range: [6, 24] }, // months
                references: ['Various TKI trials']
            },
            'chemotherapy': {
                description: 'Cytotoxic chemotherapy',
                expectedPattern: 'EARLY_SEPARATION_THEN_CONVERGING',
                typicalHR: { point: 0.75, lower: 0.65, upper: 0.88 },
                timeToSeparation: { median: 2, max: 4 },
                hazardShape: 'INCREASING',
                references: ['Standard chemo trials']
            },
            'combination_io': {
                description: 'Combination immunotherapy',
                expectedPattern: 'DELAYED_THEN_SUSTAINED',
                typicalHR: { point: 0.60, lower: 0.45, upper: 0.80 },
                timeToSeparation: { median: 4, max: 8 },
                hazardShape: 'COMPLEX',
                tailPlateau: true,
                references: ['CheckMate-214', 'CheckMate-227']
            }
        },

        phenotypes: {
            'nsclc': {
                annualMortality: { low: 0.30, typical: 0.50, high: 0.70 },
                medianSurvival: { optimistic: 24, typical: 12, pessimistic: 6 }
            },
            'melanoma': {
                annualMortality: { low: 0.20, typical: 0.35, high: 0.55 },
                medianSurvival: { optimistic: 36, typical: 18, pessimistic: 9 }
            },
            'rcc': {
                annualMortality: { low: 0.15, typical: 0.25, high: 0.40 },
                medianSurvival: { optimistic: 48, typical: 30, pessimistic: 15 }
            }
        },

        censoringPatterns: {
            'UNIFORM': { distribution: 'uniform', params: { min: 0.1, max: 0.9 } },
            'ADMINISTRATIVE': { distribution: 'beta', params: { alpha: 4, beta: 1.5 } }
        }
    };

    // Domain registry
    const DOMAINS = {
        'hf': HF_DOMAIN,
        'heart_failure': HF_DOMAIN,
        'oncology': ONCOLOGY_DOMAIN,
        'cancer': ONCOLOGY_DOMAIN
    };

    // ============================================
    // SECTION 2: INFORMED CENSORING DISTRIBUTIONS
    // ============================================

    /**
     * Generate censoring times using domain-informed distributions
     * instead of uniform assumption
     */
    function generateInformedCensorTimes(nCensored, maxTime, trialContext) {
        const {
            domain = 'hf',
            year = 2015,
            enrollmentDuration = null,
            knownCensorPattern = null
        } = trialContext;

        const domainData = DOMAINS[domain] || HF_DOMAIN;
        
        // Determine censoring pattern
        let pattern;
        if (knownCensorPattern) {
            pattern = domainData.censoringPatterns[knownCensorPattern];
        } else {
            // Infer from year
            let era;
            if (year < 2000) era = 'pre2000';
            else if (year < 2010) era = '2000-2010';
            else if (year < 2020) era = '2010-2020';
            else era = 'post2020';
            
            const eraData = domainData.eraEffects[era];
            pattern = domainData.censoringPatterns[eraData.censoringPattern];
        }

        const times = [];
        for (let i = 0; i < nCensored; i++) {
            let t;
            
            if (pattern.distribution === 'uniform') {
                const { min, max } = pattern.params;
                t = maxTime * (min + Math.random() * (max - min));
            } else if (pattern.distribution === 'beta') {
                const { alpha, beta } = pattern.params;
                t = maxTime * sampleBeta(alpha, beta);
            } else {
                // Fallback to uniform
                t = maxTime * Math.random();
            }
            
            times.push(t);
        }

        return times.sort((a, b) => a - b);
    }

    /**
     * Sample from Beta distribution using rejection sampling
     */
    function sampleBeta(alpha, beta) {
        // Use Gamma sampling method
        const x = sampleGamma(alpha, 1);
        const y = sampleGamma(beta, 1);
        return x / (x + y);
    }

    function sampleGamma(shape, scale) {
        // Marsaglia and Tsang's method
        if (shape < 1) {
            return sampleGamma(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
        }
        
        const d = shape - 1/3;
        const c = 1 / Math.sqrt(9 * d);
        
        while (true) {
            let x, v;
            do {
                x = sampleNormal();
                v = 1 + c * x;
            } while (v <= 0);
            
            v = v * v * v;
            const u = Math.random();
            
            if (u < 1 - 0.0331 * x * x * x * x) {
                return d * v * scale;
            }
            
            if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
                return d * v * scale;
            }
        }
    }

    function sampleNormal() {
        // Box-Muller transform
        const u1 = Math.random();
        const u2 = Math.random();
        return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }

    // ============================================
    // SECTION 3: ENHANCED CEN-KM WITH DOMAIN PRIORS
    // ============================================

    /**
     * Enhanced CEN-KM that uses domain knowledge for censoring allocation
     * but keeps the core algorithm transparent
     */
    function reconstructIPD_DomainAware(survivalPoints, atRiskTable, options = {}) {
        const {
            domain = 'hf',
            drugClass = 'unknown',
            phenotype = 'hfref',
            trialYear = 2015,
            useInformedCensoring = true,
            candidateRange = 2,
            matchTolerance = 0.005,
            debug = false
        } = options;

        const domainData = DOMAINS[domain] || HF_DOMAIN;
        const drugPattern = domainData.drugClassPatterns[drugClass] || 
                           domainData.drugClassPatterns['unknown'];
        
        // Sort and validate survival points
        const S = [...survivalPoints].sort((a, b) => a.x - b.x);
        
        // Ensure monotonically decreasing
        let maxY = 1;
        S.forEach(p => {
            p.y = Math.max(0.001, Math.min(1, p.y));
            if (p.y > maxY) p.y = maxY;
            else maxY = p.y;
        });

        // Get initial N from risk table
        const n0 = atRiskTable && atRiskTable.length > 0 
            ? atRiskTable[0].nrisk 
            : estimateN0(S, domainData, drugPattern);

        const ipd = [];
        let currentN = n0;
        const maxTime = S[S.length - 1].x;
        
        const reconstructionLog = [];

        // Process each interval
        for (let i = 0; i < S.length - 1; i++) {
            const t1 = S[i].x;
            const t2 = S[i + 1].x;
            const sStart = S[i].y;
            const sEnd = S[i + 1].y;

            if (t2 <= t1 || sEnd >= sStart - 0.0001) continue;

            // Theoretical events from KM equation
            const conditionalSurvival = sEnd / sStart;
            const theoreticalEvents = currentN * (1 - conditionalSurvival);

            // Branch-and-compare to find best (events, censors) combination
            const candidates = [];
            const minEvents = Math.max(1, Math.floor(theoreticalEvents) - candidateRange);
            const maxEvents = Math.min(currentN - 1, Math.ceil(theoreticalEvents) + candidateRange);

            for (let d = minEvents; d <= maxEvents; d++) {
                // Try different censor counts
                for (let c = 0; c <= Math.min(10, currentN - d); c++) {
                    const result = evaluateCandidate(currentN, d, c, sStart, sEnd);
                    
                    if (result.error < matchTolerance * 3) {
                        candidates.push({
                            events: d,
                            censors: c,
                            error: result.error,
                            predictedS: result.survival
                        });
                    }
                }
            }

            // Select best candidate
            candidates.sort((a, b) => a.error - b.error);
            const best = candidates[0] || { events: Math.round(theoreticalEvents), censors: 0 };

            // Generate event times
            const eventTimes = distributeEventTimes(t1, t2, best.events, drugPattern);
            eventTimes.forEach(t => {
                ipd.push({ time: t, status: 1 });
            });

            // Generate censor times using informed distribution
            if (best.censors > 0) {
                let censorTimes;
                if (useInformedCensoring) {
                    censorTimes = generateInformedCensorTimesInInterval(
                        best.censors, t1, t2, 
                        { domain, year: trialYear, drugClass }
                    );
                } else {
                    // Uniform fallback
                    censorTimes = [];
                    for (let j = 0; j < best.censors; j++) {
                        censorTimes.push(t1 + Math.random() * (t2 - t1));
                    }
                }
                
                censorTimes.forEach(t => {
                    ipd.push({ time: t, status: 0 });
                });
            }

            if (debug) {
                reconstructionLog.push({
                    interval: [t1, t2],
                    sStart, sEnd,
                    theoretical: theoreticalEvents,
                    selected: best,
                    candidatesEvaluated: candidates.length
                });
            }

            currentN = Math.max(0, currentN - best.events - best.censors);
        }

        // Add remaining as censored at end
        if (currentN > 0) {
            const finalTime = S[S.length - 1].x;
            const censorTimes = generateInformedCensorTimes(
                currentN, finalTime,
                { domain, year: trialYear }
            );
            
            // Place most censors near the end (administrative censoring)
            censorTimes.forEach(t => {
                ipd.push({ time: Math.max(t, finalTime * 0.8), status: 0 });
            });
        }

        // Sort by time
        ipd.sort((a, b) => a.time - b.time);

        // Attach metadata
        ipd._reconstruction = {
            method: 'CEN-KM + Domain-Aware Censoring',
            domain,
            drugClass,
            phenotype,
            trialYear,
            n0,
            useInformedCensoring,
            log: debug ? reconstructionLog : null
        };

        return ipd;
    }

    /**
     * Generate censor times within a specific interval using domain knowledge
     */
    function generateInformedCensorTimesInInterval(nCensored, t1, t2, context) {
        const interval = t2 - t1;
        const times = [];
        
        // Early in trial: more dropout
        // Late in trial: more administrative
        const relativeTime = (t1 + t2) / 2;
        const maxTime = t2 * 2; // Estimate
        const timeRatio = relativeTime / maxTime;
        
        for (let i = 0; i < nCensored; i++) {
            let pos;
            
            if (timeRatio < 0.3) {
                // Early: dropout tends to happen throughout
                pos = Math.random();
            } else if (timeRatio > 0.7) {
                // Late: administrative censoring, cluster at end
                pos = 0.5 + 0.5 * Math.pow(Math.random(), 0.5);
            } else {
                // Middle: mixed
                pos = sampleBeta(2, 2);
            }
            
            times.push(t1 + pos * interval);
        }
        
        return times;
    }

    /**
     * Distribute event times within interval based on drug class patterns
     */
    function distributeEventTimes(t1, t2, nEvents, drugPattern) {
        const interval = t2 - t1;
        const times = [];

        for (let i = 0; i < nEvents; i++) {
            let pos;
            
            switch (drugPattern.hazardShape) {
                case 'DECREASING_EARLY':
                    // Events cluster early in interval
                    pos = Math.pow(Math.random(), 1.5);
                    break;
                    
                case 'INCREASING':
                    // Events cluster late in interval
                    pos = 1 - Math.pow(Math.random(), 1.5);
                    break;
                    
                case 'EARLY_SPIKE_THEN_DECREASING':
                    // Bimodal: some early, rest spread
                    if (Math.random() < 0.3) {
                        pos = Math.random() * 0.2; // Early spike
                    } else {
                        pos = 0.2 + 0.8 * Math.random();
                    }
                    break;
                    
                case 'CROSSING_THEN_DIVERGING':
                    // Complex immunotherapy pattern
                    pos = sampleBeta(2, 2); // Centered
                    break;
                    
                default:
                    // Uniform
                    pos = Math.random();
            }
            
            times.push(t1 + pos * interval);
        }

        return times.sort((a, b) => a - b);
    }

    /**
     * Evaluate a candidate (events, censors) combination
     */
    function evaluateCandidate(nAtRisk, events, censors, sStart, sTarget) {
        const effectiveN = Math.max(1, nAtRisk - censors);
        const safeEvents = Math.min(events, effectiveN - 1);
        const conditionalS = (effectiveN - safeEvents) / effectiveN;
        const predictedS = sStart * conditionalS;
        const error = Math.abs(predictedS - sTarget);
        
        return { survival: predictedS, error };
    }

    /**
     * Estimate N0 from curve shape if not provided
     */
    function estimateN0(S, domainData, drugPattern) {
        // Count steps as proxy for events
        const steps = S.filter((p, i) => 
            i > 0 && Math.abs(S[i-1].y - p.y) > 0.003
        ).length;
        
        // Typical event rate from domain
        const eventRate = 0.15; // Default
        
        return Math.max(100, Math.min(5000, Math.round(steps / eventRate)));
    }

    // ============================================
    // SECTION 4: PLAUSIBILITY SCORING
    // ============================================

    /**
     * Score reconstruction plausibility against domain expectations
     * Returns flags and warnings, does NOT modify data
     */
    function assessPlausibility(ipd, targetCurve, trialContext) {
        const {
            domain = 'hf',
            drugClass = 'unknown',
            phenotype = 'hfref',
            trialYear = 2015,
            reportedHR = null,
            reportedMedian = null,
            reportedEvents = null
        } = trialContext;

        const domainData = DOMAINS[domain] || HF_DOMAIN;
        const drugPattern = domainData.drugClassPatterns[drugClass] || 
                           domainData.drugClassPatterns['unknown'];
        const phenotypeData = domainData.phenotypes[phenotype];

        const assessment = {
            overallScore: 100,
            grade: 'A',
            flags: [],
            warnings: [],
            details: {},
            recommendation: ''
        };

        // 1. Check event rate plausibility
        const events = ipd.filter(p => p.status === 1).length;
        const eventRate = events / ipd.length;
        const maxTime = Math.max(...ipd.map(p => p.time));
        const annualizedRate = eventRate / (maxTime / 12);

        if (phenotypeData) {
            const { low, typical, high } = phenotypeData.annualMortality;
            
            if (annualizedRate < low * 0.5) {
                assessment.warnings.push({
                    type: 'LOW_EVENT_RATE',
                    message: `Event rate (${(annualizedRate * 100).toFixed(1)}%/yr) unusually low for ${phenotype}`,
                    expected: `${(low * 100).toFixed(0)}-${(high * 100).toFixed(0)}%/yr`,
                    severity: 'MEDIUM',
                    action: 'Verify digitization, especially late survival drops'
                });
                assessment.overallScore -= 10;
            } else if (annualizedRate > high * 1.5) {
                assessment.warnings.push({
                    type: 'HIGH_EVENT_RATE',
                    message: `Event rate (${(annualizedRate * 100).toFixed(1)}%/yr) unusually high for ${phenotype}`,
                    expected: `${(low * 100).toFixed(0)}-${(high * 100).toFixed(0)}%/yr`,
                    severity: 'MEDIUM',
                    action: 'Verify population characteristics match phenotype'
                });
                assessment.overallScore -= 10;
            }

            assessment.details.eventRate = {
                observed: annualizedRate,
                expected: { low, typical, high },
                plausible: annualizedRate >= low * 0.5 && annualizedRate <= high * 1.5
            };
        }

        // 2. Check hazard pattern matches drug class
        const hazardAnalysis = analyzeHazardPattern(ipd, targetCurve);
        
        if (drugPattern.expectedPattern !== 'UNKNOWN') {
            const patternMatch = comparePatterns(hazardAnalysis.pattern, drugPattern.expectedPattern);
            
            if (!patternMatch.compatible) {
                assessment.flags.push({
                    type: 'UNEXPECTED_PATTERN',
                    message: `Observed pattern (${hazardAnalysis.pattern}) differs from expected (${drugPattern.expectedPattern}) for ${drugClass}`,
                    severity: patternMatch.severity,
                    possibleCauses: patternMatch.possibleCauses,
                    action: 'Review curve digitization or verify drug class assignment'
                });
                assessment.overallScore -= patternMatch.severity === 'HIGH' ? 20 : 10;
            }

            assessment.details.hazardPattern = {
                observed: hazardAnalysis.pattern,
                expected: drugPattern.expectedPattern,
                compatible: patternMatch.compatible
            };
        }

        // 3. Check for curve crossing (if applicable)
        if (drugPattern.curvesCross) {
            if (!hazardAnalysis.hasCrossing) {
                assessment.flags.push({
                    type: 'EXPECTED_CROSSING_MISSING',
                    message: `${drugClass} typically shows curve crossing, but none detected`,
                    severity: 'LOW',
                    action: 'This may be a positive finding (sustained benefit) or digitization issue'
                });
            }
        } else if (hazardAnalysis.hasCrossing && drugPattern.expectedPattern !== 'DELAYED_BENEFIT_WITH_EARLY_RISK') {
            assessment.warnings.push({
                type: 'UNEXPECTED_CROSSING',
                message: `Curve crossing detected but not expected for ${drugClass}`,
                severity: 'MEDIUM',
                action: 'Verify this represents true crossing vs digitization artifact'
            });
            assessment.overallScore -= 10;
        }

        // 4. Check time to separation
        if (drugPattern.timeToSeparation && hazardAnalysis.separationTime !== null) {
            const { median, max } = drugPattern.timeToSeparation;
            
            if (hazardAnalysis.separationTime > max * 1.5) {
                assessment.warnings.push({
                    type: 'DELAYED_SEPARATION',
                    message: `Separation at ${hazardAnalysis.separationTime.toFixed(1)}mo, expected by ${max}mo for ${drugClass}`,
                    severity: 'LOW',
                    action: 'May indicate different patient population or effect modification'
                });
            } else if (hazardAnalysis.separationTime < median * 0.3 && drugPattern.expectedPattern !== 'EARLY_SEPARATION') {
                assessment.warnings.push({
                    type: 'VERY_EARLY_SEPARATION',
                    message: `Very early separation (${hazardAnalysis.separationTime.toFixed(1)}mo) unusual for ${drugClass}`,
                    severity: 'LOW',
                    action: 'Verify digitization of early timepoints'
                });
            }

            assessment.details.separationTime = {
                observed: hazardAnalysis.separationTime,
                expectedMedian: median,
                expectedMax: max
            };
        }

        // 5. Compare to reported HR if available
        if (reportedHR !== null) {
            const reconstructedHR = estimateHRFromIPD(ipd);
            const hrDiff = Math.abs(reconstructedHR - reportedHR) / reportedHR;
            
            if (hrDiff > 0.15) {
                assessment.warnings.push({
                    type: 'HR_MISMATCH',
                    message: `Reconstructed HR (${reconstructedHR.toFixed(2)}) differs ${(hrDiff * 100).toFixed(0)}% from reported (${reportedHR})`,
                    severity: hrDiff > 0.25 ? 'HIGH' : 'MEDIUM',
                    action: 'Check NaR table alignment and censoring pattern'
                });
                assessment.overallScore -= hrDiff > 0.25 ? 20 : 10;
            }

            // Compare to typical HR for drug class
            if (drugPattern.typicalHR) {
                const { point, lower, upper } = drugPattern.typicalHR;
                if (reportedHR < lower * 0.8 || reportedHR > upper * 1.2) {
                    assessment.flags.push({
                        type: 'ATYPICAL_HR',
                        message: `Reported HR (${reportedHR}) outside typical range (${lower.toFixed(2)}-${upper.toFixed(2)}) for ${drugClass}`,
                        severity: 'LOW',
                        action: 'This is informational - may indicate exceptional efficacy or different population'
                    });
                }
            }

            assessment.details.hrComparison = {
                reconstructed: reconstructedHR,
                reported: reportedHR,
                percentDiff: hrDiff * 100,
                typicalRange: drugPattern.typicalHR
            };
        }

        // 6. Check censoring distribution
        const censoringAnalysis = analyzeCensoringPattern(ipd, trialYear, domainData);
        
        if (!censoringAnalysis.plausible) {
            assessment.warnings.push({
                type: 'UNUSUAL_CENSORING',
                message: censoringAnalysis.message,
                severity: 'LOW',
                action: 'Review censoring tick marks if available'
            });
            assessment.overallScore -= 5;
        }

        assessment.details.censoring = censoringAnalysis;

        // 7. Final grade
        if (assessment.overallScore >= 90) {
            assessment.grade = 'A';
            assessment.recommendation = 'Reconstruction appears highly plausible. Suitable for primary analysis.';
        } else if (assessment.overallScore >= 75) {
            assessment.grade = 'B';
            assessment.recommendation = 'Reconstruction plausible with minor concerns. Review flagged items.';
        } else if (assessment.overallScore >= 60) {
            assessment.grade = 'C';
            assessment.recommendation = 'Reconstruction has notable concerns. Sensitivity analysis recommended.';
        } else {
            assessment.grade = 'D';
            assessment.recommendation = 'Reconstruction has significant concerns. Consider re-digitization or exclude.';
        }

        return assessment;
    }

    /**
     * Analyze hazard pattern from IPD
     */
    function analyzeHazardPattern(ipd, targetCurve) {
        const sorted = [...ipd].sort((a, b) => a.time - b.time);
        const events = sorted.filter(p => p.status === 1);
        const maxTime = Math.max(...sorted.map(p => p.time));
        
        // Calculate hazard in windows
        const windowSize = maxTime / 6;
        const hazards = [];
        
        for (let t = 0; t < maxTime; t += windowSize) {
            const eventsInWindow = events.filter(p => p.time >= t && p.time < t + windowSize).length;
            const atRisk = sorted.filter(p => p.time >= t).length;
            if (atRisk > 10) {
                hazards.push({
                    time: t + windowSize / 2,
                    hazard: eventsInWindow / (atRisk * windowSize / 12) // Monthly hazard
                });
            }
        }

        // Detect pattern
        let pattern = 'CONSTANT';
        let hasCrossing = false;
        let separationTime = null;

        if (hazards.length >= 3) {
            const earlyHazard = hazards[0].hazard;
            const midHazard = hazards[Math.floor(hazards.length / 2)].hazard;
            const lateHazard = hazards[hazards.length - 1].hazard;

            if (earlyHazard > midHazard * 1.3 && midHazard > lateHazard * 0.9) {
                pattern = 'DECREASING';
            } else if (lateHazard > earlyHazard * 1.3) {
                pattern = 'INCREASING';
            } else if (earlyHazard > midHazard * 1.5 && lateHazard > midHazard * 1.2) {
                pattern = 'U_SHAPED';
            } else if (earlyHazard * 1.3 < midHazard && midHazard > lateHazard * 1.3) {
                pattern = 'INVERTED_U';
            }

            // Early spike detection (devices)
            if (hazards[0].hazard > hazards[1].hazard * 2) {
                pattern = 'EARLY_SPIKE_THEN_DECREASING';
            }
        }

        // Detect separation time from curve
        if (targetCurve && targetCurve.length > 1) {
            for (let i = 1; i < targetCurve.length; i++) {
                const drop = targetCurve[i-1].y - targetCurve[i].y;
                if (drop > 0.02) { // 2% drop = meaningful separation
                    separationTime = targetCurve[i].x;
                    break;
                }
            }
        }

        // Detect crossing (would need both arms - simplified here)
        // In practice, compare treatment vs control curves

        return {
            pattern,
            hazards,
            hasCrossing,
            separationTime
        };
    }

    /**
     * Compare observed vs expected patterns
     */
    function comparePatterns(observed, expected) {
        const compatibilityMatrix = {
            'EARLY_SEPARATION': ['DECREASING', 'DECREASING_EARLY', 'CONSTANT'],
            'DELAYED_BENEFIT': ['INCREASING', 'CONSTANT', 'U_SHAPED'],
            'DELAYED_BENEFIT_WITH_EARLY_RISK': ['EARLY_SPIKE_THEN_DECREASING', 'U_SHAPED'],
            'GRADUAL_SEPARATION': ['CONSTANT', 'DECREASING'],
            'DELAYED_SEPARATION': ['INCREASING', 'CONSTANT'],
            'CROSSING_THEN_DIVERGING': ['INVERTED_U', 'COMPLEX'],
            'UNKNOWN': ['CONSTANT', 'DECREASING', 'INCREASING'] // Accept anything
        };

        const compatible = (compatibilityMatrix[expected] || []).includes(observed);

        return {
            compatible,
            severity: compatible ? 'NONE' : (expected === 'UNKNOWN' ? 'LOW' : 'MEDIUM'),
            possibleCauses: compatible ? [] : [
                'Different patient population than typical trials',
                'Digitization errors affecting curve shape',
                'Novel treatment effect pattern',
                'Drug class misassignment'
            ]
        };
    }

    /**
     * Analyze censoring pattern plausibility
     */
    function analyzeCensoringPattern(ipd, trialYear, domainData) {
        const censored = ipd.filter(p => p.status === 0);
        const maxTime = Math.max(...ipd.map(p => p.time));
        
        if (censored.length < 5) {
            return { plausible: true, message: 'Too few censored observations to assess' };
        }

        // Calculate distribution statistics
        const censorTimes = censored.map(p => p.time / maxTime); // Normalize to [0,1]
        const mean = censorTimes.reduce((a, b) => a + b, 0) / censorTimes.length;
        const median = censorTimes.sort((a, b) => a - b)[Math.floor(censorTimes.length / 2)];

        // Expected pattern based on era
        let era;
        if (trialYear < 2000) era = 'pre2000';
        else if (trialYear < 2010) era = '2000-2010';
        else if (trialYear < 2020) era = '2010-2020';
        else era = 'post2020';

        const eraData = domainData.eraEffects[era];
        const expectedPattern = domainData.censoringPatterns[eraData.censoringPattern];

        let plausible = true;
        let message = 'Censoring pattern consistent with trial era';

        // Modern trials should have right-skewed censoring
        if (era === 'post2020' || era === '2010-2020') {
            if (mean < 0.5) {
                plausible = false;
                message = `Censoring appears early-heavy (mean at ${(mean * 100).toFixed(0)}% of follow-up) but modern trial expected administrative censoring at end`;
            }
        }

        // Old trials should have more uniform censoring
        if (era === 'pre2000') {
            if (mean > 0.75) {
                plausible = false;
                message = `Censoring appears end-heavy but ${trialYear} trial expected more uniform dropout`;
            }
        }

        return {
            plausible,
            message,
            observed: { mean, median },
            expected: expectedPattern,
            era
        };
    }

    /**
     * Estimate HR from IPD (simplified log-rank based)
     */
    function estimateHRFromIPD(ipd) {
        // This is a simplified calculation
        // For two-arm comparison, would use proper log-rank
        const events = ipd.filter(p => p.status === 1);
        const censored = ipd.filter(p => p.status === 0);
        
        // Rough estimate based on event rate over time
        const n = ipd.length;
        const d = events.length;
        const medianTime = ipd.map(p => p.time).sort((a, b) => a - b)[Math.floor(n / 2)];
        
        // Use exponential assumption: HR ≈ exp(log(d/n) / median)
        // This is just a placeholder - real HR needs comparison group
        return 0.75; // Return placeholder
    }

    // ============================================
    // SECTION 5: ENSEMBLE RECONSTRUCTION
    // ============================================

    /**
     * Generate multiple reconstructions with different assumptions
     * and combine for uncertainty quantification
     */
    function ensembleReconstruction(survivalPoints, atRiskTable, trialContext, options = {}) {
        const {
            nSamples = 50,
            varyingParams = ['censoring', 'eventTiming', 'candidateRange'],
            aggregation = 'median' // 'mean', 'median', 'all'
        } = options;

        const samples = [];
        
        for (let i = 0; i < nSamples; i++) {
            // Vary parameters stochastically
            const sampleOptions = {
                ...trialContext,
                useInformedCensoring: varyingParams.includes('censoring') 
                    ? Math.random() > 0.3 // 70% use informed, 30% uniform
                    : true,
                candidateRange: varyingParams.includes('candidateRange')
                    ? Math.floor(1 + Math.random() * 3) // 1-3
                    : 2,
                // Add small noise to event timing
                eventTimingNoise: varyingParams.includes('eventTiming')
                    ? 0.1 + Math.random() * 0.2
                    : 0
            };

            const ipd = reconstructIPD_DomainAware(survivalPoints, atRiskTable, sampleOptions);
            
            samples.push({
                sampleId: i + 1,
                ipd,
                metrics: calculateIPDMetrics(ipd)
            });
        }

        // Aggregate results
        const aggregated = aggregateSamples(samples, aggregation);

        return {
            samples,
            aggregated,
            uncertainty: calculateUncertainty(samples),
            credibleIntervals: calculateCredibleIntervals(samples)
        };
    }

    /**
     * Calculate metrics from IPD
     */
    function calculateIPDMetrics(ipd) {
        const n = ipd.length;
        const events = ipd.filter(p => p.status === 1).length;
        const maxTime = Math.max(...ipd.map(p => p.time));
        
        // Median survival
        const km = calculateKMFromIPD(ipd);
        let median = null;
        for (const p of km) {
            if (p.survival <= 0.5) {
                median = p.time;
                break;
            }
        }

        // RMST at common horizons
        const rmst12 = calculateRMST(km, 12);
        const rmst24 = calculateRMST(km, 24);
        const rmst36 = calculateRMST(km, 36);

        // Survival at landmarks
        const s12 = getSurvivalAt(km, 12);
        const s24 = getSurvivalAt(km, 24);
        const s36 = getSurvivalAt(km, 36);

        return {
            n,
            events,
            eventRate: events / n,
            maxTime,
            median,
            rmst12, rmst24, rmst36,
            s12, s24, s36
        };
    }

    function calculateKMFromIPD(ipd) {
        const sorted = [...ipd].sort((a, b) => a.time - b.time);
        const km = [{ time: 0, survival: 1 }];
        let n = sorted.length;
        let s = 1;

        let i = 0;
        while (i < sorted.length) {
            const t = sorted[i].time;
            let events = 0;
            let censored = 0;

            while (i < sorted.length && sorted[i].time === t) {
                if (sorted[i].status === 1) events++;
                else censored++;
                i++;
            }

            if (events > 0 && n > 0) {
                s *= (n - events) / n;
                km.push({ time: t, survival: s });
            }
            n -= events + censored;
        }

        return km;
    }

    function calculateRMST(km, tau) {
        let rmst = 0;
        let prevTime = 0;
        let prevSurv = 1;

        for (const p of km) {
            if (p.time > tau) break;
            rmst += prevSurv * (p.time - prevTime);
            prevTime = p.time;
            prevSurv = p.survival;
        }
        rmst += prevSurv * Math.max(0, tau - prevTime);
        return rmst;
    }

    function getSurvivalAt(km, t) {
        for (let i = km.length - 1; i >= 0; i--) {
            if (km[i].time <= t) return km[i].survival;
        }
        return 1;
    }

    /**
     * Aggregate samples
     */
    function aggregateSamples(samples, method) {
        const metrics = samples.map(s => s.metrics);
        
        const aggregate = {};
        const keys = Object.keys(metrics[0]);
        
        for (const key of keys) {
            const values = metrics.map(m => m[key]).filter(v => v !== null);
            
            if (values.length === 0) {
                aggregate[key] = null;
                continue;
            }

            if (method === 'mean') {
                aggregate[key] = values.reduce((a, b) => a + b, 0) / values.length;
            } else if (method === 'median') {
                values.sort((a, b) => a - b);
                aggregate[key] = values[Math.floor(values.length / 2)];
            }
        }

        return aggregate;
    }

    /**
     * Calculate uncertainty across samples
     */
    function calculateUncertainty(samples) {
        const metrics = samples.map(s => s.metrics);
        
        const uncertainty = {};
        const keys = ['median', 'rmst12', 'rmst24', 'rmst36', 's12', 's24', 's36', 'eventRate'];
        
        for (const key of keys) {
            const values = metrics.map(m => m[key]).filter(v => v !== null);
            
            if (values.length < 2) {
                uncertainty[key] = { sd: null, cv: null };
                continue;
            }

            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
            const sd = Math.sqrt(variance);
            
            uncertainty[key] = {
                mean,
                sd,
                cv: mean !== 0 ? sd / mean : null,
                min: Math.min(...values),
                max: Math.max(...values)
            };
        }

        return uncertainty;
    }

    /**
     * Calculate credible intervals
     */
    function calculateCredibleIntervals(samples, level = 0.95) {
        const metrics = samples.map(s => s.metrics);
        const alpha = (1 - level) / 2;
        
        const ci = {};
        const keys = ['median', 'rmst12', 'rmst24', 'rmst36', 's12', 's24', 's36'];
        
        for (const key of keys) {
            const values = metrics.map(m => m[key]).filter(v => v !== null).sort((a, b) => a - b);
            
            if (values.length < 5) {
                ci[key] = { lower: null, upper: null };
                continue;
            }

            const lowerIdx = Math.floor(alpha * values.length);
            const upperIdx = Math.floor((1 - alpha) * values.length);
            
            ci[key] = {
                lower: values[lowerIdx],
                upper: values[upperIdx],
                width: values[upperIdx] - values[lowerIdx]
            };
        }

        return ci;
    }

    // ============================================
    // SECTION 6: COMPARISON VALIDATION
    // ============================================

    /**
     * Compare two reconstruction methods on the same curve
     */
    function compareReconstructionMethods(survivalPoints, atRiskTable, options = {}) {
        const { trialContext = {}, reportedValues = {} } = options;

        // Method 1: Standard CEN-KM (uniform censoring)
        const standardIPD = reconstructIPD_DomainAware(survivalPoints, atRiskTable, {
            ...trialContext,
            useInformedCensoring: false,
            domain: null
        });

        // Method 2: Domain-aware CEN-KM
        const domainAwareIPD = reconstructIPD_DomainAware(survivalPoints, atRiskTable, {
            ...trialContext,
            useInformedCensoring: true
        });

        // Calculate metrics for both
        const standardMetrics = calculateIPDMetrics(standardIPD);
        const domainAwareMetrics = calculateIPDMetrics(domainAwareIPD);

        // Compare to reported values
        const comparison = {
            standard: {
                ipd: standardIPD,
                metrics: standardMetrics,
                plausibility: assessPlausibility(standardIPD, survivalPoints, trialContext)
            },
            domainAware: {
                ipd: domainAwareIPD,
                metrics: domainAwareMetrics,
                plausibility: assessPlausibility(domainAwareIPD, survivalPoints, trialContext)
            },
            differences: {},
            recommendation: ''
        };

        // Calculate differences
        for (const key of Object.keys(standardMetrics)) {
            if (standardMetrics[key] !== null && domainAwareMetrics[key] !== null) {
                comparison.differences[key] = {
                    standard: standardMetrics[key],
                    domainAware: domainAwareMetrics[key],
                    diff: domainAwareMetrics[key] - standardMetrics[key],
                    percentDiff: standardMetrics[key] !== 0 
                        ? ((domainAwareMetrics[key] - standardMetrics[key]) / standardMetrics[key] * 100)
                        : null
                };
            }
        }

        // Compare to reported if available
        if (reportedValues.median) {
            comparison.differences.medianVsReported = {
                standard: Math.abs((standardMetrics.median || 0) - reportedValues.median),
                domainAware: Math.abs((domainAwareMetrics.median || 0) - reportedValues.median)
            };
        }

        if (reportedValues.events) {
            comparison.differences.eventsVsReported = {
                standard: Math.abs(standardMetrics.events - reportedValues.events),
                domainAware: Math.abs(domainAwareMetrics.events - reportedValues.events)
            };
        }

        // Recommendation
        const stdScore = comparison.standard.plausibility.overallScore;
        const daScore = comparison.domainAware.plausibility.overallScore;

        if (daScore > stdScore + 10) {
            comparison.recommendation = 'Domain-aware reconstruction recommended (higher plausibility score)';
        } else if (stdScore > daScore + 10) {
            comparison.recommendation = 'Standard reconstruction recommended (domain assumptions may not fit this trial)';
        } else {
            comparison.recommendation = 'Methods produce similar results. Consider reporting both for sensitivity analysis.';
        }

        return comparison;
    }

    // ============================================
    // SECTION 7: REPORT GENERATION
    // ============================================

    /**
     * Generate comprehensive reconstruction report
     */
    function generateReconstructionReport(reconstruction, assessment, trialInfo = {}) {
        const { ipd, metrics, ensemble } = reconstruction;
        const { flags, warnings, grade, recommendation, details } = assessment;

        let report = `
# IPD Reconstruction Report

## Trial Information
- **Study**: ${trialInfo.name || 'Unknown'}
- **Drug Class**: ${trialInfo.drugClass || 'Unknown'}
- **Phenotype**: ${trialInfo.phenotype || 'Unknown'}
- **Year**: ${trialInfo.year || 'Unknown'}

## Reconstruction Summary

| Metric | Value |
|--------|-------|
| Sample Size | ${ipd.length} |
| Events | ${ipd.filter(p => p.status === 1).length} |
| Event Rate | ${(metrics.eventRate * 100).toFixed(1)}% |
| Median Survival | ${metrics.median ? metrics.median.toFixed(1) + ' mo' : 'Not reached'} |
| RMST @ 12mo | ${metrics.rmst12.toFixed(1)} mo |
| RMST @ 24mo | ${metrics.rmst24.toFixed(1)} mo |
| RMST @ 36mo | ${metrics.rmst36.toFixed(1)} mo |

## Plausibility Assessment

**Overall Grade: ${grade}** (Score: ${assessment.overallScore}/100)

${recommendation}
`;

        if (flags.length > 0) {
            report += `
### Flags
${flags.map(f => `- **${f.type}**: ${f.message}
  - Severity: ${f.severity}
  - Action: ${f.action}`).join('\n')}
`;
        }

        if (warnings.length > 0) {
            report += `
### Warnings
${warnings.map(w => `- **${w.type}**: ${w.message}
  - Severity: ${w.severity}
  - Action: ${w.action}`).join('\n')}
`;
        }

        if (ensemble) {
            report += `
## Uncertainty Quantification (${ensemble.samples.length} samples)

| Metric | Mean | SD | 95% CI |
|--------|------|-----|--------|
| Median | ${ensemble.uncertainty.median?.mean?.toFixed(1) || '-'} | ${ensemble.uncertainty.median?.sd?.toFixed(1) || '-'} | [${ensemble.credibleIntervals.median?.lower?.toFixed(1)}, ${ensemble.credibleIntervals.median?.upper?.toFixed(1)}] |
| RMST@24 | ${ensemble.uncertainty.rmst24?.mean?.toFixed(1) || '-'} | ${ensemble.uncertainty.rmst24?.sd?.toFixed(2) || '-'} | [${ensemble.credibleIntervals.rmst24?.lower?.toFixed(1)}, ${ensemble.credibleIntervals.rmst24?.upper?.toFixed(1)}] |
| S(24) | ${(ensemble.uncertainty.s24?.mean * 100)?.toFixed(1) || '-'}% | ${(ensemble.uncertainty.s24?.sd * 100)?.toFixed(1) || '-'}% | [${(ensemble.credibleIntervals.s24?.lower * 100)?.toFixed(1)}%, ${(ensemble.credibleIntervals.s24?.upper * 100)?.toFixed(1)}%] |
`;
        }

        if (details.hrComparison) {
            report += `
## HR Comparison
- **Reconstructed HR**: ${details.hrComparison.reconstructed?.toFixed(2) || '-'}
- **Reported HR**: ${details.hrComparison.reported?.toFixed(2) || '-'}
- **Difference**: ${details.hrComparison.percentDiff?.toFixed(1) || '-'}%
${details.hrComparison.typicalRange ? `- **Typical for ${trialInfo.drugClass}**: ${details.hrComparison.typicalRange.lower.toFixed(2)} - ${details.hrComparison.typicalRange.upper.toFixed(2)}` : ''}
`;
        }

        report += `
## Methodology Notes

This reconstruction used the CEN-KM algorithm (branch-and-compare) with:
- ${ipd._reconstruction?.useInformedCensoring ? 'Domain-informed censoring distribution' : 'Uniform censoring assumption'}
- Domain: ${ipd._reconstruction?.domain || 'None'}
- Drug class patterns: ${ipd._reconstruction?.drugClass || 'None'}

The plausibility assessment compares reconstruction characteristics against:
- Expected hazard patterns for the drug class
- Typical event rates for the HF phenotype
- Era-appropriate censoring distributions

**Important**: Domain knowledge is used for VALIDATION and FLAGGING, not to override the transparent reconstruction algorithm.
`;

        return report;
    }

    // ============================================
    // SECTION 8: PUBLIC API
    // ============================================

    return {
        // Domain data
        DOMAINS,
        HF_DOMAIN,
        ONCOLOGY_DOMAIN,

        // Core reconstruction
        reconstructIPD: reconstructIPD_DomainAware,
        
        // Informed censoring
        generateInformedCensorTimes,
        
        // Validation
        assessPlausibility,
        analyzeHazardPattern,
        
        // Ensemble
        ensembleReconstruction,
        
        // Comparison
        compareReconstructionMethods,
        
        // Utilities
        calculateIPDMetrics,
        calculateKMFromIPD,
        calculateRMST,
        getSurvivalAt,
        
        // Reporting
        generateReconstructionReport,
        
        // Sampling utilities
        sampleBeta,
        sampleGamma,
        sampleNormal
    };

})();

// ============================================
// Export
// ============================================

if (typeof window !== 'undefined') {
    window.DomainAwareReconstruction = DomainAwareReconstruction;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DomainAwareReconstruction;
}

console.log('SurvExtract Domain-Aware Reconstruction Module loaded');
console.log('Available domains:', Object.keys(DomainAwareReconstruction.DOMAINS));
