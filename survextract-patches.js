// ============================================
// SurvExtract Pro v6.0 - CRITICAL BUG FIXES
// Apply these patches to the enhancement modules
// ============================================

// ============================================
// PATCH 1: Fix self-reference bug in runThresholdAnalysis
// File: survextract-advanced-nma-module.js
// Lines: ~114-124
// ============================================

// REPLACE the invariant interval section with:
function runThresholdAnalysis_FIXED(metaResults) {
    if (!metaResults || metaResults.k < 2) {
        return { error: 'Need at least 2 studies for threshold analysis' };
    }
    
    const { studies, theta, se, tau2, pooledEffect, pooledP, effectMeasure } = metaResults;
    const yi = studies.map(s => s.yi);
    const vi = studies.map(s => s.vi);
    const k = studies.length;
    
    const results = {
        studyThresholds: [],
        significanceThreshold: null,
        nullThreshold: null,
        overallFragility: '',
        fragilityIndex: 0
    };
    
    const isCurrentlySignificant = pooledP < 0.05;
    const targetZ = isCurrentlySignificant ? 1.96 : 1.97;
    
    studies.forEach((study, i) => {
        const wi = 1 / (vi[i] + tau2);
        const totalW = vi.map((v, j) => 1 / (v + tau2)).reduce((a, b) => a + b, 0);
        const contribution = wi / totalW;
        
        const otherContribution = yi.reduce((sum, y, j) => {
            if (j === i) return sum;
            const wj = 1 / (vi[j] + tau2);
            return sum + wj * y;
        }, 0);
        
        const targetTheta = targetZ * se * (isCurrentlySignificant ? Math.sign(theta) : -Math.sign(theta));
        const requiredYi = (targetTheta * totalW - otherContribution) / wi;
        const deltaYi = requiredYi - yi[i];
        
        // FIX: Add null checks for event counts
        const events = (study.events_treatment || 0) + (study.events_control || 0);
        const totalN = (study.n_treatment || 0) + (study.n_control || 0);
        
        // FIX: Handle missing event counts with variance-based approximation
        let deltaEvents;
        if (events > 0) {
            deltaEvents = Math.round(deltaYi * events);
        } else {
            // Approximate using information: Var(logHR) ≈ 4/events
            deltaEvents = Math.round(Math.abs(deltaYi) * 4 / vi[i]);
        }
        
        results.studyThresholds.push({
            study: study.name,
            currentYi: yi[i],
            currentEffect: effectMeasure === 'rmst' ? yi[i] : Math.exp(yi[i]),
            requiredYi: requiredYi,
            requiredEffect: effectMeasure === 'rmst' ? requiredYi : Math.exp(requiredYi),
            deltaYi: deltaYi,
            deltaEvents: deltaEvents,
            contribution: contribution * 100,
            wouldChangeSignificance: events > 0 ? Math.abs(deltaEvents) < events * 0.2 : null
        });
    });
    
    results.studyThresholds.sort((a, b) => Math.abs(a.deltaEvents) - Math.abs(b.deltaEvents));
    
    const validDeltas = results.studyThresholds.filter(s => !isNaN(s.deltaEvents));
    const minDelta = validDeltas.length > 0 
        ? Math.min(...validDeltas.map(s => Math.abs(s.deltaEvents)))
        : Infinity;
    results.fragilityIndex = minDelta;
    
    if (minDelta <= 5) {
        results.overallFragility = 'HIGHLY FRAGILE';
        results.fragilityColor = 'var(--accent-red)';
    } else if (minDelta <= 15) {
        results.overallFragility = 'MODERATELY FRAGILE';
        results.fragilityColor = 'var(--accent-orange)';
    } else if (minDelta <= 30) {
        results.overallFragility = 'SOMEWHAT ROBUST';
        results.fragilityColor = 'var(--accent-yellow)';
    } else {
        results.overallFragility = 'ROBUST';
        results.fragilityColor = 'var(--accent-green)';
    }
    
    // FIX: Calculate values before using them
    const invLower = theta - targetZ * se;
    const invUpper = theta + targetZ * se;
    results.invariantInterval = {
        lower: invLower,
        upper: invUpper,
        interpretation: `Conclusion holds if true effect is between ${
            effectMeasure === 'rmst' ? invLower.toFixed(2) : Math.exp(invLower).toFixed(2)
        } and ${
            effectMeasure === 'rmst' ? invUpper.toFixed(2) : Math.exp(invUpper).toFixed(2)
        }`
    };
    
    return results;
}


// ============================================
// PATCH 2: Fix CEN-KM division by zero
// File: survextract-v52-enhancements.js
// Lines: ~868-879
// ============================================

function evaluateCENKMCandidate_FIXED(nAtRisk, events, censors, sStart, sTarget) {
    // Guard against edge cases
    if (nAtRisk <= 0) {
        return { survival: 0, error: Math.abs(sTarget), effectiveN: 0, safeEvents: 0 };
    }
    
    const effectiveN = Math.max(1, nAtRisk - censors);
    
    // Prevent events from exceeding effective sample size
    const safeEvents = Math.min(events, Math.max(0, effectiveN - 1));
    
    // KM formula: S(t) = S(t-1) * (n - d) / n
    const conditionalS = (effectiveN - safeEvents) / effectiveN;
    const predictedS = sStart * conditionalS;
    
    // Use relative error for small survival values to avoid numerical issues
    let error;
    if (sTarget > 0.05) {
        error = Math.abs(predictedS - sTarget);
    } else if (sTarget > 0.001) {
        // Relative error for small values
        error = Math.abs(predictedS - sTarget) / sTarget;
    } else {
        // Both very small - use absolute
        error = Math.abs(predictedS - sTarget);
    }
    
    return { 
        survival: predictedS, 
        error,
        effectiveN,
        safeEvents,
        eventsCapped: safeEvents !== events
    };
}


// ============================================
// PATCH 3: Fix incomplete beta function
// File: survextract-complete-pipeline.js (and survextract-advanced-nma-module.js)
// ============================================

/**
 * Regularized incomplete beta function I_x(a,b)
 * Using continued fraction expansion (Lentz's algorithm)
 */
function betaIncomplete_FIXED(a, b, x) {
    if (x < 0 || x > 1) return NaN;
    if (x === 0) return 0;
    if (x === 1) return 1;
    
    // Use symmetry for numerical stability
    if (x > (a + 1) / (a + b + 2)) {
        return 1 - betaIncomplete_FIXED(b, a, 1 - x);
    }
    
    // Log of beta function normalizing constant
    const lnBeta = lgamma(a) + lgamma(b) - lgamma(a + b);
    
    // Front factor
    const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta) / a;
    
    // Continued fraction using modified Lentz's algorithm
    const TINY = 1e-30;
    const EPS = 1e-10;
    const MAX_ITER = 200;
    
    let f = 1, c = 1, d = 0;
    
    for (let m = 0; m <= MAX_ITER; m++) {
        const m2 = 2 * m;
        
        // Even term a_{2m}
        let numerator;
        if (m === 0) {
            numerator = 1;
        } else {
            numerator = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
        }
        
        d = 1 + numerator * d;
        if (Math.abs(d) < TINY) d = TINY;
        d = 1 / d;
        
        c = 1 + numerator / c;
        if (Math.abs(c) < TINY) c = TINY;
        
        f *= d * c;
        
        // Odd term a_{2m+1}
        numerator = -((a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
        
        d = 1 + numerator * d;
        if (Math.abs(d) < TINY) d = TINY;
        d = 1 / d;
        
        c = 1 + numerator / c;
        if (Math.abs(c) < TINY) c = TINY;
        
        const delta = d * c;
        f *= delta;
        
        if (Math.abs(delta - 1) < EPS) break;
    }
    
    return front * f;
}

/**
 * Fixed t-distribution CDF
 */
function tCDF_FIXED(t, df) {
    if (df <= 0) return NaN;
    if (!isFinite(t)) return t > 0 ? 1 : 0;
    
    // Use normal approximation for large df
    if (df >= 1000) return normalCDF(t);
    
    const x = df / (df + t * t);
    const beta = betaIncomplete_FIXED(df / 2, 0.5, x);
    
    if (t >= 0) {
        return 1 - 0.5 * beta;
    } else {
        return 0.5 * beta;
    }
}

/**
 * Fixed chi-squared CDF
 */
function chi2CDF_FIXED(x, df) {
    if (x <= 0) return 0;
    if (df <= 0) return NaN;
    
    // Chi-squared is Gamma(df/2, 2), so F(x) = gammaIncomplete(df/2, x/2)
    return gammaIncomplete_FIXED(df / 2, x / 2);
}

/**
 * Lower incomplete gamma function P(a,x) = γ(a,x)/Γ(a)
 * Using series expansion for small x, continued fraction for large x
 */
function gammaIncomplete_FIXED(a, x) {
    if (x < 0 || a <= 0) return NaN;
    if (x === 0) return 0;
    
    // Use series for x < a + 1, continued fraction otherwise
    if (x < a + 1) {
        // Series expansion
        let sum = 1 / a;
        let term = 1 / a;
        for (let n = 1; n < 200; n++) {
            term *= x / (a + n);
            sum += term;
            if (Math.abs(term) < 1e-10 * Math.abs(sum)) break;
        }
        return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
    } else {
        // Continued fraction (Lentz's algorithm)
        let f = 1, c = 1, d = 1 / x;
        for (let i = 1; i < 200; i++) {
            const an = i * (a - i);
            const bn = x + 2 * i + 1 - a;
            
            d = bn + an * d;
            if (Math.abs(d) < 1e-30) d = 1e-30;
            d = 1 / d;
            
            c = bn + an / c;
            if (Math.abs(c) < 1e-30) c = 1e-30;
            
            const delta = c * d;
            f *= delta;
            
            if (Math.abs(delta - 1) < 1e-10) break;
        }
        // Return 1 - Q(a,x) where Q is upper incomplete gamma
        return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * f / x;
    }
}


// ============================================
// PATCH 4: Add input validation helpers
// ============================================

const SurvExtractValidation = {
    /**
     * Validate IPD array structure
     */
    validateIPD(ipd, options = {}) {
        const { requireArm = true, minRows = 2 } = options;
        
        if (!Array.isArray(ipd)) {
            throw new TypeError('IPD must be an array');
        }
        if (ipd.length < minRows) {
            throw new Error(`IPD must have at least ${minRows} rows, got ${ipd.length}`);
        }
        
        const errors = [];
        
        ipd.forEach((row, i) => {
            if (typeof row.time !== 'number' || isNaN(row.time) || row.time < 0) {
                errors.push(`Row ${i}: invalid time value`);
            }
            if (row.status !== 0 && row.status !== 1) {
                errors.push(`Row ${i}: status must be 0 or 1`);
            }
            if (requireArm && (row.arm === undefined || row.arm === null)) {
                errors.push(`Row ${i}: missing arm value`);
            }
        });
        
        if (errors.length > 0) {
            throw new Error(`IPD validation failed:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more errors` : ''}`);
        }
        
        return true;
    },
    
    /**
     * Validate meta-analysis input
     */
    validateMetaInput(studies) {
        if (!Array.isArray(studies)) {
            throw new TypeError('Studies must be an array');
        }
        if (studies.length < 2) {
            throw new Error('Need at least 2 studies for meta-analysis');
        }
        
        studies.forEach((s, i) => {
            if (typeof s.yi !== 'number' || isNaN(s.yi)) {
                throw new Error(`Study ${i}: invalid effect estimate (yi)`);
            }
            if (typeof s.vi !== 'number' || isNaN(s.vi) || s.vi <= 0) {
                throw new Error(`Study ${i}: invalid variance (vi) - must be positive`);
            }
        });
        
        return true;
    },
    
    /**
     * Validate survival points array
     */
    validateSurvivalPoints(points) {
        if (!Array.isArray(points) || points.length < 2) {
            throw new Error('Need at least 2 survival points');
        }
        
        let lastY = Infinity;
        points.forEach((p, i) => {
            if (typeof p.x !== 'number' || typeof p.y !== 'number') {
                throw new Error(`Point ${i}: missing x or y coordinate`);
            }
            if (p.y < 0 || p.y > 1) {
                throw new Error(`Point ${i}: survival y must be between 0 and 1`);
            }
        });
        
        return true;
    }
};


// ============================================
// PATCH 5: Dependency checker for module loading
// ============================================

const SurvExtractDependencies = {
    required: {
        main: ['state', 'CURVE_TYPES', 'render', 'showToast', 'showProcessing', 'hideProcessing'],
        nma: ['normalCDF', 'tCDF', 'chi2CDF', 'lgamma']
    },
    
    checkMain() {
        const missing = this.required.main.filter(dep => typeof window[dep] === 'undefined');
        if (missing.length > 0) {
            console.warn(`SurvExtract: Missing main app dependencies: ${missing.join(', ')}`);
            console.warn('Some features may not work. Ensure survextract-pro-v5_1.html is loaded first.');
            return false;
        }
        return true;
    },
    
    checkStats() {
        const missing = this.required.nma.filter(dep => typeof window[dep] === 'undefined');
        if (missing.length > 0) {
            console.warn(`SurvExtract: Missing stats functions: ${missing.join(', ')}`);
            return false;
        }
        return true;
    },
    
    /**
     * Safe function call that checks dependency first
     */
    safeCall(fnName, fallback = () => {}) {
        return (...args) => {
            if (typeof window[fnName] === 'function') {
                return window[fnName](...args);
            } else {
                console.warn(`SurvExtract: ${fnName} not available`);
                return fallback(...args);
            }
        };
    }
};


// ============================================
// Export all patches
// ============================================

if (typeof window !== 'undefined') {
    window.SurvExtractPatches = {
        runThresholdAnalysis: runThresholdAnalysis_FIXED,
        evaluateCENKMCandidate: evaluateCENKMCandidate_FIXED,
        betaIncomplete: betaIncomplete_FIXED,
        tCDF: tCDF_FIXED,
        chi2CDF: chi2CDF_FIXED,
        gammaIncomplete: gammaIncomplete_FIXED,
        Validation: SurvExtractValidation,
        Dependencies: SurvExtractDependencies
    };
    
    // Auto-apply patches to replace buggy versions
    if (window.AdvancedNMAModule) {
        window.AdvancedNMAModule.runThresholdAnalysis = runThresholdAnalysis_FIXED;
        console.log('SurvExtract: Patched runThresholdAnalysis');
    }
    
    if (window.SurvExtractEnhancements) {
        window.SurvExtractEnhancements.evaluateCENKMCandidate = evaluateCENKMCandidate_FIXED;
        console.log('SurvExtract: Patched evaluateCENKMCandidate');
    }
    
    // Replace global stat functions
    window.betaIncomplete = betaIncomplete_FIXED;
    window.tCDF = tCDF_FIXED;
    window.chi2CDF = chi2CDF_FIXED;
    window.gammaIncomplete = gammaIncomplete_FIXED;
    console.log('SurvExtract: Patched statistical distribution functions');
}

console.log('SurvExtract Patches loaded. Critical fixes applied.');
