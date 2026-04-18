/**
 * EXTRACTION ENGINE FOR CARDIOLOGY META-ANALYSIS
 * 
 * Purpose: Pattern matching and candidate ranking for clinical trial data
 * Works with the simultaneous human verification approach
 * 
 * Usage:
 *   const result = ExtractionEngine.getBestCandidate(pdfText, 'primaryHR');
 *   // Returns: { found: true, value: 0.74, position: 1234, confidence: 'high', ... }
 */

const ExtractionEngine = {
    
    // ========================================================================
    // FIELD DEFINITIONS - What to extract for cardiology pairwise MA
    // ========================================================================
    
    FIELDS: {
        // PRIMARY OUTCOME
        primaryHR: {
            id: 'primaryHR',
            label: 'Primary Outcome HR',
            type: 'number',
            required: true,
            group: 'primary',
            validation: { min: 0.1, max: 10 }
        },
        primaryCILo: {
            id: 'primaryCILo',
            label: '95% CI Lower',
            type: 'number',
            required: true,
            group: 'primary',
            validation: { min: 0.01, max: 10 }
        },
        primaryCIHi: {
            id: 'primaryCIHi',
            label: '95% CI Upper',
            type: 'number',
            required: true,
            group: 'primary',
            validation: { min: 0.01, max: 20 }
        },
        
        // SAMPLE SIZE
        nTreatment: {
            id: 'nTreatment',
            label: 'N Treatment',
            type: 'integer',
            required: true,
            group: 'sampleSize',
            validation: { min: 10, max: 50000 }
        },
        nControl: {
            id: 'nControl',
            label: 'N Control',
            type: 'integer',
            required: true,
            group: 'sampleSize',
            validation: { min: 10, max: 50000 }
        },
        eventsTreatment: {
            id: 'eventsTreatment',
            label: 'Events Treatment',
            type: 'integer',
            required: true,
            group: 'sampleSize',
            validation: { min: 0, max: 50000 }
        },
        eventsControl: {
            id: 'eventsControl',
            label: 'Events Control',
            type: 'integer',
            required: true,
            group: 'sampleSize',
            validation: { min: 0, max: 50000 }
        },
        
        // COMPONENT OUTCOMES
        cvDeathHR: {
            id: 'cvDeathHR',
            label: 'CV Death HR',
            type: 'number',
            required: false,
            group: 'components'
        },
        hfHospHR: {
            id: 'hfHospHR',
            label: 'HF Hospitalization HR',
            type: 'number',
            required: false,
            group: 'components'
        },
        
        // BASELINE CHARACTERISTICS
        meanAge: {
            id: 'meanAge',
            label: 'Mean Age',
            type: 'number',
            required: false,
            group: 'baseline',
            validation: { min: 18, max: 100 }
        },
        pctMale: {
            id: 'pctMale',
            label: '% Male',
            type: 'number',
            required: false,
            group: 'baseline',
            validation: { min: 0, max: 100 }
        },
        meanEF: {
            id: 'meanEF',
            label: 'Mean EF (%)',
            type: 'number',
            required: false,
            group: 'baseline',
            validation: { min: 5, max: 80 }
        },
        meanEGFR: {
            id: 'meanEGFR',
            label: 'Mean eGFR',
            type: 'number',
            required: false,
            group: 'baseline',
            validation: { min: 10, max: 150 }
        },
        pctDiabetes: {
            id: 'pctDiabetes',
            label: '% Diabetes',
            type: 'number',
            required: false,
            group: 'baseline',
            validation: { min: 0, max: 100 }
        }
    },
    
    // Order for extraction workflow (required first, then optional with likely detections)
    EXTRACTION_ORDER: [
        'primaryHR', 'primaryCILo', 'primaryCIHi',
        'nTreatment', 'nControl',
        'eventsTreatment', 'eventsControl',
        'cvDeathHR', 'hfHospHR',
        'meanAge', 'pctMale', 'meanEF', 'meanEGFR', 'pctDiabetes'
    ],
    
    // ========================================================================
    // PATTERN LIBRARY - Regex patterns for each field type
    // ========================================================================
    
    PATTERNS: {
        hazardRatio: {
            patterns: [
                // "hazard ratio, 0.74" or "hazard ratio 0.74"
                /hazard\s+ratio[,:\s]+(\d+\.?\d*)/gi,
                // "HR 0.74" or "HR, 0.74" or "HR: 0.74"
                /\bHR[,:\s]+(\d+\.?\d*)/gi,
                // "HR=0.74"
                /\bHR\s*=\s*(\d+\.?\d*)/gi,
                // "0.74 (95% CI" - HR followed by CI
                /(\d+\.?\d*)\s*\(\s*95%?\s*CI/gi,
                // "relative hazard 0.74"
                /relative\s+(?:hazard|risk)[,:\s]+(\d+\.?\d*)/gi
            ],
            contextClues: {
                boost: ['primary', 'composite', 'main outcome', 'primary endpoint', 
                        'intention to treat', 'ITT', 'primary analysis', 'first occurrence'],
                penalize: ['subgroup', 'sensitivity', 'per-protocol', 'secondary',
                           'exploratory', 'post hoc', 'adjusted for', 'interaction']
            },
            validation: (v) => v > 0.05 && v < 20
        },
        
        confidenceInterval: {
            patterns: [
                // "95% CI, 0.65 to 0.85" or "95% CI 0.65-0.85"
                /95%?\s*CI[,:\s]+(\d+\.?\d*)\s*[-–—to]+\s*(\d+\.?\d*)/gi,
                // "(0.65-0.85)" or "(0.65 to 0.85)"
                /\((\d+\.?\d*)\s*[-–—to]+\s*(\d+\.?\d*)\)/gi,
                // "95% confidence interval 0.65 to 0.85"
                /confidence\s+interval[,:\s]+(\d+\.?\d*)\s*[-–—to]+\s*(\d+\.?\d*)/gi,
                // "[0.65; 0.85]" European format
                /\[(\d+\.?\d*)\s*[;,]\s*(\d+\.?\d*)\]/gi
            ],
            validation: (lo, hi) => lo > 0 && hi > lo && hi < 50
        },
        
        sampleSize: {
            patterns: [
                // "2,373 patients in the dapagliflozin group"
                /(\d+[,\d]*)\s*patients?\s*(?:in|receiving|assigned\s+to|randomized\s+to)\s*(?:the\s*)?\w+/gi,
                // "n=2373" or "n = 2,373"
                /\bn\s*=\s*(\d+[,\d]*)/gi,
                // "group (n=2373)"
                /group\s*\(\s*n\s*=\s*(\d+[,\d]*)\)/gi,
                // "randomized 2373 to"
                /randomized\s+(\d+[,\d]*)\s+to/gi
            ],
            contextClues: {
                treatment: ['treatment', 'intervention', 'active', 'dapagliflozin', 
                           'empagliflozin', 'sacubitril', 'vericiguat', 'drug', 'experimental'],
                control: ['placebo', 'control', 'comparator', 'standard care']
            },
            validation: (v) => v >= 10 && v <= 100000
        },
        
        events: {
            patterns: [
                // "386 patients (16.3%)"
                /(\d+)\s*patients?\s*\([\d.]+%\)/gi,
                // "occurred in 386 patients"
                /occurred\s+in\s+(\d+)\s*patients?/gi,
                // "events: 386"
                /events?[,:\s]+(\d+)/gi,
                // "386 (16.3%) in the treatment group"
                /(\d+)\s*\([\d.]+%\)\s*in\s*(?:the\s*)?\w+\s*group/gi
            ],
            validation: (v) => v >= 0 && v <= 50000
        },
        
        cvDeath: {
            patterns: [
                /cardiovascular\s+death[^.]*?(\d+\.?\d*)\s*\([^)]*\)/gi,
                /CV\s+death[^.]*?HR[,:\s]*(\d+\.?\d*)/gi,
                /death\s+from\s+cardiovascular[^.]*?(\d+\.?\d*)/gi,
                /cardiac\s+death[^.]*?(\d+\.?\d*)/gi
            ],
            contextClues: {
                boost: ['cardiovascular death', 'CV death', 'cardiac death'],
                penalize: ['all-cause', 'any cause', 'composite']
            }
        },
        
        hfHospitalization: {
            patterns: [
                /hospitalization\s+for\s+heart\s+failure[^.]*?(\d+\.?\d*)/gi,
                /HF\s+hospitalization[^.]*?HR[,:\s]*(\d+\.?\d*)/gi,
                /heart\s+failure\s+hospitalization[^.]*?(\d+\.?\d*)/gi,
                /worsening\s+heart\s+failure[^.]*?(\d+\.?\d*)/gi
            ],
            contextClues: {
                boost: ['hospitalization', 'HF hosp', 'worsening'],
                penalize: ['urgent visit', 'outpatient']
            }
        },
        
        age: {
            patterns: [
                // "Age, years 66.2 ± 11.0" 
                /age[,:\s—-]+(?:years?[,:\s]*)?(\d+\.?\d*)\s*[±\+\-]\s*(\d+\.?\d*)/gi,
                // "66.2 ± 11.0 years"
                /(\d+\.?\d*)\s*[±]\s*(\d+\.?\d*)\s*years?/gi,
                // "mean age 66.2"
                /mean\s+age[,:\s]+(\d+\.?\d*)/gi
            ],
            validation: (v) => v >= 18 && v <= 100
        },
        
        percentMale: {
            patterns: [
                // "Male — 76.5%" or "Male, % 76.5"
                /male[,:\s—%-]+(\d+\.?\d*)%?/gi,
                // "76.5% male"
                /(\d+\.?\d*)%?\s*(?:were\s+)?male/gi,
                // "Men 76.5%"
                /\bmen[,:\s]+(\d+\.?\d*)%?/gi
            ],
            validation: (v) => v >= 0 && v <= 100
        },
        
        ejectionFraction: {
            patterns: [
                // "EF 31.1 ± 6.7" or "LVEF 31.1±6.7"
                /(?:LV)?EF[,:\s]+(\d+\.?\d*)\s*[±\+\-]?\s*(\d+\.?\d*)?/gi,
                // "ejection fraction 31.1"
                /ejection\s+fraction[,:\s]+(\d+\.?\d*)/gi
            ],
            validation: (v) => v >= 5 && v <= 80
        },
        
        eGFR: {
            patterns: [
                /eGFR[,:\s]+(\d+\.?\d*)\s*[±\+\-]?\s*(\d+\.?\d*)?/gi,
                /estimated\s+(?:glomerular\s+)?(?:filtration\s+)?rate[,:\s]+(\d+\.?\d*)/gi,
                /GFR[,:\s]+(\d+\.?\d*)/gi
            ],
            validation: (v) => v >= 10 && v <= 150
        },
        
        diabetes: {
            patterns: [
                /diabetes(?:\s+mellitus)?[,:\s—%-]+(\d+\.?\d*)%?/gi,
                /(\d+\.?\d*)%?\s*(?:had\s+)?diabetes/gi,
                /type\s*2?\s*diabetes[,:\s]+(\d+\.?\d*)/gi
            ],
            validation: (v) => v >= 0 && v <= 100
        }
    },
    
    // ========================================================================
    // CORE EXTRACTION METHODS
    // ========================================================================
    
    /**
     * Clean and parse a numeric value from a string
     */
    cleanNumber(str) {
        if (!str) return null;
        const cleaned = str.replace(/,/g, '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    },
    
    /**
     * Map field ID to pattern definition
     */
    getPatternDef(fieldId) {
        const mapping = {
            primaryHR: this.PATTERNS.hazardRatio,
            cvDeathHR: this.PATTERNS.cvDeath,
            hfHospHR: this.PATTERNS.hfHospitalization,
            primaryCILo: this.PATTERNS.confidenceInterval,
            primaryCIHi: this.PATTERNS.confidenceInterval,
            nTreatment: this.PATTERNS.sampleSize,
            nControl: this.PATTERNS.sampleSize,
            eventsTreatment: this.PATTERNS.events,
            eventsControl: this.PATTERNS.events,
            meanAge: this.PATTERNS.age,
            pctMale: this.PATTERNS.percentMale,
            meanEF: this.PATTERNS.ejectionFraction,
            meanEGFR: this.PATTERNS.eGFR,
            pctDiabetes: this.PATTERNS.diabetes
        };
        return mapping[fieldId];
    },
    
    /**
     * Find all candidates for a specific field
     */
    findCandidates(text, fieldId) {
        const field = this.FIELDS[fieldId];
        const patternDef = this.getPatternDef(fieldId);
        
        if (!patternDef) return [];
        
        const candidates = [];
        
        for (const pattern of patternDef.patterns) {
            let match;
            // Create fresh regex to reset lastIndex
            const regex = new RegExp(pattern.source, pattern.flags);
            
            while ((match = regex.exec(text)) !== null) {
                // Extract value
                let value = null;
                for (let i = 1; i < match.length; i++) {
                    if (match[i]) {
                        const cleaned = this.cleanNumber(match[i]);
                        if (cleaned !== null) {
                            value = cleaned;
                            break;
                        }
                    }
                }
                
                if (value === null) continue;
                
                // Validate
                if (patternDef.validation) {
                    if (typeof patternDef.validation === 'function') {
                        if (!patternDef.validation(value)) continue;
                    }
                }
                
                // Also check field-level validation
                if (field && field.validation) {
                    if (field.validation.min !== undefined && value < field.validation.min) continue;
                    if (field.validation.max !== undefined && value > field.validation.max) continue;
                }
                
                // Get surrounding context (200 chars before and after)
                const start = Math.max(0, match.index - 200);
                const end = Math.min(text.length, match.index + match[0].length + 200);
                const context = text.slice(start, end).toLowerCase();
                
                // Score candidate based on context
                const score = this.scoreCandidate(context, patternDef.contextClues, fieldId);
                
                candidates.push({
                    value,
                    rawMatch: match[0],
                    position: match.index,
                    length: match[0].length,
                    context: text.slice(start, end),
                    score,
                    field: fieldId
                });
            }
        }
        
        // Sort by score descending
        candidates.sort((a, b) => b.score - a.score);
        
        // Remove duplicates (same value within 50 chars)
        return this.deduplicateCandidates(candidates);
    },
    
    /**
     * Score a candidate based on context clues
     */
    scoreCandidate(context, contextClues, fieldId) {
        let score = 50; // Base score
        
        if (!contextClues) return score;
        
        // Boost for positive clues
        for (const clue of (contextClues.boost || [])) {
            if (context.includes(clue.toLowerCase())) {
                score += 15;
            }
        }
        
        // Penalize for negative clues
        for (const clue of (contextClues.penalize || [])) {
            if (context.includes(clue.toLowerCase())) {
                score -= 20;
            }
        }
        
        // Special handling for treatment vs control
        if (fieldId === 'nTreatment' || fieldId === 'eventsTreatment') {
            for (const clue of (contextClues.treatment || [])) {
                if (context.includes(clue.toLowerCase())) score += 20;
            }
            for (const clue of (contextClues.control || [])) {
                if (context.includes(clue.toLowerCase())) score -= 25;
            }
        }
        
        if (fieldId === 'nControl' || fieldId === 'eventsControl') {
            for (const clue of (contextClues.control || [])) {
                if (context.includes(clue.toLowerCase())) score += 20;
            }
            for (const clue of (contextClues.treatment || [])) {
                if (context.includes(clue.toLowerCase())) score -= 25;
            }
        }
        
        // Boost if in Results section
        if (context.includes('result')) score += 10;
        
        // Boost for primary outcome
        if (context.includes('primary')) score += 15;
        
        return Math.max(0, Math.min(100, score));
    },
    
    /**
     * Remove duplicate candidates (same value, nearby position)
     */
    deduplicateCandidates(candidates) {
        const seen = new Set();
        return candidates.filter(c => {
            const key = `${c.value}-${Math.round(c.position / 50)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    },
    
    /**
     * Get the best candidate for a field
     */
    getBestCandidate(text, fieldId) {
        const field = this.FIELDS[fieldId];
        const candidates = this.findCandidates(text, fieldId);
        
        if (candidates.length === 0) {
            return { 
                found: false, 
                field: fieldId,
                fieldLabel: field?.label || fieldId
            };
        }
        
        const best = candidates[0];
        
        return {
            found: true,
            field: fieldId,
            fieldLabel: field?.label || fieldId,
            value: best.value,
            position: best.position,
            length: best.length,
            context: best.context,
            rawMatch: best.rawMatch,
            confidence: best.score >= 70 ? 'high' : best.score >= 50 ? 'medium' : 'low',
            score: best.score,
            alternatives: candidates.slice(1, 4).map(c => ({
                value: c.value,
                score: c.score,
                position: c.position
            }))
        };
    },
    
    /**
     * Extract all fields from text
     */
    extractAll(text, fieldList = null) {
        const fields = fieldList || this.EXTRACTION_ORDER;
        const results = {};
        
        for (const fieldId of fields) {
            results[fieldId] = this.getBestCandidate(text, fieldId);
        }
        
        return results;
    },
    
    /**
     * Special: Extract CI pair near a known HR position
     */
    extractCIForHR(text, hrPosition, hrValue) {
        // Look for CI pattern within 150 characters of HR
        const searchStart = Math.max(0, hrPosition - 50);
        const searchEnd = Math.min(text.length, hrPosition + 200);
        const searchText = text.slice(searchStart, searchEnd);
        
        for (const pattern of this.PATTERNS.confidenceInterval.patterns) {
            const regex = new RegExp(pattern.source, pattern.flags);
            const match = regex.exec(searchText);
            
            if (match && match[1] && match[2]) {
                const lo = this.cleanNumber(match[1]);
                const hi = this.cleanNumber(match[2]);
                
                // Validate: CI should contain the HR
                if (lo && hi && lo < hrValue && hrValue < hi) {
                    return { 
                        lo, 
                        hi, 
                        position: searchStart + match.index,
                        validated: true 
                    };
                }
            }
        }
        
        return null;
    }
};

// Export for use in browser
if (typeof window !== 'undefined') {
    window.ExtractionEngine = ExtractionEngine;
}

// Export for Node.js
if (typeof module !== 'undefined') {
    module.exports = ExtractionEngine;
}
