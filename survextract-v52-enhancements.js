// ============================================
// SurvExtract Pro v5.2 Enhancement Patch
// Addresses WPD limitations identified in analysis
// ============================================

// Add these functions to survextract-pro-v5_1.html
// Insert before the closing </script> tag, around line 12405

// ============================================
// ENHANCEMENT 1: X-Step Interpolation Mode
// Fixes the #1 source of digitization error
// ============================================

/**
 * Enforces step function constraints on digitized points.
 * KM curves are step functions - this prevents diagonal interpolation
 * through vertical drops which creates ambiguous time points.
 * 
 * @param {Array} points - Array of {x, y, armIndex, px, py} objects
 * @param {string} direction - 'decreasing' (survival) or 'increasing' (CI)
 * @returns {Array} - Corrected points with proper step structure
 */
function enforceStepFunctionConstraints(points, direction = 'decreasing') {
    if (points.length < 3) return points;
    
    const sorted = [...points].sort((a, b) => a.x - b.x);
    const minTimeGap = (sorted[sorted.length - 1].x - sorted[0].x) * 0.001; // 0.1% tolerance
    const minYChange = 0.005; // 0.5% survival change threshold
    
    const corrected = [];
    let i = 0;
    
    while (i < sorted.length) {
        const current = { ...sorted[i] };
        
        // Look ahead for points at approximately the same X (vertical drop candidates)
        const verticalGroup = [current];
        let j = i + 1;
        
        while (j < sorted.length && Math.abs(sorted[j].x - current.x) < minTimeGap) {
            verticalGroup.push({ ...sorted[j] });
            j++;
        }
        
        if (verticalGroup.length > 1) {
            // Multiple points at same X = vertical drop
            // Take the point AFTER the drop (lower Y for decreasing, higher for increasing)
            verticalGroup.sort((a, b) => direction === 'decreasing' ? a.y - b.y : b.y - a.y);
            const bestPoint = verticalGroup[0]; // Take endpoint of drop
            
            // Also keep the pre-drop point for proper step rendering
            const preDropPoint = verticalGroup[verticalGroup.length - 1];
            
            // Only add pre-drop if it's meaningfully different
            if (corrected.length === 0 || 
                Math.abs(preDropPoint.y - corrected[corrected.length - 1].y) > minYChange) {
                corrected.push(preDropPoint);
            }
            corrected.push(bestPoint);
            
            i = j; // Skip all points in the vertical group
        } else {
            // Single point - check if it's part of a diagonal that should be a step
            if (corrected.length > 0) {
                const prev = corrected[corrected.length - 1];
                const yChange = Math.abs(current.y - prev.y);
                const xChange = current.x - prev.x;
                
                // If there's a significant Y change, this might be a smoothed step
                // Insert intermediate point to create proper step
                if (yChange > 0.03 && xChange > minTimeGap * 10) {
                    // Check if the change is too diagonal (should be a step)
                    const expectedStepX = prev.x + xChange * 0.1; // Step should happen early
                    
                    // Insert horizontal segment first (stay at prev.y)
                    corrected.push({
                        ...current,
                        x: current.x - minTimeGap, // Just before current X
                        y: prev.y, // Stay at previous Y (horizontal)
                        isSyntheticStep: true
                    });
                }
            }
            corrected.push(current);
            i++;
        }
    }
    
    return corrected;
}

/**
 * Post-process traced points to enforce step function constraints.
 * Call this after any auto-trace operation.
 */
function postProcessStepFunction() {
    const config = CURVE_TYPES[state.curveType];
    
    if (!config.stepFunction) {
        console.log('Step function not applicable for curve type:', state.curveType);
        return;
    }
    
    let totalCorrected = 0;
    
    state.arms.forEach((_, armIndex) => {
        let armPoints = state.points.filter(p => p.armIndex === armIndex);
        const originalCount = armPoints.length;
        
        armPoints = enforceStepFunctionConstraints(armPoints, config.direction);
        
        // Update state
        state.points = state.points.filter(p => p.armIndex !== armIndex);
        armPoints.forEach(p => {
            p.armIndex = armIndex;
            state.points.push(p);
        });
        
        totalCorrected += Math.abs(armPoints.length - originalCount);
    });
    
    if (totalCorrected > 0) {
        render();
        showToast(`Step function enforced: ${totalCorrected} points adjusted`, 'info');
    }
}

// ============================================
// ENHANCEMENT 2: Enhanced Validation with Diagnostics
// Provides actionable feedback on digitization quality
// ============================================

/**
 * Run enhanced validation with diagnostic suggestions.
 * Helps users identify and fix specific digitization issues.
 */
function runEnhancedValidation() {
    if (!state.reportedValues) {
        showToast('Enter reported values first (Validate tab)', 'warning');
        return null;
    }
    
    if (Object.keys(state.reconstructedData).length < 2) {
        showToast('Reconstruct data first', 'error');
        return null;
    }
    
    const reported = state.reportedValues;
    const diagnostics = [];
    const comparisons = [];
    
    // Get reconstructed data
    const arm1 = state.reconstructedData[0] || [];
    const arm2 = state.reconstructedData[1] || [];
    
    // 1. Median Survival Validation
    const reconMedian1 = calculateMedian(arm1);
    const reconMedian2 = calculateMedian(arm2);
    
    if (reported.medianArm1 && reconMedian1) {
        const pctDiff = Math.abs(reconMedian1 - reported.medianArm1) / reported.medianArm1 * 100;
        comparisons.push({
            metric: 'Median (Arm 1)',
            reported: reported.medianArm1,
            reconstructed: reconMedian1,
            pctDiff: pctDiff
        });
        
        if (pctDiff > 10) {
            diagnostics.push({
                severity: pctDiff > 20 ? 'error' : 'warning',
                issue: `Arm 1 median differs by ${pctDiff.toFixed(1)}%`,
                causes: [
                    'Number-at-risk table may be incomplete',
                    'Digitized points near 50% threshold may be imprecise',
                    'Step function drops not captured correctly'
                ],
                fixes: [
                    'Verify NaR values match publication exactly',
                    'Manually add points near the median crossing',
                    'Enable "Enforce Constraints" and re-reconstruct',
                    'Try OpenCV Edge trace for better step detection'
                ]
            });
        }
    }
    
    if (reported.medianArm2 && reconMedian2) {
        const pctDiff = Math.abs(reconMedian2 - reported.medianArm2) / reported.medianArm2 * 100;
        comparisons.push({
            metric: 'Median (Arm 2)',
            reported: reported.medianArm2,
            reconstructed: reconMedian2,
            pctDiff: pctDiff
        });
        
        if (pctDiff > 10) {
            diagnostics.push({
                severity: pctDiff > 20 ? 'error' : 'warning',
                issue: `Arm 2 median differs by ${pctDiff.toFixed(1)}%`,
                causes: ['Same as Arm 1 - see above'],
                fixes: ['Same as Arm 1 - see above']
            });
        }
    }
    
    // 2. Hazard Ratio Validation
    if (reported.hr && state.coxResults) {
        const pctDiff = Math.abs(state.coxResults.hr - reported.hr) / reported.hr * 100;
        comparisons.push({
            metric: 'Hazard Ratio',
            reported: reported.hr,
            reconstructed: state.coxResults.hr,
            pctDiff: pctDiff
        });
        
        if (pctDiff > 10) {
            const causes = ['Censoring pattern may not match publication'];
            const fixes = ['Enable Rogula method for tick detection'];
            
            // Check for curve crossing
            if (state.curveCrossingResults?.hasCrossing) {
                causes.push('Curves cross - HR is inherently unstable');
                fixes.push('Consider using RMST instead of HR');
            }
            
            // Check for non-PH
            if (state.weightedLogRankResults?.recommendation?.includes('Non-proportional')) {
                causes.push('Non-proportional hazards detected');
                fixes.push('Time-varying HR or RMST may be more appropriate');
            }
            
            // Check sample size matching
            const reconN1 = arm1.length;
            const reconN2 = arm2.length;
            const totalRecon = reconN1 + reconN2;
            
            if (state.atRisk[0]?.length > 0 && state.atRisk[1]?.length > 0) {
                const reportedN1 = state.atRisk[0][0]?.nrisk || 0;
                const reportedN2 = state.atRisk[1][0]?.nrisk || 0;
                
                if (Math.abs(reconN1 - reportedN1) > reportedN1 * 0.05) {
                    causes.push(`Arm 1 sample size: reconstructed ${reconN1} vs reported ${reportedN1}`);
                    fixes.push('Check Default N setting matches publication N');
                }
            }
            
            diagnostics.push({
                severity: pctDiff > 20 ? 'error' : 'warning',
                issue: `HR differs by ${pctDiff.toFixed(1)}%`,
                causes: causes,
                fixes: fixes
            });
        }
    }
    
    // 3. CI Width Validation (if available)
    if (reported.hrLower && reported.hrUpper && state.coxResults) {
        const reportedWidth = Math.log(reported.hrUpper) - Math.log(reported.hrLower);
        const reconWidth = Math.log(state.coxResults.upper) - Math.log(state.coxResults.lower);
        const widthRatio = reconWidth / reportedWidth;
        
        if (widthRatio < 0.7 || widthRatio > 1.4) {
            diagnostics.push({
                severity: 'warning',
                issue: `CI width ratio: ${widthRatio.toFixed(2)} (expected ~1.0)`,
                causes: [
                    widthRatio < 0.7 ? 'Reconstructed data may have too many events' : 
                                       'Reconstructed data may have too few events',
                    'Total events may not match publication'
                ],
                fixes: [
                    'Verify total events match reported values',
                    'Check that censoring is being captured (Rogula method)',
                    'Review digitization at end of follow-up'
                ]
            });
        }
    }
    
    // 4. Global Quality Assessment
    const avgPctDiff = comparisons.length > 0 
        ? comparisons.reduce((sum, c) => sum + c.pctDiff, 0) / comparisons.length 
        : 0;
    
    let overallGrade, gradeColor;
    if (avgPctDiff < 5) {
        overallGrade = 'A';
        gradeColor = 'var(--accent-green)';
    } else if (avgPctDiff < 10) {
        overallGrade = 'B';
        gradeColor = 'var(--accent-green)';
    } else if (avgPctDiff < 15) {
        overallGrade = 'C';
        gradeColor = 'var(--accent-orange)';
    } else if (avgPctDiff < 25) {
        overallGrade = 'D';
        gradeColor = 'var(--accent-orange)';
    } else {
        overallGrade = 'F';
        gradeColor = 'var(--accent-red)';
    }
    
    // Store and display results
    state.enhancedValidation = {
        comparisons,
        diagnostics,
        overallGrade,
        avgPctDiff
    };
    
    displayEnhancedValidation();
    
    return state.enhancedValidation;
}

/**
 * Display enhanced validation results in UI
 */
function displayEnhancedValidation() {
    const results = state.enhancedValidation;
    if (!results) return;
    
    let html = `
        <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-weight: 600;">Reconstruction Accuracy</span>
                <span style="font-size: 24px; font-weight: 700; color: ${
                    results.avgPctDiff < 10 ? 'var(--accent-green)' : 
                    results.avgPctDiff < 20 ? 'var(--accent-orange)' : 'var(--accent-red)'
                };">Grade ${results.overallGrade}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-secondary);">
                Average deviation: ${results.avgPctDiff.toFixed(1)}% from reported values
            </div>
        </div>
    `;
    
    // Comparisons table
    if (results.comparisons.length > 0) {
        html += `
            <div style="font-weight: 500; margin-bottom: 8px;">Metric Comparisons</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px;">
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <th style="text-align: left; padding: 6px;">Metric</th>
                    <th style="text-align: right;">Reported</th>
                    <th style="text-align: right;">Reconstructed</th>
                    <th style="text-align: right;">Diff %</th>
                </tr>
        `;
        
        results.comparisons.forEach(c => {
            const color = c.pctDiff < 5 ? 'var(--accent-green)' : 
                         c.pctDiff < 15 ? 'var(--accent-orange)' : 'var(--accent-red)';
            html += `
                <tr>
                    <td style="padding: 6px;">${c.metric}</td>
                    <td style="text-align: right;">${typeof c.reported === 'number' ? c.reported.toFixed(2) : c.reported}</td>
                    <td style="text-align: right;">${typeof c.reconstructed === 'number' ? c.reconstructed.toFixed(2) : c.reconstructed}</td>
                    <td style="text-align: right; color: ${color}; font-weight: 500;">${c.pctDiff.toFixed(1)}%</td>
                </tr>
            `;
        });
        
        html += '</table>';
    }
    
    // Diagnostics
    if (results.diagnostics.length > 0) {
        html += `<div style="font-weight: 500; margin-bottom: 8px;">Diagnostic Suggestions</div>`;
        
        results.diagnostics.forEach(d => {
            const icon = d.severity === 'error' ? '🔴' : '🟡';
            html += `
                <div style="padding: 10px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 8px; border-left: 3px solid ${
                    d.severity === 'error' ? 'var(--accent-red)' : 'var(--accent-orange)'
                };">
                    <div style="font-weight: 500; margin-bottom: 6px;">${icon} ${d.issue}</div>
                    <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 4px;">
                        <strong>Likely causes:</strong>
                        <ul style="margin: 4px 0 8px 16px;">
                            ${d.causes.map(c => `<li>${c}</li>`).join('')}
                        </ul>
                    </div>
                    <div style="font-size: 10px; color: var(--accent-blue);">
                        <strong>Suggested fixes:</strong>
                        <ul style="margin: 4px 0 0 16px;">
                            ${d.fixes.map(f => `<li>${f}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        });
    } else if (results.comparisons.length > 0) {
        html += `
            <div style="padding: 12px; background: rgba(34, 197, 94, 0.1); border-radius: 6px; color: var(--accent-green);">
                ✓ No significant issues detected. Reconstruction quality is acceptable.
            </div>
        `;
    }
    
    // Insert into validation area
    const container = document.getElementById('validationResults') || 
                     document.getElementById('dataPreview');
    if (container) {
        container.innerHTML = html;
    }
}

// ============================================
// ENHANCEMENT 3: Center-of-Mass Line Detection
// Improves accuracy for thick curves (3-5 pixels)
// ============================================

/**
 * Calculate intensity-weighted centroid for each X column.
 * More accurate than edge detection for thick lines.
 * 
 * @param {ImageData} imageData - Canvas image data
 * @param {Object} targetColor - {r, g, b} of target curve
 * @param {number} tolerance - Color distance tolerance (0-255)
 * @returns {Array} - Array of {x, y} center points
 */
function calculateLineCenterOfMass(imageData, targetColor, tolerance = 60) {
    const centerPoints = [];
    const width = imageData.width;
    const height = imageData.height;
    
    for (let x = 0; x < width; x++) {
        let sumY = 0;
        let sumWeight = 0;
        
        for (let y = 0; y < height; y++) {
            const idx = (y * width + x) * 4;
            const r = imageData.data[idx];
            const g = imageData.data[idx + 1];
            const b = imageData.data[idx + 2];
            
            // Calculate color distance from target
            const dist = Math.sqrt(
                (r - targetColor.r) ** 2 +
                (g - targetColor.g) ** 2 +
                (b - targetColor.b) ** 2
            );
            
            if (dist < tolerance) {
                // Weight by proximity to target color (closer = higher weight)
                const weight = Math.pow(1 - (dist / tolerance), 2);
                sumY += y * weight;
                sumWeight += weight;
            }
        }
        
        if (sumWeight > 0.5) { // Minimum weight threshold
            centerPoints.push({
                px: x,
                py: sumY / sumWeight
            });
        }
    }
    
    return centerPoints;
}

/**
 * Run center-of-mass trace using sampled color.
 * Call after sampling a curve color with sampleColor().
 */
function runCenterOfMassTrace() {
    if (!state.sampledColor) {
        showToast('Sample a color first (click on curve)', 'error');
        return;
    }
    
    if (!state.calibration.isCalibrated) {
        showToast('Calibrate axes first', 'error');
        return;
    }
    
    showProcessing('Running center-of-mass trace...', 0);
    
    setTimeout(() => {
        try {
            // Get image data
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = state.image.width;
            tempCanvas.height = state.image.height;
            const ctx = tempCanvas.getContext('2d');
            ctx.drawImage(state.image, 0, 0);
            const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            
            updateProcessing('Calculating line centroids...', 30);
            
            // Get center points
            const targetColor = {
                r: state.sampledColor.r || 0,
                g: state.sampledColor.g || 0,
                b: state.sampledColor.b || 0
            };
            
            const tolerance = parseInt(document.getElementById('colorTolerance')?.value) || 50;
            const centerPoints = calculateLineCenterOfMass(imageData, targetColor, tolerance);
            
            updateProcessing('Converting to data coordinates...', 60);
            
            // Convert to data coordinates
            const interval = parseInt(document.getElementById('sampleInterval')?.value) || 5;
            const currentArm = state.currentArm || 0;
            
            const newPoints = [];
            for (let i = 0; i < centerPoints.length; i += interval) {
                const p = centerPoints[i];
                const data = pixelToData(p.px, p.py);
                
                if (data.x !== null && data.y !== null && 
                    data.y >= -0.1 && data.y <= 1.1) {
                    newPoints.push({
                        armIndex: currentArm,
                        px: p.px,
                        py: p.py,
                        x: data.x,
                        y: Math.max(0, Math.min(1, data.y)),
                        isCensor: false,
                        isCenterOfMass: true
                    });
                }
            }
            
            updateProcessing('Post-processing...', 80);
            
            // Clear existing points for this arm and add new ones
            state.points = state.points.filter(p => p.armIndex !== currentArm);
            state.points.push(...newPoints);
            
            // Enforce constraints
            if (document.getElementById('enforceConstraints')?.checked) {
                enforceConstraints();
            }
            
            // Apply step function constraints
            const config = CURVE_TYPES[state.curveType];
            if (config.stepFunction) {
                postProcessStepFunction();
            }
            
            updateArmList();
            updatePointsTable();
            render();
            hideProcessing();
            
            showToast(`Center-of-mass trace: ${newPoints.length} points (arm ${currentArm + 1})`, 'success');
            
        } catch (err) {
            hideProcessing();
            console.error('Center-of-mass trace error:', err);
            showToast('Center-of-mass trace failed: ' + err.message, 'error');
        }
    }, 50);
}

// ============================================
// ENHANCEMENT 4: Quality Score for Meta-Analysis
// Provides structured quality assessment for NMA
// ============================================

/**
 * Calculate comprehensive quality score for meta-analysis inclusion.
 * Based on Guyot validation + structural checks.
 */
function calculateMetaAnalysisQuality() {
    if (Object.keys(state.reconstructedData).length < 2) {
        showToast('Reconstruct data first', 'error');
        return null;
    }
    
    const scores = {
        digitizationQuality: 0,     // Based on curve smoothness
        sampleSizeMatch: 0,         // N matches at-risk table
        validationAccuracy: 0,      // vs reported values
        dataCompleteness: 0,        // All required fields present
        methodologicalRigor: 0      // Used Guyot + Rogula etc
    };
    
    // 1. Digitization Quality (curve smoothness)
    let smoothnessScore = 100;
    state.arms.forEach((_, i) => {
        const points = state.points.filter(p => p.armIndex === i).sort((a, b) => a.x - b.x);
        if (points.length < 5) return;
        
        // Check for erratic jumps
        for (let j = 1; j < points.length - 1; j++) {
            const prevSlope = (points[j].y - points[j-1].y) / (points[j].x - points[j-1].x + 0.001);
            const nextSlope = (points[j+1].y - points[j].y) / (points[j+1].x - points[j].x + 0.001);
            
            // Penalize abrupt direction changes
            if (Math.sign(prevSlope) !== Math.sign(nextSlope) && 
                Math.abs(prevSlope) > 0.01 && Math.abs(nextSlope) > 0.01) {
                smoothnessScore -= 5;
            }
        }
    });
    scores.digitizationQuality = Math.max(0, smoothnessScore);
    
    // 2. Sample Size Match
    let sampleMatch = 100;
    state.arms.forEach((_, i) => {
        const ipd = state.reconstructedData[i] || [];
        const atRisk = state.atRisk[i] || [];
        
        if (atRisk.length > 0 && ipd.length > 0) {
            const expectedN = atRisk[0].nrisk;
            const reconN = ipd.length;
            const diff = Math.abs(reconN - expectedN) / expectedN * 100;
            sampleMatch -= Math.min(diff, 50);
        }
    });
    scores.sampleSizeMatch = Math.max(0, sampleMatch);
    
    // 3. Validation Accuracy (if available)
    if (state.enhancedValidation) {
        scores.validationAccuracy = Math.max(0, 100 - state.enhancedValidation.avgPctDiff * 4);
    } else if (state.validationResults) {
        const avgRMSE = state.validationResults.arms?.reduce((s, a) => s + a.rmse, 0) / 
                       (state.validationResults.arms?.length || 1);
        scores.validationAccuracy = Math.max(0, 100 - avgRMSE * 2000);
    } else {
        scores.validationAccuracy = 50; // Unknown
    }
    
    // 4. Data Completeness
    let completeness = 0;
    if (state.reconstructedData && Object.keys(state.reconstructedData).length >= 2) completeness += 25;
    if (state.atRisk && Object.values(state.atRisk).some(a => a?.length > 0)) completeness += 25;
    if (state.coxResults) completeness += 25;
    if (state.rmstResults) completeness += 25;
    scores.dataCompleteness = completeness;
    
    // 5. Methodological Rigor
    let rigor = 0;
    if (state.curveType === 'km' || state.curveType === 'ci') rigor += 20; // Appropriate curve type
    if (document.getElementById('useRogulaMethod')?.checked) rigor += 30; // Rogula enhancement
    if (state.censoringTicks && Object.values(state.censoringTicks).some(t => t.length > 0)) rigor += 20;
    if (state.weightedLogRankResults) rigor += 15; // Non-PH assessment
    if (state.qualityScores && state.qualityScores.length > 0) rigor += 15; // IPD quality checked
    scores.methodologicalRigor = Math.min(100, rigor);
    
    // Overall weighted score
    const weights = {
        digitizationQuality: 0.20,
        sampleSizeMatch: 0.25,
        validationAccuracy: 0.25,
        dataCompleteness: 0.15,
        methodologicalRigor: 0.15
    };
    
    scores.overall = Object.keys(scores)
        .filter(k => k !== 'overall')
        .reduce((sum, k) => sum + scores[k] * weights[k], 0);
    
    scores.grade = scores.overall >= 90 ? 'A' :
                   scores.overall >= 80 ? 'B' :
                   scores.overall >= 70 ? 'C' :
                   scores.overall >= 60 ? 'D' : 'F';
    
    scores.recommendation = scores.overall >= 80 
        ? 'Suitable for meta-analysis inclusion'
        : scores.overall >= 60
        ? 'Review digitization quality before inclusion'
        : 'Re-digitize with improved methodology';
    
    state.metaAnalysisQuality = scores;
    
    console.log('Meta-Analysis Quality Assessment:', scores);
    showToast(`Quality Grade: ${scores.grade} (${scores.overall.toFixed(0)}%) - ${scores.recommendation}`, 
              scores.overall >= 70 ? 'success' : 'warning');
    
    return scores;
}

// ============================================
// UI Integration
// ============================================

// Add to Trace menu (modify existing menu in HTML):
// <button onclick="runCenterOfMassTrace()">⚖️ Center-of-Mass Trace</button>
// <button onclick="postProcessStepFunction()">📐 Enforce Step Function</button>

// Add to Validate tab:
// <button onclick="runEnhancedValidation()">🔍 Enhanced Validation</button>
// <button onclick="calculateMetaAnalysisQuality()">📊 NMA Quality Score</button>

// ============================================
// ENHANCEMENT 5: CEN-KM Branch-and-Compare Algorithm
// From RESOLVE-IPD (arXiv:2511.01785)
// Eliminates uniform censoring assumption
// ============================================

/**
 * CEN-KM: Censoring-Informed Kaplan-Meier IPD Reconstruction
 * 
 * Branch-and-compare algorithm that:
 * 1. Evaluates multiple candidate event counts at each drop
 * 2. Iteratively adds censors to minimize error
 * 3. Aligns with risk table at boundary times
 * 
 * @param {Array} survivalPoints - [{x: time, y: survival}] sorted by time
 * @param {Array} atRiskTable - [{time, nrisk}] from publication
 * @param {Array} censorTicks - [{time}] from tick detection
 * @param {Object} options - Configuration options
 * @returns {Array} - IPD as [{time, status, arm}]
 */
function reconstructIPD_CENKM(survivalPoints, atRiskTable, censorTicks = [], options = {}) {
    const {
        matchTolerance = 0.005,       // 0.5% survival tolerance
        maxExtraCensorsPerBin = 10,   // Max synthetic censors to try
        candidateRange = 2,           // ±2 events from theoretical
        armName = 'Treatment',
        alignWithRiskTable = true,
        debug = false
    } = options;
    
    const ipd = [];
    const S = [...survivalPoints].sort((a, b) => a.x - b.x);
    const ticks = censorTicks ? [...censorTicks].sort((a, b) => a.time - b.time) : [];
    
    // Ensure monotonically decreasing survival
    let maxY = 1;
    S.forEach(p => {
        p.y = Math.max(0.001, Math.min(1, p.y));
        if (p.y > maxY) p.y = maxY;
        else maxY = p.y;
    });
    
    // Get initial N from risk table or estimate
    const n0 = atRiskTable && atRiskTable.length > 0 
        ? atRiskTable[0].nrisk 
        : estimateN0FromSurvivalCurve(S);
    
    let currentN = n0;
    let tickIndex = 0;
    const reconstructionLog = [];
    
    for (let i = 0; i < S.length - 1; i++) {
        const t1 = S[i].x;
        const t2 = S[i + 1].x;
        const sStart = S[i].y;
        const sEnd = S[i + 1].y;
        
        // Skip if no time progression or no survival drop
        if (t2 <= t1 || sEnd >= sStart - 0.0001) continue;
        
        // Collect observed censors in this interval from ticks
        const observedCensors = [];
        while (tickIndex < ticks.length && ticks[tickIndex].time < t2) {
            if (ticks[tickIndex].time >= t1) {
                observedCensors.push(ticks[tickIndex].time);
            }
            tickIndex++;
        }
        
        // Theoretical event count from KM equation: S(t) = S(t-) × (1 - d/n)
        const conditionalSurvival = sEnd / sStart;
        const theoreticalEvents = currentN * (1 - conditionalSurvival);
        
        // BRANCH: Evaluate multiple candidate event counts
        const candidates = [];
        const minEvents = Math.max(1, Math.floor(theoreticalEvents) - candidateRange);
        const maxEvents = Math.min(currentN, Math.ceil(theoreticalEvents) + candidateRange);
        
        for (let d = minEvents; d <= maxEvents; d++) {
            // Try with observed censors only first
            const baseResult = evaluateCENKMCandidate(
                currentN, d, observedCensors.length, sStart, sEnd
            );
            
            candidates.push({
                events: d,
                censors: observedCensors.length,
                censorTimes: [...observedCensors],
                error: baseResult.error,
                predictedS: baseResult.survival,
                hasSynthetic: false
            });
            
            // COMPARE: Try adding extra censors if error exceeds tolerance
            if (baseResult.error > matchTolerance) {
                for (let extraC = 1; extraC <= maxExtraCensorsPerBin; extraC++) {
                    const withExtra = evaluateCENKMCandidate(
                        currentN, d, observedCensors.length + extraC, sStart, sEnd
                    );
                    
                    if (withExtra.error < baseResult.error) {
                        // Generate synthetic censor times within interval
                        const syntheticTimes = generateSyntheticCensorTimes(
                            t1, t2, extraC, observedCensors
                        );
                        
                        candidates.push({
                            events: d,
                            censors: observedCensors.length + extraC,
                            censorTimes: [...observedCensors, ...syntheticTimes],
                            error: withExtra.error,
                            predictedS: withExtra.survival,
                            hasSynthetic: true
                        });
                    }
                    
                    // Stop if we hit tolerance
                    if (withExtra.error < matchTolerance) break;
                }
            }
        }
        
        // SELECT: Choose candidate with minimum error
        candidates.sort((a, b) => a.error - b.error);
        const best = candidates[0];
        
        if (debug) {
            reconstructionLog.push({
                interval: [t1, t2],
                sStart, sEnd,
                theoretical: theoreticalEvents,
                selected: best,
                alternativesConsidered: candidates.length
            });
        }
        
        // Add events (distributed across interval)
        const eventTimes = distributeEventTimes(t1, t2, best.events);
        eventTimes.forEach(t => {
            ipd.push({ time: t, status: 1, arm: armName });
        });
        
        // Add censors at their specific times
        best.censorTimes.forEach(t => {
            ipd.push({ time: t, status: 0, arm: armName });
        });
        
        // Update N for next interval
        currentN = Math.max(0, currentN - best.events - best.censors);
    }
    
    // Add remaining patients as censored at final time
    if (currentN > 0 && S.length > 0) {
        const finalTime = S[S.length - 1].x;
        for (let i = 0; i < currentN; i++) {
            ipd.push({ time: finalTime, status: 0, arm: armName });
        }
    }
    
    // Risk table boundary alignment
    let aligned = ipd;
    if (alignWithRiskTable && atRiskTable && atRiskTable.length > 1) {
        aligned = alignIPDWithRiskTable(ipd, atRiskTable);
    }
    
    // Sort by time
    aligned.sort((a, b) => a.time - b.time);
    
    // Attach debug log if requested
    if (debug) {
        aligned._reconstructionLog = reconstructionLog;
    }
    
    return aligned;
}

/**
 * Evaluate a candidate (events, censors) combination using KM formula
 */
function evaluateCENKMCandidate(nAtRisk, events, censors, sStart, sTarget) {
    // KM: censors removed before events occur in interval
    const effectiveN = Math.max(1, nAtRisk - censors);
    const conditionalS = Math.max(0, (effectiveN - events) / effectiveN);
    const predictedS = sStart * conditionalS;
    const error = Math.abs(predictedS - sTarget);
    
    return { survival: predictedS, error };
}

/**
 * Generate synthetic censor times distributed within interval
 * Avoids clustering near observed censors
 */
function generateSyntheticCensorTimes(t1, t2, count, existingTimes) {
    const synthetic = [];
    const interval = t2 - t1;
    const step = interval / (count + 1);
    
    for (let i = 0; i < count; i++) {
        let candidate = t1 + step * (i + 0.5);
        
        // Avoid collision with existing times (within 10% of step)
        const minDist = step * 0.1;
        for (const existing of existingTimes) {
            if (Math.abs(existing - candidate) < minDist) {
                candidate = existing + minDist;
            }
        }
        
        // Ensure within bounds
        candidate = Math.max(t1 + 0.001, Math.min(candidate, t2 - 0.001));
        synthetic.push(candidate);
    }
    
    return synthetic;
}

/**
 * Distribute event times within interval (not at exact boundaries)
 */
function distributeEventTimes(t1, t2, count) {
    if (count === 0) return [];
    if (count === 1) return [(t1 + t2) / 2];
    
    const times = [];
    const step = (t2 - t1) / (count + 1);
    
    for (let i = 0; i < count; i++) {
        times.push(t1 + step * (i + 1));
    }
    
    return times;
}

/**
 * Estimate initial N from survival curve shape when risk table unavailable
 */
function estimateN0FromSurvivalCurve(survivalPoints) {
    // Use first significant drop to estimate N
    // If S drops by Δ with 1 event, then N ≈ 1/Δ
    for (let i = 1; i < survivalPoints.length; i++) {
        const drop = survivalPoints[i - 1].y - survivalPoints[i].y;
        if (drop > 0.005 && drop < 0.1) {
            // Reasonable single-event drop
            return Math.round(1 / drop);
        }
    }
    
    // Fallback: use average drop
    const drops = [];
    for (let i = 1; i < survivalPoints.length; i++) {
        const drop = survivalPoints[i - 1].y - survivalPoints[i].y;
        if (drop > 0) drops.push(drop);
    }
    
    if (drops.length > 0) {
        const medianDrop = drops.sort((a, b) => a - b)[Math.floor(drops.length / 2)];
        return Math.round(1 / medianDrop);
    }
    
    return 100; // Default fallback
}

/**
 * Align reconstructed IPD with reported risk table at boundary times
 * Adjusts censoring times while preserving event times
 */
function alignIPDWithRiskTable(ipd, riskTable) {
    if (!riskTable || riskTable.length < 2) return ipd;
    
    const aligned = ipd.map(p => ({ ...p })); // Deep copy
    const boundaries = riskTable.sort((a, b) => a.time - b.time);
    
    for (const boundary of boundaries) {
        const tau = boundary.time;
        const target = boundary.nrisk;
        
        // Count current at-risk (patients with time >= tau)
        const atRisk = aligned.filter(p => p.time >= tau).length;
        const delta = atRisk - target;
        
        if (Math.abs(delta) <= 1) continue; // Close enough
        
        if (delta > 0) {
            // Too many at risk - move some censors to before boundary
            const candidates = aligned
                .filter(p => p.status === 0 && p.time >= tau && p.time < tau + 1)
                .slice(0, Math.abs(delta));
            
            candidates.forEach(p => {
                p.time = tau - 0.001;
            });
        } else {
            // Too few at risk - move some censors to after boundary
            const candidates = aligned
                .filter(p => p.status === 0 && p.time < tau && p.time >= tau - 1)
                .slice(0, Math.abs(delta));
            
            candidates.forEach(p => {
                p.time = tau + 0.001;
            });
        }
    }
    
    return aligned;
}

/**
 * Compare Guyot vs CEN-KM reconstruction quality
 * Useful for validation and method selection
 */
function compareReconstructionMethods(survivalPoints, atRiskTable, censorTicks, options = {}) {
    const armName = options.armName || 'Treatment';
    
    // Run both methods
    const guyotIPD = reconstructIPD_KM(survivalPoints, atRiskTable, armName);
    const cenkmIPD = reconstructIPD_CENKM(survivalPoints, atRiskTable, censorTicks, {
        ...options,
        debug: true
    });
    
    // Calculate quality metrics for each
    const metrics = {
        guyot: calculateReconstructionMetrics(guyotIPD, survivalPoints, atRiskTable),
        cenkm: calculateReconstructionMetrics(cenkmIPD, survivalPoints, atRiskTable)
    };
    
    // Determine winner
    metrics.recommendation = metrics.cenkm.overallScore > metrics.guyot.overallScore 
        ? 'CEN-KM' : 'Guyot';
    
    metrics.improvement = ((metrics.cenkm.overallScore - metrics.guyot.overallScore) / 
                          metrics.guyot.overallScore * 100).toFixed(1) + '%';
    
    return metrics;
}

/**
 * Calculate reconstruction quality metrics
 */
function calculateReconstructionMetrics(ipd, survivalPoints, riskTable) {
    const metrics = {
        n: ipd.length,
        events: ipd.filter(p => p.status === 1).length,
        censored: ipd.filter(p => p.status === 0).length,
        riskTableErrors: [],
        survivalErrors: [],
        overallScore: 0
    };
    
    // Check risk table alignment
    if (riskTable && riskTable.length > 0) {
        riskTable.forEach(rt => {
            const atRisk = ipd.filter(p => p.time >= rt.time).length;
            metrics.riskTableErrors.push({
                time: rt.time,
                expected: rt.nrisk,
                actual: atRisk,
                error: Math.abs(atRisk - rt.nrisk)
            });
        });
    }
    
    // Check survival curve fidelity (using KM on reconstructed data)
    const kmFromIPD = calculateKMFromIPD(ipd);
    survivalPoints.forEach(sp => {
        const reconS = getKMSurvivalAt(kmFromIPD, sp.x);
        metrics.survivalErrors.push({
            time: sp.x,
            expected: sp.y,
            actual: reconS,
            error: Math.abs(reconS - sp.y)
        });
    });
    
    // Overall score (lower is better, convert to percentage)
    const avgRiskError = metrics.riskTableErrors.length > 0
        ? metrics.riskTableErrors.reduce((s, e) => s + e.error, 0) / metrics.riskTableErrors.length
        : 0;
    const avgSurvError = metrics.survivalErrors.length > 0
        ? metrics.survivalErrors.reduce((s, e) => s + e.error, 0) / metrics.survivalErrors.length
        : 0;
    
    // Score: 100 = perfect, penalize for errors
    metrics.overallScore = Math.max(0, 100 - (avgRiskError * 2) - (avgSurvError * 100));
    
    return metrics;
}

/**
 * Calculate KM survival function from IPD
 */
function calculateKMFromIPD(ipd) {
    const sorted = [...ipd].sort((a, b) => a.time - b.time);
    const km = [];
    let n = sorted.length;
    let s = 1.0;
    
    let i = 0;
    while (i < sorted.length) {
        const t = sorted[i].time;
        let events = 0;
        let censored = 0;
        
        // Count events and censors at this time
        while (i < sorted.length && sorted[i].time === t) {
            if (sorted[i].status === 1) events++;
            else censored++;
            i++;
        }
        
        // KM estimator: S(t) = S(t-) × (1 - d/n)
        if (events > 0) {
            s = s * (1 - events / n);
        }
        
        km.push({ time: t, survival: s, atRisk: n, events, censored });
        n = n - events - censored;
    }
    
    return km;
}

/**
 * Get KM survival at specific time (step function lookup)
 */
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

// ============================================
// UI Integration for CEN-KM
// ============================================

/**
 * Run CEN-KM reconstruction with current state data
 */
function runCENKMReconstruction() {
    if (state.points.length === 0) {
        showToast('No digitized points', 'error');
        return;
    }
    
    showProcessing('Running CEN-KM reconstruction...', 0);
    
    setTimeout(() => {
        try {
            const config = CURVE_TYPES[state.curveType];
            state.reconstructedData = {};
            let totalN = 0, totalEvents = 0, totalCensored = 0;
            
            state.arms.forEach((arm, armIndex) => {
                updateProcessing(`Reconstructing arm ${armIndex + 1}...`, 
                                 (armIndex / state.arms.length) * 80);
                
                const points = state.points
                    .filter(p => p.armIndex === armIndex && !p.isCensor)
                    .sort((a, b) => a.x - b.x);
                
                if (points.length < 2) {
                    state.reconstructedData[armIndex] = [];
                    return;
                }
                
                // Get at-risk table
                const atRisk = state.atRisk[armIndex] || parseAtRisk(armIndex);
                
                // Get censoring ticks if available
                const ticks = state.censoringTicks?.[armIndex] || [];
                
                // Run CEN-KM
                const ipd = reconstructIPD_CENKM(points, atRisk, ticks, {
                    armName: arm.name,
                    matchTolerance: 0.003, // 0.3% tolerance
                    maxExtraCensorsPerBin: 15,
                    candidateRange: 3,
                    alignWithRiskTable: true,
                    debug: false
                });
                
                state.reconstructedData[armIndex] = ipd;
                totalN += ipd.length;
                totalEvents += ipd.filter(p => p.status === 1).length;
                totalCensored += ipd.filter(p => p.status === 0).length;
            });
            
            // Update UI
            updateProcessing('Updating display...', 90);
            
            document.getElementById('statN').textContent = totalN;
            document.getElementById('statEvents').textContent = totalEvents;
            document.getElementById('statCensored').textContent = totalCensored;
            
            // Preview
            let preview = 'time,status,arm\n';
            state.arms.forEach((arm, i) => {
                (state.reconstructedData[i] || []).slice(0, 20).forEach(p => {
                    preview += `${p.time?.toFixed(4)},${p.status},${arm.name}\n`;
                });
            });
            if (totalN > 40) preview += `... (${totalN} total rows)\n`;
            document.getElementById('dataPreview').textContent = preview;
            
            hideProcessing();
            switchTab('data');
            showToast(`CEN-KM: ${totalN} patients (${totalEvents} events, ${totalCensored} censored)`, 'success');
            
        } catch (err) {
            hideProcessing();
            console.error('CEN-KM error:', err);
            showToast('CEN-KM failed: ' + err.message, 'error');
        }
    }, 50);
}

// ============================================
// Export for external use
// ============================================

if (typeof window !== 'undefined') {
    window.SurvExtractEnhancements = {
        // WPD improvements
        enforceStepFunctionConstraints,
        postProcessStepFunction,
        runEnhancedValidation,
        calculateLineCenterOfMass,
        runCenterOfMassTrace,
        calculateMetaAnalysisQuality,
        // CEN-KM from RESOLVE-IPD
        reconstructIPD_CENKM,
        alignIPDWithRiskTable,
        compareReconstructionMethods,
        runCENKMReconstruction
    };
}
