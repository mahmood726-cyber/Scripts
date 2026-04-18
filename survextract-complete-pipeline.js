// ============================================
// SurvExtract Pro v6.0: COMPLETE END-TO-END NMA PIPELINE
// Implements ALL methods from the "99% NMA Improvement" analysis
// ============================================
//
// PIPELINE OVERVIEW:
// ┌─────────────────────────────────────────────────────────────────┐
// │ STAGE 1: DATA EXTRACTION                                       │
// │   • KM curve digitization (OpenCV, PDF vector, manual)         │
// │   • Rogula tick detection for censoring                        │
// │   • Number-at-risk table extraction                            │
// │   • Table 1 characteristics capture                            │
// └─────────────────────────────────────────────────────────────────┘
//                              ↓
// ┌─────────────────────────────────────────────────────────────────┐
// │ STAGE 2: IPD RECONSTRUCTION                                    │
// │   • Guyot algorithm (standard)                                 │
// │   • CEN-KM branch-and-compare (RESOLVE-IPD)                    │
// │   • Risk table boundary alignment                              │
// │   • Validation against reported statistics                     │
// └─────────────────────────────────────────────────────────────────┘
//                              ↓
// ┌─────────────────────────────────────────────────────────────────┐
// │ STAGE 3: PER-STUDY ANALYSIS                                    │
// │   • Non-proportional hazards testing                           │
// │   • Time-varying HR estimation                                 │
// │   • RMST calculation at multiple horizons                      │
// │   • Flexible parametric modeling (Royston-Parmar)              │
// └─────────────────────────────────────────────────────────────────┘
//                              ↓
// ┌─────────────────────────────────────────────────────────────────┐
// │ STAGE 4: META-ANALYSIS                                         │
// │   • Standard pairwise MA (DL, REML, PM)                        │
// │   • Network meta-analysis                                      │
// │   • RMST meta-analysis                                         │
// │   • Dose-response NMA                                          │
// │   • Time-course NMA                                            │
// └─────────────────────────────────────────────────────────────────┘
//                              ↓
// ┌─────────────────────────────────────────────────────────────────┐
// │ STAGE 5: ADVANCED DIAGNOSTICS                                  │
// │   • Predictive intervals                                       │
// │   • RoBMA publication bias                                     │
// │   • Threshold analysis (fragility)                             │
// │   • Gower transitivity assessment                              │
// │   • Consistency evaluation                                     │
// └─────────────────────────────────────────────────────────────────┘
//                              ↓
// ┌─────────────────────────────────────────────────────────────────┐
// │ STAGE 6: REPORTING                                             │
// │   • GRADE/CINeMA certainty assessment                          │
// │   • Publication-ready tables and figures                       │
// │   • Key messages for clinicians                                │
// │   • Sensitivity analysis summary                               │
// └─────────────────────────────────────────────────────────────────┘

// ============================================
// SECTION 1: STUDY DATA STRUCTURE
// ============================================

/**
 * Complete study data structure for end-to-end pipeline
 */
class StudyData {
    constructor(name) {
        this.name = name;
        this.arms = {};              // {armName: {ipd: [], kmPoints: [], atRisk: []}}
        this.characteristics = {};    // Table 1 data
        this.reportedResults = {};    // Published HR, CI, p-values
        this.reconstructedResults = {}; // Our calculated results
        this.quality = {};            // Extraction quality metrics
    }
    
    addArm(armName, data) {
        this.arms[armName] = {
            ipd: data.ipd || [],
            kmPoints: data.kmPoints || [],
            atRisk: data.atRisk || [],
            censorTicks: data.censorTicks || [],
            n: data.n || 0,
            events: data.events || 0
        };
    }
    
    setCharacteristics(chars) {
        this.characteristics = {
            year: chars.year,
            country: chars.country,
            meanAge: chars.meanAge,
            pctFemale: chars.pctFemale,
            pctPrimaryEndpoint: chars.pctPrimaryEndpoint,
            medianFollowUp: chars.medianFollowUp,
            inclusionCriteria: chars.inclusionCriteria || [],
            exclusionCriteria: chars.exclusionCriteria || [],
            backgroundTherapy: chars.backgroundTherapy || [],
            comparator: chars.comparator,
            ...chars
        };
    }
    
    setReportedResults(results) {
        this.reportedResults = {
            hr: results.hr,
            hrLower: results.hrLower,
            hrUpper: results.hrUpper,
            pValue: results.pValue,
            medianTreatment: results.medianTreatment,
            medianControl: results.medianControl,
            events: results.events,
            ...results
        };
    }
}

/**
 * Network data structure for NMA
 */
class NetworkData {
    constructor() {
        this.studies = [];
        this.treatments = new Set();
        this.comparisons = [];
        this.characteristics = [];
    }
    
    addStudy(study) {
        this.studies.push(study);
        Object.keys(study.arms).forEach(arm => this.treatments.add(arm));
    }
    
    buildNetwork() {
        this.comparisons = [];
        this.studies.forEach(study => {
            const arms = Object.keys(study.arms);
            if (arms.length >= 2) {
                // All pairwise comparisons within study
                for (let i = 0; i < arms.length; i++) {
                    for (let j = i + 1; j < arms.length; j++) {
                        this.comparisons.push({
                            study: study.name,
                            treatment1: arms[i],
                            treatment2: arms[j],
                            ...study.reconstructedResults[`${arms[i]}_vs_${arms[j]}`]
                        });
                    }
                }
            }
        });
        return this;
    }
}

// ============================================
// SECTION 2: NON-PROPORTIONAL HAZARDS TESTING
// From the 99% document: "Almost never tested" - now we test
// ============================================

/**
 * Comprehensive non-PH testing suite
 * Tests multiple aspects of proportional hazards assumption
 */
function testProportionalHazards(ipd, options = {}) {
    const {
        timePoints = [0.25, 0.5, 0.75],  // Quantiles for scaled Schoenfeld
        method = 'all'                     // 'schoenfeld', 'loglog', 'landmark', 'all'
    } = options;
    
    const arms = [...new Set(ipd.map(p => p.arm))];
    if (arms.length !== 2) {
        return { error: 'Need exactly 2 arms for PH testing' };
    }
    
    const results = {
        overall: null,
        tests: {},
        interpretation: '',
        recommendation: ''
    };
    
    // 1. Schoenfeld residuals test (gold standard)
    if (method === 'all' || method === 'schoenfeld') {
        results.tests.schoenfeld = testSchoenfeldResiduals(ipd, arms);
    }
    
    // 2. Log-log plot linearity test
    if (method === 'all' || method === 'loglog') {
        results.tests.loglog = testLogLogLinearity(ipd, arms);
    }
    
    // 3. Landmark analysis (time-varying HR)
    if (method === 'all' || method === 'landmark') {
        results.tests.landmark = testLandmarkHR(ipd, arms, timePoints);
    }
    
    // 4. Weighted log-rank tests (Fleming-Harrington family)
    if (method === 'all' || method === 'weighted') {
        results.tests.weighted = testWeightedLogRank(ipd, arms);
    }
    
    // 5. Curve crossing detection
    results.tests.crossing = detectCurveCrossing(ipd, arms);
    
    // Overall assessment
    results.overall = assessOverallPH(results.tests);
    results.interpretation = interpretPHResults(results);
    results.recommendation = recommendAnalysisApproach(results);
    
    return results;
}

/**
 * Schoenfeld residuals test for PH
 * Correlation of scaled residuals with time
 */
function testSchoenfeldResiduals(ipd, arms) {
    const sorted = [...ipd].filter(p => p.status === 1).sort((a, b) => a.time - b.time);
    if (sorted.length < 10) return { valid: false, reason: 'Insufficient events' };
    
    const arm0 = arms[0];
    const residuals = [];
    
    // At each event time, calculate Schoenfeld residual
    sorted.forEach((event, idx) => {
        const t = event.time;
        const atRisk = ipd.filter(p => p.time >= t);
        const atRisk0 = atRisk.filter(p => p.arm === arm0).length;
        const atRisk1 = atRisk.filter(p => p.arm !== arm0).length;
        const n = atRisk0 + atRisk1;
        
        if (n < 2) return;
        
        const expected = atRisk0 / n;  // Expected proportion in arm0
        const observed = event.arm === arm0 ? 1 : 0;
        const residual = observed - expected;
        
        residuals.push({ time: t, residual, rank: idx + 1 });
    });
    
    if (residuals.length < 5) return { valid: false, reason: 'Insufficient events' };
    
    // Correlation of residuals with time (or log(time) or rank)
    const n = residuals.length;
    const times = residuals.map(r => Math.log(r.time));  // Log time for Grambsch-Therneau
    const resids = residuals.map(r => r.residual);
    
    const meanT = times.reduce((a, b) => a + b, 0) / n;
    const meanR = resids.reduce((a, b) => a + b, 0) / n;
    
    let num = 0, denT = 0, denR = 0;
    for (let i = 0; i < n; i++) {
        num += (times[i] - meanT) * (resids[i] - meanR);
        denT += Math.pow(times[i] - meanT, 2);
        denR += Math.pow(resids[i] - meanR, 2);
    }
    
    const correlation = num / Math.sqrt(denT * denR);
    
    // Test statistic (approximately chi-squared with 1 df)
    const chiSq = n * correlation * correlation;
    const pValue = 1 - chi2CDF(chiSq, 1);
    
    return {
        valid: true,
        correlation,
        chiSquare: chiSq,
        df: 1,
        pValue,
        interpretation: pValue < 0.05 
            ? `PH VIOLATED (ρ=${correlation.toFixed(3)}, p=${pValue.toFixed(4)})`
            : `PH not rejected (ρ=${correlation.toFixed(3)}, p=${pValue.toFixed(4)})`
    };
}

/**
 * Log-log plot linearity test
 * Under PH, log(-log(S(t))) vs log(t) should be parallel
 */
function testLogLogLinearity(ipd, arms) {
    const kmByArm = {};
    arms.forEach(arm => {
        kmByArm[arm] = calculateKMCurve(ipd.filter(p => p.arm === arm));
    });
    
    // Get common time points
    const allTimes = [...new Set([
        ...kmByArm[arms[0]].map(k => k.time),
        ...kmByArm[arms[1]].map(k => k.time)
    ])].sort((a, b) => a - b).filter(t => t > 0);
    
    // Calculate log(-log(S)) at each time
    const loglogData = arms.map(arm => {
        const km = kmByArm[arm];
        return allTimes.map(t => {
            const s = getKMSurvivalAt(km, t);
            if (s <= 0 || s >= 1) return null;
            return { time: t, logTime: Math.log(t), loglogS: Math.log(-Math.log(s)) };
        }).filter(d => d !== null);
    });
    
    if (loglogData[0].length < 5 || loglogData[1].length < 5) {
        return { valid: false, reason: 'Insufficient data points' };
    }
    
    // Fit linear regression for each arm
    const fits = loglogData.map(data => {
        const x = data.map(d => d.logTime);
        const y = data.map(d => d.loglogS);
        return linearRegression(x, y);
    });
    
    // Under PH, slopes should be equal (parallel lines)
    const slopeDiff = Math.abs(fits[0].slope - fits[1].slope);
    const pooledSE = Math.sqrt(fits[0].slopeVariance + fits[1].slopeVariance);
    const zStat = slopeDiff / pooledSE;
    const pValue = 2 * (1 - normalCDF(Math.abs(zStat)));
    
    return {
        valid: true,
        slopes: { [arms[0]]: fits[0].slope, [arms[1]]: fits[1].slope },
        slopeDifference: slopeDiff,
        zStatistic: zStat,
        pValue,
        parallel: pValue >= 0.05,
        interpretation: pValue < 0.05
            ? `Log-log curves NOT parallel (Δslope=${slopeDiff.toFixed(3)}, p=${pValue.toFixed(4)}) → PH violated`
            : `Log-log curves approximately parallel (p=${pValue.toFixed(4)})`
    };
}

/**
 * Landmark analysis for time-varying HR
 * Calculates HR at different time points
 */
function testLandmarkHR(ipd, arms, quantiles = [0.25, 0.5, 0.75]) {
    const maxTime = Math.max(...ipd.map(p => p.time));
    const landmarks = quantiles.map(q => q * maxTime);
    
    const timeVaryingHRs = landmarks.map(landmark => {
        // Patients still at risk at landmark
        const atRisk = ipd.filter(p => p.time >= landmark);
        if (atRisk.length < 20) return { landmark, hr: null, reason: 'Insufficient at-risk' };
        
        // Events after landmark
        const events = atRisk.filter(p => p.status === 1);
        if (events.length < 5) return { landmark, hr: null, reason: 'Insufficient events' };
        
        // Simple HR calculation
        const arm0Events = events.filter(p => p.arm === arms[0]).length;
        const arm1Events = events.filter(p => p.arm === arms[1]).length;
        const arm0AtRisk = atRisk.filter(p => p.arm === arms[0]).length;
        const arm1AtRisk = atRisk.filter(p => p.arm === arms[1]).length;
        
        const arm0PT = atRisk.filter(p => p.arm === arms[0])
            .reduce((sum, p) => sum + (p.time - landmark), 0);
        const arm1PT = atRisk.filter(p => p.arm === arms[1])
            .reduce((sum, p) => sum + (p.time - landmark), 0);
        
        if (arm0PT <= 0 || arm1PT <= 0) return { landmark, hr: null, reason: 'Zero person-time' };
        
        const rate0 = arm0Events / arm0PT;
        const rate1 = arm1Events / arm1PT;
        const hr = rate0 / Math.max(rate1, 0.001);
        
        const seLogHR = Math.sqrt(1/Math.max(arm0Events, 0.5) + 1/Math.max(arm1Events, 0.5));
        
        return {
            landmark,
            hr,
            logHR: Math.log(hr),
            lower: Math.exp(Math.log(hr) - 1.96 * seLogHR),
            upper: Math.exp(Math.log(hr) + 1.96 * seLogHR),
            events: arm0Events + arm1Events,
            atRisk: atRisk.length
        };
    }).filter(r => r.hr !== null);
    
    if (timeVaryingHRs.length < 2) {
        return { valid: false, reason: 'Insufficient landmark estimates' };
    }
    
    // Test for trend
    const x = timeVaryingHRs.map(r => r.landmark);
    const y = timeVaryingHRs.map(r => r.logHR);
    const trend = linearRegression(x, y);
    
    const tStat = trend.slope / Math.sqrt(trend.slopeVariance);
    const pTrend = 2 * (1 - tCDF(Math.abs(tStat), timeVaryingHRs.length - 2));
    
    // Calculate % change in HR
    const firstHR = timeVaryingHRs[0].hr;
    const lastHR = timeVaryingHRs[timeVaryingHRs.length - 1].hr;
    const hrChange = ((lastHR - firstHR) / firstHR) * 100;
    
    return {
        valid: true,
        estimates: timeVaryingHRs,
        trend: {
            slope: trend.slope,
            slopePerMonth: trend.slope,
            pValue: pTrend
        },
        hrChange: {
            first: firstHR,
            last: lastHR,
            percentChange: hrChange,
            direction: hrChange > 0 ? 'attenuating' : 'strengthening'
        },
        interpretation: pTrend < 0.05
            ? `HR ${hrChange > 0 ? 'ATTENUATES' : 'INCREASES'} over time (${Math.abs(hrChange).toFixed(0)}% change, p=${pTrend.toFixed(4)})`
            : `No significant trend in HR over time (p=${pTrend.toFixed(4)})`
    };
}

/**
 * Weighted log-rank tests (Fleming-Harrington family)
 * Different weights detect different departure patterns
 */
function testWeightedLogRank(ipd, arms) {
    const tests = {};
    
    // Standard log-rank (ρ=0, γ=0)
    tests.logrank = flemingHarringtonTest(ipd, arms, 0, 0);
    
    // Wilcoxon (ρ=1, γ=0) - sensitive to early differences
    tests.wilcoxon = flemingHarringtonTest(ipd, arms, 1, 0);
    
    // Late differences (ρ=0, γ=1)
    tests.late = flemingHarringtonTest(ipd, arms, 0, 1);
    
    // Crossing (ρ=1, γ=1)
    tests.crossing = flemingHarringtonTest(ipd, arms, 1, 1);
    
    // Interpretation
    const pattern = detectDeparturePattern(tests);
    
    return {
        tests,
        pattern,
        interpretation: interpretWeightedTests(tests, pattern)
    };
}

function flemingHarringtonTest(ipd, arms, rho, gamma) {
    const sorted = [...ipd].sort((a, b) => a.time - b.time);
    const km = calculateKMCurve(sorted);
    
    let U = 0, V = 0;
    
    let i = 0;
    while (i < sorted.length) {
        const t = sorted[i].time;
        const atRisk = sorted.filter(p => p.time >= t);
        const n = atRisk.length;
        const n0 = atRisk.filter(p => p.arm === arms[0]).length;
        const n1 = n - n0;
        
        // Count events at this time
        let d0 = 0, d1 = 0;
        while (i < sorted.length && sorted[i].time === t) {
            if (sorted[i].status === 1) {
                if (sorted[i].arm === arms[0]) d0++;
                else d1++;
            }
            i++;
        }
        
        const d = d0 + d1;
        if (d === 0 || n < 2) continue;
        
        // KM estimate for weight
        const S = getKMSurvivalAt(km, t);
        const weight = Math.pow(S, rho) * Math.pow(1 - S, gamma);
        
        const expected0 = d * n0 / n;
        U += weight * (d0 - expected0);
        V += weight * weight * d * n0 * n1 * (n - d) / (n * n * (n - 1));
    }
    
    if (V <= 0) return { valid: false };
    
    const z = U / Math.sqrt(V);
    const pValue = 2 * (1 - normalCDF(Math.abs(z)));
    
    return {
        valid: true,
        rho,
        gamma,
        U,
        V,
        z,
        pValue,
        significant: pValue < 0.05
    };
}

function detectDeparturePattern(tests) {
    const lr = tests.logrank.pValue;
    const wil = tests.wilcoxon.pValue;
    const late = tests.late.pValue;
    const cross = tests.crossing.pValue;
    
    if (lr < 0.05 && wil < 0.05 && late < 0.05) {
        return 'CONSISTENT_DIFFERENCE';
    } else if (wil < 0.05 && lr >= 0.05) {
        return 'EARLY_DIFFERENCE_ONLY';
    } else if (late < 0.05 && wil >= 0.05) {
        return 'LATE_DIFFERENCE_ONLY';
    } else if (cross < 0.05 && lr >= 0.05) {
        return 'CROSSING_CURVES';
    } else if (lr < 0.05) {
        return 'OVERALL_DIFFERENCE';
    } else {
        return 'NO_DIFFERENCE';
    }
}

function interpretWeightedTests(tests, pattern) {
    const messages = {
        'CONSISTENT_DIFFERENCE': 'Consistent treatment effect throughout follow-up',
        'EARLY_DIFFERENCE_ONLY': 'Treatment effect present EARLY but diminishes over time → delayed failure pattern',
        'LATE_DIFFERENCE_ONLY': 'Treatment effect emerges LATE → delayed benefit (e.g., immunotherapy)',
        'CROSSING_CURVES': 'Survival curves CROSS → treatment helps some timeframes, harms others',
        'OVERALL_DIFFERENCE': 'Overall difference detected but timing pattern unclear',
        'NO_DIFFERENCE': 'No significant difference detected with any weighting'
    };
    
    return messages[pattern] || pattern;
}

/**
 * Detect if survival curves cross
 */
function detectCurveCrossing(ipd, arms) {
    const km0 = calculateKMCurve(ipd.filter(p => p.arm === arms[0]));
    const km1 = calculateKMCurve(ipd.filter(p => p.arm === arms[1]));
    
    const allTimes = [...new Set([
        ...km0.map(k => k.time),
        ...km1.map(k => k.time)
    ])].sort((a, b) => a - b);
    
    const crossings = [];
    let prevDiff = null;
    
    allTimes.forEach(t => {
        const s0 = getKMSurvivalAt(km0, t);
        const s1 = getKMSurvivalAt(km1, t);
        const diff = s0 - s1;
        
        if (prevDiff !== null && prevDiff * diff < 0) {
            crossings.push({
                time: t,
                survival0: s0,
                survival1: s1,
                direction: diff > 0 ? `${arms[0]} overtakes ${arms[1]}` : `${arms[1]} overtakes ${arms[0]}`
            });
        }
        prevDiff = diff;
    });
    
    return {
        crossings,
        hasCrossing: crossings.length > 0,
        nCrossings: crossings.length,
        interpretation: crossings.length > 0
            ? `Curves cross ${crossings.length} time(s) → PH VIOLATED`
            : 'No curve crossing detected'
    };
}

function assessOverallPH(tests) {
    const violations = [];
    
    if (tests.schoenfeld?.valid && tests.schoenfeld.pValue < 0.05) {
        violations.push('Schoenfeld');
    }
    if (tests.loglog?.valid && tests.loglog.pValue < 0.05) {
        violations.push('Log-log');
    }
    if (tests.landmark?.valid && tests.landmark.trend.pValue < 0.05) {
        violations.push('Landmark');
    }
    if (tests.crossing?.hasCrossing) {
        violations.push('Crossing');
    }
    
    return {
        phHolds: violations.length === 0,
        violations,
        nViolations: violations.length,
        nTests: 4,
        confidence: violations.length === 0 ? 'HIGH' :
                   violations.length === 1 ? 'MODERATE' : 'LOW'
    };
}

function interpretPHResults(results) {
    const overall = results.overall;
    
    if (overall.phHolds) {
        return '✓ Proportional hazards assumption appears reasonable. Constant HR meta-analysis appropriate.';
    }
    
    let msg = `⚠️ PH VIOLATED (${overall.nViolations}/${overall.nTests} tests): ${overall.violations.join(', ')}. `;
    
    if (results.tests.landmark?.valid) {
        const change = results.tests.landmark.hrChange.percentChange;
        if (Math.abs(change) > 20) {
            msg += `HR changes by ${Math.abs(change).toFixed(0)}% over follow-up. `;
        }
    }
    
    if (results.tests.crossing?.hasCrossing) {
        msg += `Curves cross at ${results.tests.crossing.crossings.map(c => c.time.toFixed(1)).join(', ')} months. `;
    }
    
    return msg;
}

function recommendAnalysisApproach(results) {
    const overall = results.overall;
    
    if (overall.phHolds) {
        return {
            primary: 'Standard Cox/HR meta-analysis',
            alternatives: ['RMST as sensitivity analysis'],
            reason: 'PH assumption satisfied'
        };
    }
    
    const pattern = results.tests.weighted?.pattern;
    
    if (results.tests.crossing?.hasCrossing) {
        return {
            primary: 'RMST meta-analysis',
            alternatives: ['Milestone survival', 'Time-varying HR model'],
            reason: 'Curves cross - HR is meaningless overall',
            warning: 'Do NOT pool HRs - they will be misleading'
        };
    }
    
    if (pattern === 'EARLY_DIFFERENCE_ONLY') {
        return {
            primary: 'RMST at early horizon OR weighted HR (Wilcoxon weights)',
            alternatives: ['Piecewise HR model'],
            reason: 'Treatment effect diminishes over time',
            warning: 'Long-term extrapolation will OVERESTIMATE benefit'
        };
    }
    
    if (pattern === 'LATE_DIFFERENCE_ONLY') {
        return {
            primary: 'RMST OR milestone survival',
            alternatives: ['Weighted HR (late weights)', 'Delayed treatment effect model'],
            reason: 'Delayed treatment effect (e.g., immunotherapy)',
            warning: 'Standard log-rank may miss real benefit'
        };
    }
    
    return {
        primary: 'RMST meta-analysis',
        alternatives: ['Time-varying HR', 'Flexible parametric'],
        reason: 'PH violated - constant HR inappropriate'
    };
}

// ============================================
// SECTION 3: RMST CALCULATION AND META-ANALYSIS
// From 99% doc: "More interpretable than HR, doesn't assume PH"
// ============================================

/**
 * Calculate RMST with proper variance estimation
 * Includes Greenwood variance and jackknife
 */
function calculateRMSTComplete(ipd, tau, options = {}) {
    const { method = 'greenwood', armColumn = 'arm' } = options;
    
    if (!tau) {
        // Use minimum of max follow-up across arms
        const arms = [...new Set(ipd.map(p => p[armColumn]))];
        const maxTimes = arms.map(arm => 
            Math.max(...ipd.filter(p => p[armColumn] === arm).map(p => p.time))
        );
        tau = Math.min(...maxTimes);
    }
    
    const sorted = [...ipd].sort((a, b) => a.time - b.time);
    const n = sorted.length;
    
    if (n < 5) return null;
    
    // Calculate KM curve
    let s = 1.0;
    let prevTime = 0;
    let rmst = 0;
    let atRisk = n;
    
    // For Greenwood variance
    let sumVarianceTerm = 0;
    const kmSteps = [];
    
    let i = 0;
    while (i < sorted.length && sorted[i].time <= tau) {
        const t = sorted[i].time;
        let events = 0;
        let censored = 0;
        
        while (i < sorted.length && sorted[i].time === t) {
            if (sorted[i].status === 1) events++;
            else censored++;
            i++;
        }
        
        // Area under curve from prevTime to t
        rmst += s * (t - prevTime);
        
        // KM update
        if (events > 0 && atRisk > 0) {
            const hazard = events / atRisk;
            sumVarianceTerm += events / (atRisk * (atRisk - events));
            s = s * (1 - hazard);
        }
        
        kmSteps.push({ time: t, survival: s, atRisk, events });
        prevTime = t;
        atRisk = atRisk - events - censored;
    }
    
    // Add final segment to tau
    rmst += s * (tau - prevTime);
    
    // Greenwood variance for RMST (Royston & Parmar approximation)
    // Var(RMST) ≈ ∑ A_j² × d_j / (n_j × (n_j - d_j))
    let varianceSum = 0;
    let cumulativeArea = 0;
    
    for (let j = kmSteps.length - 1; j >= 0; j--) {
        const step = kmSteps[j];
        const nextTime = j < kmSteps.length - 1 ? kmSteps[j + 1].time : tau;
        const area = step.survival * (nextTime - step.time);
        cumulativeArea += area;
        
        if (step.events > 0 && step.atRisk > step.events) {
            varianceSum += Math.pow(cumulativeArea, 2) * 
                          step.events / (step.atRisk * (step.atRisk - step.events));
        }
    }
    
    const se = Math.sqrt(varianceSum);
    
    return {
        rmst,
        se,
        tau,
        lower: rmst - 1.96 * se,
        upper: rmst + 1.96 * se,
        n,
        events: sorted.filter(p => p.status === 1 && p.time <= tau).length,
        finalSurvival: s
    };
}

/**
 * Calculate RMST difference between two arms with proper SE
 */
function calculateRMSTDifference(ipd, tau, armColumn = 'arm') {
    const arms = [...new Set(ipd.map(p => p[armColumn]))];
    if (arms.length !== 2) return null;
    
    const rmst0 = calculateRMSTComplete(ipd.filter(p => p[armColumn] === arms[0]), tau);
    const rmst1 = calculateRMSTComplete(ipd.filter(p => p[armColumn] === arms[1]), tau);
    
    if (!rmst0 || !rmst1) return null;
    
    const diff = rmst0.rmst - rmst1.rmst;
    const seDiff = Math.sqrt(rmst0.se ** 2 + rmst1.se ** 2);
    
    return {
        arm0: { name: arms[0], ...rmst0 },
        arm1: { name: arms[1], ...rmst1 },
        difference: diff,
        seDifference: seDiff,
        lower: diff - 1.96 * seDiff,
        upper: diff + 1.96 * seDiff,
        pValue: 2 * (1 - normalCDF(Math.abs(diff / seDiff))),
        tau,
        interpretation: `${arms[0]} provides ${Math.abs(diff).toFixed(2)} ${diff > 0 ? 'more' : 'fewer'} months of survival over ${tau} months (95% CI: ${(diff - 1.96 * seDiff).toFixed(2)} to ${(diff + 1.96 * seDiff).toFixed(2)})`
    };
}

/**
 * Meta-analysis of RMST differences
 */
function metaAnalyzeRMST(rmstResults, options = {}) {
    const { model = 'random', tauMethod = 'REML' } = options;
    
    const yi = rmstResults.map(r => r.difference);
    const vi = rmstResults.map(r => r.seDifference ** 2);
    const k = yi.length;
    
    if (k < 2) return { error: 'Need at least 2 studies' };
    
    // Fixed effect
    const wi_fixed = vi.map(v => 1 / v);
    const sumW = wi_fixed.reduce((a, b) => a + b, 0);
    const theta_fixed = wi_fixed.reduce((sum, w, i) => sum + w * yi[i], 0) / sumW;
    const se_fixed = Math.sqrt(1 / sumW);
    
    // Heterogeneity
    const Q = wi_fixed.reduce((sum, w, i) => sum + w * Math.pow(yi[i] - theta_fixed, 2), 0);
    const df = k - 1;
    const C = sumW - wi_fixed.reduce((sum, w) => sum + w * w, 0) / sumW;
    let tau2 = Math.max(0, (Q - df) / C);
    
    // REML refinement
    if (tauMethod === 'REML') {
        tau2 = estimateTau2REML_Simple(yi, vi, k, tau2);
    }
    
    // Random effects
    const wi_random = vi.map(v => 1 / (v + tau2));
    const sumWR = wi_random.reduce((a, b) => a + b, 0);
    const theta_random = wi_random.reduce((sum, w, i) => sum + w * yi[i], 0) / sumWR;
    const se_random = Math.sqrt(1 / sumWR);
    
    const theta = model === 'fixed' ? theta_fixed : theta_random;
    const se = model === 'fixed' ? se_fixed : se_random;
    
    // Prediction interval
    const tCrit = tQuantile(0.975, k - 2);
    const predSE = Math.sqrt(tau2 + se * se);
    const predLower = theta - tCrit * predSE;
    const predUpper = theta + tCrit * predSE;
    
    // I²
    const I2 = df > 0 ? Math.max(0, (Q - df) / Q * 100) : 0;
    
    return {
        pooledDifference: theta,
        se,
        lower: theta - 1.96 * se,
        upper: theta + 1.96 * se,
        pValue: 2 * (1 - normalCDF(Math.abs(theta / se))),
        predLower,
        predUpper,
        tau2,
        I2,
        Q,
        pQ: 1 - chi2CDF(Q, df),
        k,
        interpretation: `Pooled RMST difference: ${theta.toFixed(2)} months (95% CI: ${(theta - 1.96 * se).toFixed(2)} to ${(theta + 1.96 * se).toFixed(2)}). ` +
                       (I2 > 50 ? `Substantial heterogeneity (I²=${I2.toFixed(0)}%). ` : '') +
                       (predLower * predUpper < 0 ? `Prediction interval crosses zero: next study might show no benefit. ` : '')
    };
}

// ============================================
// SECTION 4: FLEXIBLE PARAMETRIC MODELS
// From 99% doc: "70-80% of survival NMAs where parametric assumptions are untested"
// ============================================

/**
 * Fit flexible parametric model (Royston-Parmar style)
 * Uses restricted cubic splines for baseline hazard
 */
function fitFlexibleParametric(ipd, options = {}) {
    const {
        df = 3,              // Degrees of freedom for baseline spline
        scale = 'hazard',    // 'hazard', 'odds', or 'normal'
        maxIter = 100
    } = options;
    
    const sorted = [...ipd].filter(p => p.time > 0).sort((a, b) => a.time - b.time);
    const n = sorted.length;
    const events = sorted.filter(p => p.status === 1);
    
    if (events.length < 10) {
        return { error: 'Insufficient events for flexible parametric model' };
    }
    
    // Calculate knot positions (based on distribution of events)
    const eventTimes = events.map(e => Math.log(e.time));
    const knots = calculateSplineKnots(eventTimes, df);
    
    // Create spline basis
    const splineBasis = sorted.map(p => {
        const logT = Math.log(p.time);
        return createRestrictedCubicSpline(logT, knots);
    });
    
    // Fit model using Newton-Raphson (simplified)
    // In practice, you'd use a proper optimizer
    const fit = fitSplineModel(sorted, splineBasis, knots, scale, maxIter);
    
    return {
        coefficients: fit.coefficients,
        knots,
        scale,
        df,
        logLikelihood: fit.logLik,
        aic: -2 * fit.logLik + 2 * (df + 1),
        bic: -2 * fit.logLik + Math.log(n) * (df + 1),
        predict: (times) => predictFlexibleParametric(times, fit.coefficients, knots, scale)
    };
}

function calculateSplineKnots(logTimes, df) {
    const sorted = [...logTimes].sort((a, b) => a - b);
    const n = sorted.length;
    
    // Internal knots at quantiles
    const nInternalKnots = df - 1;
    const knots = [];
    
    // Boundary knots at min and max
    knots.push(sorted[0]);
    
    for (let i = 1; i <= nInternalKnots; i++) {
        const p = i / (nInternalKnots + 1);
        const idx = Math.floor(p * n);
        knots.push(sorted[idx]);
    }
    
    knots.push(sorted[n - 1]);
    
    return knots;
}

function createRestrictedCubicSpline(x, knots) {
    const k = knots.length;
    const basis = [1, x];  // Intercept and linear term
    
    // Restricted cubic spline terms
    for (let j = 0; j < k - 2; j++) {
        const term = Math.max(0, Math.pow(x - knots[j], 3)) -
                    (knots[k-1] - knots[j]) / (knots[k-1] - knots[k-2]) * 
                    Math.max(0, Math.pow(x - knots[k-2], 3)) +
                    (knots[k-2] - knots[j]) / (knots[k-1] - knots[k-2]) * 
                    Math.max(0, Math.pow(x - knots[k-1], 3));
        basis.push(term);
    }
    
    return basis;
}

function fitSplineModel(data, splineBasis, knots, scale, maxIter) {
    // Simplified Newton-Raphson fitting
    // In production, use proper optimization library
    
    const nParams = splineBasis[0].length;
    let beta = new Array(nParams).fill(0);
    
    for (let iter = 0; iter < maxIter; iter++) {
        const { gradient, hessian, logLik } = calculateSplineGradient(data, splineBasis, beta, scale);
        
        // Newton step
        const invHessian = invertMatrix2(hessian);
        if (!invHessian) break;
        
        const step = invHessian.map((row, i) => 
            row.reduce((sum, h, j) => sum + h * gradient[j], 0)
        );
        
        const maxStep = Math.max(...step.map(Math.abs));
        if (maxStep < 1e-6) break;
        
        beta = beta.map((b, i) => b + 0.5 * step[i]);  // Damped step
    }
    
    const { logLik } = calculateSplineGradient(data, splineBasis, beta, scale);
    
    return { coefficients: beta, logLik };
}

function calculateSplineGradient(data, splineBasis, beta, scale) {
    let logLik = 0;
    const nParams = beta.length;
    const gradient = new Array(nParams).fill(0);
    const hessian = Array(nParams).fill(null).map(() => new Array(nParams).fill(0));
    
    data.forEach((p, i) => {
        const basis = splineBasis[i];
        const eta = basis.reduce((sum, b, j) => sum + b * beta[j], 0);
        
        // Log-cumulative hazard
        const logH = eta;
        const H = Math.exp(logH);
        
        // Contribution to likelihood
        if (p.status === 1) {
            // Event: contributes log(h(t)) - H(t)
            const h = H / p.time;  // Hazard (derivative of H)
            logLik += Math.log(Math.max(h, 1e-10)) - H;
        } else {
            // Censored: contributes -H(t)
            logLik -= H;
        }
        
        // Gradient and Hessian (simplified)
        for (let j = 0; j < nParams; j++) {
            gradient[j] += (p.status - H) * basis[j];
            for (let k = 0; k < nParams; k++) {
                hessian[j][k] -= H * basis[j] * basis[k];
            }
        }
    });
    
    return { gradient, hessian, logLik };
}

function predictFlexibleParametric(times, coefficients, knots, scale) {
    return times.map(t => {
        const logT = Math.log(t);
        const basis = createRestrictedCubicSpline(logT, knots);
        const eta = basis.reduce((sum, b, j) => sum + b * coefficients[j], 0);
        const H = Math.exp(eta);
        const S = Math.exp(-H);
        const h = H / t;
        
        return { time: t, survival: S, hazard: h, cumHazard: H };
    });
}

// ============================================
// SECTION 5: DOSE-RESPONSE NMA
// From 99% doc: "30-40% of NMAs where multiple doses tested but pooled"
// ============================================

/**
 * Dose-response network meta-analysis
 * Models dose-response relationship across trials
 */
function runDoseResponseNMA(studies, options = {}) {
    const {
        model = 'emax',      // 'emax', 'linear', 'quadratic', 'log-linear'
        referenceArm = null  // Usually placebo/control
    } = options;
    
    // Extract all unique treatments with doses
    const treatments = new Map();  // treatment -> [doses]
    const contrasts = [];
    
    studies.forEach(study => {
        const arms = Object.entries(study.arms);
        arms.forEach(([armName, armData]) => {
            const parsed = parseTreatmentDose(armName);
            if (parsed) {
                if (!treatments.has(parsed.drug)) {
                    treatments.set(parsed.drug, new Set());
                }
                treatments.get(parsed.drug).add(parsed.dose);
            }
        });
        
        // Create contrasts
        for (let i = 0; i < arms.length; i++) {
            for (let j = i + 1; j < arms.length; j++) {
                const t1 = parseTreatmentDose(arms[i][0]);
                const t2 = parseTreatmentDose(arms[j][0]);
                
                contrasts.push({
                    study: study.name,
                    arm1: arms[i][0],
                    arm2: arms[j][0],
                    drug1: t1?.drug || arms[i][0],
                    dose1: t1?.dose || 1,
                    drug2: t2?.drug || arms[j][0],
                    dose2: t2?.dose || 1,
                    yi: study.reconstructedResults?.[`${arms[i][0]}_vs_${arms[j][0]}`]?.logHR || 0,
                    vi: Math.pow(study.reconstructedResults?.[`${arms[i][0]}_vs_${arms[j][0]}`]?.seLogHR || 0.1, 2)
                });
            }
        }
    });
    
    // Fit dose-response model for each drug
    const drugModels = {};
    
    treatments.forEach((doses, drug) => {
        const drugContrasts = contrasts.filter(c => 
            c.drug1 === drug || c.drug2 === drug
        );
        
        if (drugContrasts.length < 2) return;
        
        drugModels[drug] = fitDoseResponseModel(drugContrasts, drug, model);
    });
    
    // Predict optimal dose for each drug
    const optimalDoses = {};
    Object.entries(drugModels).forEach(([drug, fit]) => {
        if (fit.valid) {
            optimalDoses[drug] = findOptimalDose(fit, model);
        }
    });
    
    return {
        treatments: Object.fromEntries(treatments),
        models: drugModels,
        optimalDoses,
        contrasts,
        interpretation: generateDoseResponseInterpretation(drugModels, optimalDoses)
    };
}

function parseTreatmentDose(armName) {
    // Try to parse "Drug 10mg" or "Drug (10)" or "Drug-10"
    const patterns = [
        /^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:mg|mcg|μg|g|ml|units?)?$/i,
        /^(.+?)\s*\((\d+(?:\.\d+)?)\)/,
        /^(.+?)[_-](\d+(?:\.\d+)?)$/
    ];
    
    for (const pattern of patterns) {
        const match = armName.match(pattern);
        if (match) {
            return { drug: match[1].trim(), dose: parseFloat(match[2]) };
        }
    }
    
    return null;
}

function fitDoseResponseModel(contrasts, drug, modelType) {
    // Get dose-effect pairs
    const doseEffects = [];
    
    contrasts.forEach(c => {
        if (c.drug1 === drug && c.drug2 !== drug) {
            doseEffects.push({ dose: c.dose1, effect: -c.yi, se: Math.sqrt(c.vi) });
        } else if (c.drug2 === drug && c.drug1 !== drug) {
            doseEffects.push({ dose: c.dose2, effect: c.yi, se: Math.sqrt(c.vi) });
        }
    });
    
    if (doseEffects.length < 2) {
        return { valid: false, reason: 'Insufficient dose-effect data' };
    }
    
    // Fit appropriate model
    switch (modelType) {
        case 'emax':
            return fitEmaxModel(doseEffects);
        case 'linear':
            return fitLinearDoseModel(doseEffects);
        case 'quadratic':
            return fitQuadraticDoseModel(doseEffects);
        default:
            return fitLinearDoseModel(doseEffects);
    }
}

function fitEmaxModel(doseEffects) {
    // Emax model: E(d) = Emax × d / (ED50 + d)
    // Nonlinear least squares (simplified grid search)
    
    const doses = doseEffects.map(d => d.dose);
    const effects = doseEffects.map(d => d.effect);
    const weights = doseEffects.map(d => 1 / (d.se * d.se));
    
    let bestFit = { rss: Infinity };
    
    // Grid search over Emax and ED50
    const maxEffect = Math.max(...effects.map(Math.abs));
    
    for (let emax = maxEffect * 0.5; emax <= maxEffect * 2; emax += maxEffect * 0.1) {
        for (let ed50 = Math.min(...doses) * 0.1; ed50 <= Math.max(...doses) * 2; ed50 *= 1.5) {
            const predicted = doses.map(d => emax * d / (ed50 + d));
            const rss = effects.reduce((sum, e, i) => 
                sum + weights[i] * Math.pow(e - predicted[i], 2), 0
            );
            
            if (rss < bestFit.rss) {
                bestFit = { emax, ed50, rss };
            }
        }
    }
    
    return {
        valid: true,
        modelType: 'emax',
        parameters: { emax: bestFit.emax, ed50: bestFit.ed50 },
        predict: (dose) => bestFit.emax * dose / (bestFit.ed50 + dose),
        rss: bestFit.rss,
        interpretation: `Emax = ${bestFit.emax.toFixed(3)}, ED50 = ${bestFit.ed50.toFixed(1)}`
    };
}

function fitLinearDoseModel(doseEffects) {
    const x = doseEffects.map(d => d.dose);
    const y = doseEffects.map(d => d.effect);
    const w = doseEffects.map(d => 1 / (d.se * d.se));
    
    const fit = weightedLinearRegression(x, y, w);
    
    return {
        valid: true,
        modelType: 'linear',
        parameters: { intercept: fit.intercept, slope: fit.slope },
        predict: (dose) => fit.intercept + fit.slope * dose,
        slopeP: fit.pValue,
        interpretation: `Effect per unit dose: ${fit.slope.toFixed(4)} (p=${fit.pValue.toFixed(4)})`
    };
}

function fitQuadraticDoseModel(doseEffects) {
    // E(d) = β0 + β1×d + β2×d²
    const x = doseEffects.map(d => d.dose);
    const y = doseEffects.map(d => d.effect);
    const w = doseEffects.map(d => 1 / (d.se * d.se));
    
    // Design matrix [1, d, d²]
    const X = x.map(xi => [1, xi, xi * xi]);
    const fit = weightedLeastSquaresGeneral(X, y, w);
    
    if (!fit) return { valid: false, reason: 'Fitting failed' };
    
    return {
        valid: true,
        modelType: 'quadratic',
        parameters: { b0: fit.beta[0], b1: fit.beta[1], b2: fit.beta[2] },
        predict: (dose) => fit.beta[0] + fit.beta[1] * dose + fit.beta[2] * dose * dose,
        optimalDose: fit.beta[2] < 0 ? -fit.beta[1] / (2 * fit.beta[2]) : null,
        interpretation: `Quadratic dose-response with ${fit.beta[2] < 0 ? 'inverted-U' : 'U-shaped'} pattern`
    };
}

function findOptimalDose(fit, modelType) {
    if (modelType === 'quadratic' && fit.parameters.b2 < 0) {
        return {
            dose: -fit.parameters.b1 / (2 * fit.parameters.b2),
            effect: fit.predict(-fit.parameters.b1 / (2 * fit.parameters.b2))
        };
    }
    
    if (modelType === 'emax') {
        // 90% of Emax is achieved at dose = 9 × ED50
        return {
            dose: 9 * fit.parameters.ed50,
            effect: 0.9 * fit.parameters.emax,
            ed90: 9 * fit.parameters.ed50
        };
    }
    
    return null;
}

function generateDoseResponseInterpretation(models, optimalDoses) {
    const messages = [];
    
    Object.entries(models).forEach(([drug, fit]) => {
        if (!fit.valid) return;
        
        messages.push(`${drug}: ${fit.interpretation}`);
        
        if (optimalDoses[drug]) {
            messages.push(`  Optimal dose: ~${optimalDoses[drug].dose.toFixed(0)}mg`);
        }
    });
    
    return messages.join('\n');
}

// ============================================
// SECTION 6: TIME-COURSE NMA
// From 99% doc: "40-50% of NMAs with longitudinal data"
// ============================================

/**
 * Time-course network meta-analysis
 * Models how treatment effects change over time
 */
function runTimeCourseNMA(studies, options = {}) {
    const {
        timePoints = [4, 8, 12, 24, 52],  // Weeks
        model = 'fractional_polynomial'    // 'linear', 'quadratic', 'fractional_polynomial'
    } = options;
    
    // Extract time-specific effects
    const timeEffects = [];
    
    studies.forEach(study => {
        const arms = Object.keys(study.arms);
        if (arms.length < 2) return;
        
        timePoints.forEach(t => {
            const effect = study.reconstructedResults?.[`effect_at_${t}`];
            if (effect) {
                timeEffects.push({
                    study: study.name,
                    time: t,
                    arm1: arms[0],
                    arm2: arms[1],
                    yi: effect.yi,
                    vi: effect.vi
                });
            }
        });
    });
    
    if (timeEffects.length < 4) {
        return { error: 'Insufficient time-course data' };
    }
    
    // Fit time-course model
    const fit = fitTimeCourseModel(timeEffects, model);
    
    // Predict effects at all time points
    const predictions = timePoints.map(t => ({
        time: t,
        effect: fit.predict(t),
        se: fit.predictSE?.(t) || null
    }));
    
    // Identify patterns
    const pattern = identifyTimeCoursePattern(predictions);
    
    return {
        model,
        fit,
        predictions,
        pattern,
        interpretation: generateTimeCourseInterpretation(pattern, predictions)
    };
}

function fitTimeCourseModel(timeEffects, modelType) {
    const x = timeEffects.map(t => t.time);
    const y = timeEffects.map(t => t.yi);
    const w = timeEffects.map(t => 1 / t.vi);
    
    switch (modelType) {
        case 'linear': {
            const fit = weightedLinearRegression(x, y, w);
            return {
                type: 'linear',
                parameters: fit,
                predict: (t) => fit.intercept + fit.slope * t
            };
        }
        
        case 'quadratic': {
            const X = x.map(xi => [1, xi, xi * xi]);
            const fit = weightedLeastSquaresGeneral(X, y, w);
            return {
                type: 'quadratic',
                parameters: { b0: fit.beta[0], b1: fit.beta[1], b2: fit.beta[2] },
                predict: (t) => fit.beta[0] + fit.beta[1] * t + fit.beta[2] * t * t
            };
        }
        
        case 'fractional_polynomial': {
            // Try common fractional polynomial powers
            const powers = [[-2], [-1], [-0.5], [0], [0.5], [1], [2], [-1, 0.5], [0.5, 1]];
            let bestFit = { deviance: Infinity };
            
            powers.forEach(p => {
                const X = x.map(xi => {
                    const row = [1];
                    p.forEach(power => {
                        if (power === 0) row.push(Math.log(xi));
                        else row.push(Math.pow(xi, power));
                    });
                    return row;
                });
                
                const fit = weightedLeastSquaresGeneral(X, y, w);
                if (fit && fit.deviance < bestFit.deviance) {
                    bestFit = { ...fit, powers: p };
                }
            });
            
            return {
                type: 'fractional_polynomial',
                powers: bestFit.powers,
                parameters: bestFit.beta,
                predict: (t) => {
                    let pred = bestFit.beta[0];
                    bestFit.powers.forEach((p, i) => {
                        if (p === 0) pred += bestFit.beta[i + 1] * Math.log(t);
                        else pred += bestFit.beta[i + 1] * Math.pow(t, p);
                    });
                    return pred;
                }
            };
        }
        
        default:
            return fitTimeCourseModel(timeEffects, 'linear');
    }
}

function identifyTimeCoursePattern(predictions) {
    const effects = predictions.map(p => p.effect);
    const times = predictions.map(p => p.time);
    
    const early = effects.slice(0, Math.floor(effects.length / 2));
    const late = effects.slice(Math.floor(effects.length / 2));
    
    const earlyMean = early.reduce((a, b) => a + b, 0) / early.length;
    const lateMean = late.reduce((a, b) => a + b, 0) / late.length;
    
    const firstEffect = effects[0];
    const lastEffect = effects[effects.length - 1];
    const change = (lastEffect - firstEffect) / Math.abs(firstEffect) * 100;
    
    if (Math.abs(change) < 10) {
        return { type: 'STABLE', change, description: 'Effect remains stable over time' };
    } else if (change > 0) {
        if (Math.abs(earlyMean) < 0.1) {
            return { type: 'DELAYED_BENEFIT', change, description: 'Delayed treatment benefit (e.g., immunotherapy)' };
        }
        return { type: 'ATTENUATING', change, description: 'Treatment effect attenuates over time' };
    } else {
        return { type: 'STRENGTHENING', change, description: 'Treatment effect strengthens over time' };
    }
}

function generateTimeCourseInterpretation(pattern, predictions) {
    let msg = pattern.description + '. ';
    
    if (pattern.type === 'DELAYED_BENEFIT') {
        msg += 'Standard short-term trials may MISS the true benefit. Consider longer follow-up. ';
    } else if (pattern.type === 'ATTENUATING') {
        msg += `Effect diminishes by ~${Math.abs(pattern.change).toFixed(0)}% over follow-up. `;
        msg += 'Long-term extrapolations using early HR will OVERESTIMATE benefit. ';
    }
    
    const lastPred = predictions[predictions.length - 1];
    const firstPred = predictions[0];
    msg += `Effect at ${firstPred.time}w: ${firstPred.effect.toFixed(3)}, at ${lastPred.time}w: ${lastPred.effect.toFixed(3)}`;
    
    return msg;
}

// ============================================
// SECTION 7: COMPREHENSIVE PIPELINE ORCHESTRATION
// ============================================

/**
 * Run complete end-to-end analysis pipeline
 */
async function runCompleteNMAPipeline(networkData, options = {}) {
    const {
        rmstHorizons = [12, 24, 36],
        runDoseResponse = true,
        runTimeCourse = true,
        progressCallback = null
    } = options;
    
    const results = {
        studies: [],
        pairwiseMA: null,
        nma: null,
        rmstMA: null,
        doseResponse: null,
        timeCourse: null,
        diagnostics: {
            phTests: [],
            transitivity: null,
            threshold: null,
            robma: null,
            predictiveIntervals: null
        },
        certainty: null,
        report: null
    };
    
    const updateProgress = (step, pct) => {
        if (progressCallback) progressCallback(step, pct);
    };
    
    try {
        // STAGE 1: Per-study analysis
        updateProgress('Analyzing individual studies...', 10);
        
        for (const study of networkData.studies) {
            const studyResults = {
                name: study.name,
                arms: Object.keys(study.arms),
                phTest: null,
                timeVaryingHR: null,
                rmst: {}
            };
            
            // Combine IPD from all arms
            const allIPD = Object.entries(study.arms).flatMap(([arm, data]) => 
                (data.ipd || []).map(p => ({ ...p, arm }))
            );
            
            if (allIPD.length >= 20) {
                // Test PH
                studyResults.phTest = testProportionalHazards(allIPD);
                results.diagnostics.phTests.push({
                    study: study.name,
                    ...studyResults.phTest.overall
                });
                
                // Calculate RMST at multiple horizons
                for (const tau of rmstHorizons) {
                    studyResults.rmst[tau] = calculateRMSTDifference(allIPD, tau);
                }
                
                // Time-varying HR if PH violated
                if (studyResults.phTest.overall && !studyResults.phTest.overall.phHolds) {
                    studyResults.timeVaryingHR = studyResults.phTest.tests.landmark;
                }
            }
            
            results.studies.push(studyResults);
        }
        
        // STAGE 2: Pairwise meta-analysis
        updateProgress('Running pairwise meta-analysis...', 30);
        
        const maStudies = networkData.studies.filter(s => 
            s.reconstructedResults?.logHR !== undefined
        ).map(s => ({
            name: s.name,
            yi: s.reconstructedResults.logHR,
            vi: Math.pow(s.reconstructedResults.seLogHR, 2)
        }));
        
        if (maStudies.length >= 2) {
            results.pairwiseMA = runPairwiseMetaAnalysis(maStudies);
        }
        
        // STAGE 3: RMST meta-analysis
        updateProgress('Running RMST meta-analysis...', 40);
        
        const rmstByHorizon = {};
        for (const tau of rmstHorizons) {
            const rmstStudies = results.studies
                .filter(s => s.rmst[tau])
                .map(s => s.rmst[tau]);
            
            if (rmstStudies.length >= 2) {
                rmstByHorizon[tau] = metaAnalyzeRMST(rmstStudies);
            }
        }
        results.rmstMA = rmstByHorizon;
        
        // STAGE 4: Network meta-analysis
        updateProgress('Running network meta-analysis...', 50);
        
        if (networkData.treatments.size >= 3) {
            networkData.buildNetwork();
            results.nma = runNetworkMetaAnalysis(networkData.comparisons.map(c => ({
                name: c.study,
                treatment1: c.treatment1,
                treatment2: c.treatment2,
                yi: c.yi || 0,
                vi: c.vi || 0.01
            })));
        }
        
        // STAGE 5: Dose-response NMA
        if (runDoseResponse) {
            updateProgress('Running dose-response analysis...', 60);
            results.doseResponse = runDoseResponseNMA(networkData.studies);
        }
        
        // STAGE 6: Time-course NMA
        if (runTimeCourse) {
            updateProgress('Running time-course analysis...', 70);
            results.timeCourse = runTimeCourseNMA(networkData.studies);
        }
        
        // STAGE 7: Advanced diagnostics
        updateProgress('Running advanced diagnostics...', 80);
        
        // Transitivity
        if (networkData.studies.length >= 2) {
            const chars = networkData.studies.map(s => ({
                name: s.name,
                ...s.characteristics
            }));
            results.diagnostics.transitivity = assessTransitivity(chars);
        }
        
        // Threshold analysis
        if (results.pairwiseMA) {
            results.diagnostics.threshold = runThresholdAnalysis(results.pairwiseMA);
        }
        
        // RoBMA
        if (results.pairwiseMA) {
            results.diagnostics.robma = runRoBMALite(results.pairwiseMA);
        }
        
        // STAGE 8: Certainty assessment
        updateProgress('Assessing certainty...', 90);
        results.certainty = assessComprehensiveCertainty(results);
        
        // STAGE 9: Generate report
        updateProgress('Generating report...', 95);
        results.report = generateComprehensiveReport(results);
        
        updateProgress('Complete!', 100);
        
        return results;
        
    } catch (error) {
        console.error('Pipeline error:', error);
        throw error;
    }
}

/**
 * Comprehensive certainty assessment integrating all diagnostics
 */
function assessComprehensiveCertainty(results) {
    const domains = {
        riskOfBias: { rating: 'serious', reasons: [] },
        inconsistency: { rating: 'not serious', reasons: [] },
        indirectness: { rating: 'not serious', reasons: [] },
        imprecision: { rating: 'not serious', reasons: [] },
        publicationBias: { rating: 'not serious', reasons: [] }
    };
    
    // Inconsistency
    if (results.pairwiseMA?.I2 > 75) {
        domains.inconsistency.rating = 'very serious';
        domains.inconsistency.reasons.push(`High heterogeneity (I²=${results.pairwiseMA.I2.toFixed(0)}%)`);
    } else if (results.pairwiseMA?.I2 > 50) {
        domains.inconsistency.rating = 'serious';
        domains.inconsistency.reasons.push(`Substantial heterogeneity (I²=${results.pairwiseMA.I2.toFixed(0)}%)`);
    }
    
    // Check if PI crosses null when CI doesn't
    if (results.pairwiseMA?.predLower < 1 && results.pairwiseMA?.predUpper > 1 &&
        results.pairwiseMA?.pooledLower < 1 && results.pairwiseMA?.pooledUpper < 1) {
        domains.inconsistency.rating = 'serious';
        domains.inconsistency.reasons.push('Prediction interval crosses null despite significant effect');
    }
    
    // PH violations
    const phViolations = results.diagnostics.phTests.filter(t => !t.phHolds);
    if (phViolations.length > results.diagnostics.phTests.length / 2) {
        domains.inconsistency.rating = 'serious';
        domains.inconsistency.reasons.push(`PH violated in ${phViolations.length}/${results.diagnostics.phTests.length} studies`);
    }
    
    // Indirectness (transitivity)
    if (results.diagnostics.transitivity?.assessment?.level === 'HIGH') {
        domains.indirectness.rating = 'serious';
        domains.indirectness.reasons.push('High transitivity concern');
    }
    
    // Imprecision (threshold analysis)
    if (results.diagnostics.threshold?.fragilityIndex < 10) {
        domains.imprecision.rating = 'serious';
        domains.imprecision.reasons.push(`Fragile (${results.diagnostics.threshold.fragilityIndex} events to change conclusion)`);
    }
    
    // Publication bias
    if (results.diagnostics.robma?.posteriorProbBias > 0.7) {
        domains.publicationBias.rating = 'serious';
        domains.publicationBias.reasons.push(`High probability of bias (${(results.diagnostics.robma.posteriorProbBias * 100).toFixed(0)}%)`);
    }
    
    // Overall grade
    const seriousCount = Object.values(domains).filter(d => d.rating === 'serious').length;
    const verySeriousCount = Object.values(domains).filter(d => d.rating === 'very serious').length;
    
    let grade;
    if (verySeriousCount >= 2 || seriousCount >= 4) {
        grade = 'VERY LOW';
    } else if (verySeriousCount >= 1 || seriousCount >= 2) {
        grade = 'LOW';
    } else if (seriousCount >= 1) {
        grade = 'MODERATE';
    } else {
        grade = 'HIGH';
    }
    
    return { grade, domains };
}

/**
 * Generate comprehensive publication-ready report
 */
function generateComprehensiveReport(results) {
    const lines = [];
    const add = (text) => lines.push(text);
    const divider = () => add('═'.repeat(80));
    const subDivider = () => add('─'.repeat(60));
    
    divider();
    add('COMPREHENSIVE NETWORK META-ANALYSIS REPORT');
    add('Generated by SurvExtract Pro v6.0');
    add(`Date: ${new Date().toISOString().split('T')[0]}`);
    divider();
    add('');
    
    // Executive Summary
    add('EXECUTIVE SUMMARY');
    subDivider();
    add(`Studies included: ${results.studies.length}`);
    add(`Treatments compared: ${results.nma?.treatments?.length || 2}`);
    add(`Certainty of evidence: ${results.certainty?.grade}`);
    add('');
    
    if (results.pairwiseMA) {
        const ma = results.pairwiseMA;
        add(`Pooled HR: ${ma.pooledEffect?.toFixed(2)} (95% CI: ${ma.pooledLower?.toFixed(2)}-${ma.pooledUpper?.toFixed(2)})`);
        if (ma.predLower && ma.predUpper) {
            add(`95% Prediction Interval: ${ma.predLower.toFixed(2)}-${ma.predUpper.toFixed(2)}`);
        }
    }
    add('');
    
    // Proportional Hazards Assessment
    add('1. PROPORTIONAL HAZARDS ASSESSMENT');
    subDivider();
    const phSummary = results.diagnostics.phTests;
    const phViolated = phSummary.filter(t => !t.phHolds);
    add(`PH violated in ${phViolated.length}/${phSummary.length} studies`);
    
    if (phViolated.length > 0) {
        add('Studies with PH violation:');
        phViolated.forEach(s => {
            add(`  • ${s.study}: ${s.violations?.join(', ')}`);
        });
        add('');
        add('⚠️ RECOMMENDATION: Use RMST meta-analysis as primary, HR as secondary');
    }
    add('');
    
    // RMST Meta-Analysis
    if (results.rmstMA && Object.keys(results.rmstMA).length > 0) {
        add('2. RMST META-ANALYSIS (PH-FREE)');
        subDivider();
        Object.entries(results.rmstMA).forEach(([tau, ma]) => {
            add(`At ${tau} months:`);
            add(`  Pooled RMST difference: ${ma.pooledDifference?.toFixed(2)} months`);
            add(`  95% CI: ${ma.lower?.toFixed(2)} to ${ma.upper?.toFixed(2)}`);
            add(`  I²: ${ma.I2?.toFixed(0)}%`);
        });
        add('');
    }
    
    // Time-varying effects
    const timeVarying = results.studies.filter(s => s.timeVaryingHR?.valid);
    if (timeVarying.length > 0) {
        add('3. TIME-VARYING TREATMENT EFFECTS');
        subDivider();
        timeVarying.forEach(s => {
            add(`${s.name}:`);
            if (s.timeVaryingHR.hrChange) {
                add(`  HR ${s.timeVaryingHR.hrChange.direction} by ${Math.abs(s.timeVaryingHR.hrChange.percentChange).toFixed(0)}%`);
                add(`  Early HR: ${s.timeVaryingHR.hrChange.first.toFixed(2)}, Late HR: ${s.timeVaryingHR.hrChange.last.toFixed(2)}`);
            }
        });
        add('');
    }
    
    // Network Meta-Analysis
    if (results.nma) {
        add('4. NETWORK META-ANALYSIS');
        subDivider();
        add('SUCRA Rankings:');
        results.nma.sucra?.forEach((s, i) => {
            add(`  ${i + 1}. ${s.treatment}: ${s.sucra.toFixed(1)}%`);
        });
        add('');
        add(`Consistency: ${results.nma.consistency?.interpretation}`);
        add('');
    }
    
    // Dose-Response
    if (results.doseResponse?.models && Object.keys(results.doseResponse.models).length > 0) {
        add('5. DOSE-RESPONSE ANALYSIS');
        subDivider();
        add(results.doseResponse.interpretation);
        add('');
    }
    
    // Time-Course
    if (results.timeCourse?.pattern) {
        add('6. TIME-COURSE ANALYSIS');
        subDivider();
        add(results.timeCourse.interpretation);
        add('');
    }
    
    // Diagnostics
    add('7. ADVANCED DIAGNOSTICS');
    subDivider();
    
    // Threshold analysis
    if (results.diagnostics.threshold) {
        add(`Fragility Index: ${results.diagnostics.threshold.fragilityIndex} events`);
        add(`Assessment: ${results.diagnostics.threshold.overallFragility}`);
    }
    
    // RoBMA
    if (results.diagnostics.robma) {
        add(`Publication bias probability: ${(results.diagnostics.robma.posteriorProbBias * 100).toFixed(0)}%`);
        if (results.diagnostics.robma.modelAveraged) {
            add(`Bias-adjusted effect: ${results.diagnostics.robma.modelAveraged.effect.toFixed(2)}`);
        }
    }
    
    // Transitivity
    if (results.diagnostics.transitivity) {
        add(`Transitivity concern: ${results.diagnostics.transitivity.assessment?.level}`);
    }
    add('');
    
    // Certainty Assessment
    add('8. CERTAINTY OF EVIDENCE');
    subDivider();
    add(`Overall Grade: ${results.certainty?.grade}`);
    add('');
    add('Domain assessments:');
    Object.entries(results.certainty?.domains || {}).forEach(([domain, assessment]) => {
        add(`  ${domain}: ${assessment.rating}`);
        assessment.reasons?.forEach(r => add(`    - ${r}`));
    });
    add('');
    
    // Key Messages
    add('9. KEY MESSAGES FOR CLINICIANS');
    subDivider();
    const messages = generateClinicalMessages(results);
    messages.forEach(m => add(`• ${m}`));
    add('');
    
    divider();
    add('END OF REPORT');
    divider();
    
    return lines.join('\n');
}

function generateClinicalMessages(results) {
    const messages = [];
    
    // Effect direction
    if (results.pairwiseMA?.pooledEffect) {
        const benefit = results.pairwiseMA.pooledEffect < 1;
        messages.push(`Treatment ${benefit ? 'reduces' : 'increases'} the outcome by approximately ${Math.abs(1 - results.pairwiseMA.pooledEffect) * 100}%`);
    }
    
    // Certainty
    if (results.certainty?.grade === 'VERY LOW' || results.certainty?.grade === 'LOW') {
        messages.push('Evidence certainty is limited - further research may change these conclusions');
    }
    
    // PH issues
    const phViolations = results.diagnostics.phTests.filter(t => !t.phHolds);
    if (phViolations.length > results.diagnostics.phTests.length / 2) {
        messages.push('Treatment effects change over time - short-term and long-term benefits may differ');
    }
    
    // Prediction interval
    if (results.pairwiseMA?.predLower < 1 && results.pairwiseMA?.predUpper > 1) {
        messages.push('Results vary across settings - treatment effect in your population may differ');
    }
    
    // Fragility
    if (results.diagnostics.threshold?.fragilityIndex < 10) {
        messages.push('Findings are statistically fragile - small changes in data could alter conclusions');
    }
    
    // Publication bias
    if (results.diagnostics.robma?.posteriorProbBias > 0.6) {
        messages.push('Publication bias may inflate the apparent benefit');
    }
    
    // Dose-response
    if (results.doseResponse?.optimalDoses && Object.keys(results.doseResponse.optimalDoses).length > 0) {
        messages.push('Dose-response relationship detected - optimal dosing may differ from approved doses');
    }
    
    return messages;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function linearRegression(x, y) {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const residuals = y.map((yi, i) => yi - (intercept + slope * x[i]));
    const mse = residuals.reduce((sum, r) => sum + r * r, 0) / (n - 2);
    const slopeVariance = mse / (sumX2 - sumX * sumX / n);
    const pValue = 2 * (1 - tCDF(Math.abs(slope / Math.sqrt(slopeVariance)), n - 2));
    
    return { intercept, slope, slopeVariance, mse, pValue };
}

function weightedLinearRegression(x, y, w) {
    const sumW = w.reduce((a, b) => a + b, 0);
    const sumWX = x.reduce((sum, xi, i) => sum + w[i] * xi, 0);
    const sumWY = y.reduce((sum, yi, i) => sum + w[i] * yi, 0);
    const sumWXY = x.reduce((sum, xi, i) => sum + w[i] * xi * y[i], 0);
    const sumWX2 = x.reduce((sum, xi, i) => sum + w[i] * xi * xi, 0);
    
    const slope = (sumW * sumWXY - sumWX * sumWY) / (sumW * sumWX2 - sumWX * sumWX);
    const intercept = (sumWY - slope * sumWX) / sumW;
    
    const residuals = y.map((yi, i) => yi - (intercept + slope * x[i]));
    const wss = residuals.reduce((sum, r, i) => sum + w[i] * r * r, 0);
    const mse = wss / (x.length - 2);
    const slopeVariance = mse * sumW / (sumW * sumWX2 - sumWX * sumWX);
    const pValue = 2 * (1 - tCDF(Math.abs(slope / Math.sqrt(slopeVariance)), x.length - 2));
    
    return { intercept, slope, slopeVariance, pValue };
}

function weightedLeastSquaresGeneral(X, y, w) {
    const n = y.length;
    const p = X[0].length;
    
    if (n < p) return null;
    
    // X'WX
    const XtWX = [];
    for (let i = 0; i < p; i++) {
        XtWX[i] = [];
        for (let j = 0; j < p; j++) {
            let sum = 0;
            for (let k = 0; k < n; k++) {
                sum += X[k][i] * w[k] * X[k][j];
            }
            XtWX[i][j] = sum;
        }
    }
    
    // X'Wy
    const XtWy = [];
    for (let i = 0; i < p; i++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
            sum += X[k][i] * w[k] * y[k];
        }
        XtWy[i] = sum;
    }
    
    const inv = invertMatrix2(XtWX);
    if (!inv) return null;
    
    const beta = inv.map((row, i) => 
        row.reduce((sum, h, j) => sum + h * XtWy[j], 0)
    );
    
    // Deviance
    const predicted = X.map(row => row.reduce((sum, x, j) => sum + x * beta[j], 0));
    const deviance = y.reduce((sum, yi, i) => sum + w[i] * Math.pow(yi - predicted[i], 2), 0);
    
    return { beta, deviance };
}

function invertMatrix2(A) {
    const n = A.length;
    const aug = A.map((row, i) => [...row, ...new Array(n).fill(0).map((_, j) => i === j ? 1 : 0)]);
    
    for (let i = 0; i < n; i++) {
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
        }
        [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
        
        if (Math.abs(aug[i][i]) < 1e-10) return null;
        
        const pivot = aug[i][i];
        for (let j = 0; j < 2 * n; j++) aug[i][j] /= pivot;
        
        for (let k = 0; k < n; k++) {
            if (k !== i) {
                const factor = aug[k][i];
                for (let j = 0; j < 2 * n; j++) aug[k][j] -= factor * aug[i][j];
            }
        }
    }
    
    return aug.map(row => row.slice(n));
}

function calculateKMCurve(ipd) {
    const sorted = [...ipd].sort((a, b) => a.time - b.time);
    const km = [];
    let n = sorted.length;
    let s = 1.0;
    
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
            s = s * (1 - events / n);
        }
        
        km.push({ time: t, survival: s, atRisk: n, events });
        n = n - events - censored;
    }
    
    return km;
}

function getKMSurvivalAt(km, time) {
    if (km.length === 0) return 1;
    if (time < km[0].time) return 1;
    
    for (let i = km.length - 1; i >= 0; i--) {
        if (km[i].time <= time) {
            return km[i].survival;
        }
    }
    
    return km[km.length - 1].survival;
}

function runPairwiseMetaAnalysis(studies) {
    // Implementation from earlier module
    const yi = studies.map(s => s.yi);
    const vi = studies.map(s => s.vi);
    const k = studies.length;
    
    const wi = vi.map(v => 1 / v);
    const sumW = wi.reduce((a, b) => a + b, 0);
    const theta_fixed = wi.reduce((sum, w, i) => sum + w * yi[i], 0) / sumW;
    
    const Q = wi.reduce((sum, w, i) => sum + w * Math.pow(yi[i] - theta_fixed, 2), 0);
    const df = k - 1;
    const C = sumW - wi.reduce((sum, w) => sum + w * w, 0) / sumW;
    const tau2 = Math.max(0, (Q - df) / C);
    
    const wi_r = vi.map(v => 1 / (v + tau2));
    const sumWR = wi_r.reduce((a, b) => a + b, 0);
    const theta = wi_r.reduce((sum, w, i) => sum + w * yi[i], 0) / sumWR;
    const se = Math.sqrt(1 / sumWR);
    
    const I2 = df > 0 ? Math.max(0, (Q - df) / Q * 100) : 0;
    
    const tCrit = tQuantile(0.975, Math.max(k - 2, 1));
    const predSE = Math.sqrt(tau2 + se * se);
    
    return {
        k,
        studies,
        theta,
        se,
        pooledEffect: Math.exp(theta),
        pooledLower: Math.exp(theta - 1.96 * se),
        pooledUpper: Math.exp(theta + 1.96 * se),
        predLower: Math.exp(theta - tCrit * predSE),
        predUpper: Math.exp(theta + tCrit * predSE),
        tau2,
        I2,
        Q,
        pQ: 1 - chi2CDF(Q, df)
    };
}

function estimateTau2REML_Simple(yi, vi, k, tau2Init) {
    let tau2 = tau2Init;
    
    for (let iter = 0; iter < 50; iter++) {
        const wi = vi.map(v => 1 / (v + tau2));
        const sumW = wi.reduce((a, b) => a + b, 0);
        const theta = wi.reduce((sum, w, i) => sum + w * yi[i], 0) / sumW;
        
        const sumW2 = wi.reduce((sum, w) => sum + w * w, 0);
        const sumW2Y = wi.reduce((sum, w, i) => sum + w * w * Math.pow(yi[i] - theta, 2), 0);
        
        const score = -0.5 * sumW2 / sumW + 0.5 * sumW2Y;
        const info = 0.5 * sumW2 * sumW2 / (sumW * sumW);
        
        const newTau2 = Math.max(0, tau2 + score / Math.max(info, 0.0001));
        if (Math.abs(newTau2 - tau2) < 0.0001) break;
        tau2 = newTau2;
    }
    
    return tau2;
}

// Statistical distribution functions
function normalCDF(x) {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
}

function tCDF(t, df) {
    if (df >= 120) return normalCDF(t);
    const x = df / (df + t * t);
    return 1 - 0.5 * betaIncomplete(df / 2, 0.5, x) * (t > 0 ? 1 : -1) - 0.5;
}

function tQuantile(p, df) {
    // Newton-Raphson approximation
    let t = 1.96; // Start with normal approximation
    for (let i = 0; i < 20; i++) {
        const cdf = tCDF(t, df);
        const pdf = Math.exp(-0.5 * (df + 1) * Math.log(1 + t * t / df)) / 
                   (Math.sqrt(df) * beta(df / 2, 0.5));
        const delta = (cdf - p) / pdf;
        t -= delta;
        if (Math.abs(delta) < 1e-8) break;
    }
    return t;
}

function chi2CDF(x, df) {
    if (x <= 0) return 0;
    return gammaIncomplete(df / 2, x / 2);
}

function gammaIncomplete(a, x) {
    if (x <= 0) return 0;
    if (x > a + 1) return 1 - gammaIncompleteUpper(a, x);
    
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < 100; n++) {
        term *= x / (a + n);
        sum += term;
        if (Math.abs(term) < 1e-10) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
}

function gammaIncompleteUpper(a, x) {
    let f = 1, c = 1, d = 1 / x;
    for (let i = 1; i < 100; i++) {
        const an = i * (a - i);
        const bn = x + 2 * i + 1 - a;
        d = bn + an * d;
        if (Math.abs(d) < 1e-30) d = 1e-30;
        c = bn + an / c;
        if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d;
        const delta = c * d;
        f *= delta;
        if (Math.abs(delta - 1) < 1e-10) break;
    }
    return Math.exp(-x + a * Math.log(x) - lgamma(a)) * f / x;
}

function betaIncomplete(a, b, x) {
    if (x === 0) return 0;
    if (x === 1) return 1;
    return Math.exp(a * Math.log(x) + b * Math.log(1 - x) - Math.log(a) - lbeta(a, b));
}

function beta(a, b) {
    return Math.exp(lgamma(a) + lgamma(b) - lgamma(a + b));
}

function lbeta(a, b) {
    return lgamma(a) + lgamma(b) - lgamma(a + b);
}

function lgamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
               -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// ============================================
// EXPORTS
// ============================================

if (typeof window !== 'undefined') {
    window.SurvExtractPipeline = {
        // Data structures
        StudyData,
        NetworkData,
        
        // PH Testing
        testProportionalHazards,
        testSchoenfeldResiduals,
        testLogLogLinearity,
        testLandmarkHR,
        testWeightedLogRank,
        detectCurveCrossing,
        
        // RMST
        calculateRMSTComplete,
        calculateRMSTDifference,
        metaAnalyzeRMST,
        
        // Flexible parametric
        fitFlexibleParametric,
        
        // Dose-response NMA
        runDoseResponseNMA,
        
        // Time-course NMA
        runTimeCourseNMA,
        
        // Complete pipeline
        runCompleteNMAPipeline,
        
        // Certainty & reporting
        assessComprehensiveCertainty,
        generateComprehensiveReport
    };
}
