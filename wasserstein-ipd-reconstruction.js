/**
 * Wasserstein-Enhanced IPD Reconstruction
 * 
 * Uses optimal transport theory to:
 * 1. Compare reconstructed vs true survival distributions (validation)
 * 2. Optimize reconstruction to minimize Wasserstein distance (improvement)
 * 3. Provide more robust metrics than pointwise KM comparison
 * 
 * Key insight: For 1D distributions, Wasserstein distance has closed form:
 * W_p = (∫|F₁⁻¹(q) - F₂⁻¹(q)|^p dq)^(1/p)
 * 
 * This compares QUANTILE functions, capturing full distributional shape.
 */

//==============================================================================
// TRUE IPD DATA (from R survival package)
//==============================================================================

const VETERAN_DATA = [
  [72,1],[411,1],[228,1],[126,1],[118,1],[10,1],[82,1],[110,1],[314,1],
  [100,0],[42,1],[8,1],[144,1],[25,0],[11,1],[30,1],[384,1],[4,1],
  [54,1],[13,1],[123,0],[97,0],[153,1],[59,1],[117,1],[16,1],[151,1],
  [22,1],[56,1],[21,1],[18,1],[139,1],[20,1],[31,1],[52,1],[287,1],
  [18,1],[51,1],[122,1],[27,1],[54,1],[7,1],[63,1],[392,1],[10,1],
  [8,1],[92,1],[35,1],[117,1],[132,1],[12,1],[162,1],[3,1],[95,1],
  [177,1],[162,1],[216,1],[553,1],[278,1],[12,1],[260,1],[200,1],
  [156,1],[182,0],[143,1],[105,1],[103,1],[250,1],[999,1],[112,1],
  [87,0],[231,1],[242,1],[991,1],[111,1],[1,1],[587,1],[389,1],
  [33,1],[25,1],[357,1],[467,1],[201,1],[1,1],[30,1],[44,1],[283,1],
  [15,1],[25,1],[103,1],[21,1],[13,1],[87,1],[2,1],[20,1],[7,1],
  [24,1],[99,1],[8,1],[99,1],[61,1],[25,1],[95,1],[80,1],[51,1],
  [29,1],[24,1],[18,1],[83,0],[31,1],[51,1],[90,1],[52,1],[73,1],
  [8,1],[36,1],[48,1],[7,1],[140,1],[186,1],[84,1],[19,1],[45,1],
  [80,1],[52,1],[164,1],[19,1],[53,1],[15,1],[43,1],[340,1],[133,1],
  [111,1],[231,1],[378,1],[49,1]
].map(d => ({ time: d[0], status: d[1] }));

const LUNG_DATA = [
  [306,1],[455,1],[1010,0],[210,1],[883,1],[1022,0],[310,1],[361,1],[218,1],[166,1],
  [170,1],[654,1],[728,0],[71,1],[567,1],[144,1],[613,0],[707,1],[61,1],[88,1],
  [301,1],[81,1],[624,0],[371,1],[394,1],[520,1],[574,1],[118,1],[390,1],[12,1],
  [473,1],[26,1],[533,1],[107,1],[53,1],[122,1],[814,0],[965,0],[93,1],[731,0],
  [460,1],[153,1],[433,1],[583,1],[95,1],[303,1],[519,1],[643,1],[765,0],[735,1],
  [189,1],[53,1],[246,1],[689,1],[65,1],[5,1],[132,1],[687,1],[345,1],[444,1],
  [223,1],[175,1],[60,1],[163,1],[65,1],[821,0],[428,1],[230,1],[840,0],[305,1]
].map(d => ({ time: d[0], status: d[1] }));

// High censoring dataset
const OVARIAN_DATA = [
  [59,1],[115,1],[156,1],[421,0],[431,1],[448,0],[464,1],[475,1],[477,0],[563,1],
  [638,1],[744,0],[769,0],[770,0],[803,0],[855,0],[1040,0],[1106,0],[1129,0],
  [1206,0],[268,1],[329,1],[353,1],[365,1],[377,0],[638,1]
].map(d => ({ time: d[0], status: d[1] }));


//==============================================================================
// WASSERSTEIN DISTANCE CALCULATIONS
//==============================================================================

/**
 * Calculate Wasserstein-1 distance between two survival distributions
 * Using the closed-form: W_1 = ∫|S₁(t) - S₂(t)|dt
 * 
 * This is the area between two survival curves!
 * 
 * @param {Array} surv1 - First survival curve [{time, surv}]
 * @param {Array} surv2 - Second survival curve [{time, surv}]
 * @param {number} maxTime - Maximum time to integrate over
 * @returns {number} Wasserstein-1 distance
 */
function wassersteinSurvival1(surv1, surv2, maxTime = null) {
  // Get all unique time points
  const times1 = surv1.map(s => s.time);
  const times2 = surv2.map(s => s.time);
  const allTimes = [...new Set([...times1, ...times2, 0])].sort((a, b) => a - b);
  
  if (maxTime === null) {
    maxTime = Math.max(...allTimes);
  }
  
  // Filter to maxTime
  const evalTimes = allTimes.filter(t => t <= maxTime);
  if (evalTimes[evalTimes.length - 1] < maxTime) {
    evalTimes.push(maxTime);
  }
  
  // Calculate integral of |S1(t) - S2(t)| dt
  let w1 = 0;
  
  for (let i = 0; i < evalTimes.length - 1; i++) {
    const t1 = evalTimes[i];
    const t2 = evalTimes[i + 1];
    const dt = t2 - t1;
    
    // Get survival at midpoint (step function interpolation)
    const s1 = getSurvAt(surv1, (t1 + t2) / 2);
    const s2 = getSurvAt(surv2, (t1 + t2) / 2);
    
    w1 += Math.abs(s1 - s2) * dt;
  }
  
  return w1;
}

/**
 * Calculate Wasserstein-2 distance between survival distributions
 * Using quantile functions: W_2 = sqrt(∫|Q₁(p) - Q₂(p)|² dp)
 * 
 * Where Q(p) = inf{t : S(t) ≤ 1-p} is the quantile function
 * 
 * @param {Array} surv1 - First survival curve
 * @param {Array} surv2 - Second survival curve
 * @param {number} nPoints - Number of quantile points to evaluate
 * @returns {number} Wasserstein-2 distance
 */
function wassersteinSurvival2(surv1, surv2, nPoints = 100) {
  let sumSq = 0;
  
  for (let i = 0; i < nPoints; i++) {
    const p = (i + 0.5) / nPoints;  // Probability level
    
    // Get quantiles (time when survival crosses 1-p)
    const q1 = getQuantile(surv1, p);
    const q2 = getQuantile(surv2, p);
    
    if (q1 !== null && q2 !== null) {
      sumSq += (q1 - q2) ** 2;
    }
  }
  
  return Math.sqrt(sumSq / nPoints);
}

/**
 * Get survival quantile (time when survival probability = 1-p)
 */
function getQuantile(surv, p) {
  const target = 1 - p;
  
  // Find first time where survival drops to or below target
  for (let i = 0; i < surv.length; i++) {
    if (surv[i].surv <= target) {
      return surv[i].time;
    }
  }
  
  // If not reached, return max time
  return surv[surv.length - 1].time;
}

/**
 * Get survival probability at time t (step function)
 */
function getSurvAt(surv, t) {
  let s = 1.0;
  for (const point of surv) {
    if (point.time <= t) s = point.surv;
    else break;
  }
  return s;
}


//==============================================================================
// KM CALCULATION AND RECONSTRUCTION
//==============================================================================

function calculateKM(ipd) {
  const sorted = [...ipd].sort((a, b) => a.time - b.time);
  const result = [{ time: 0, surv: 1.0 }];
  let currentN = sorted.length;
  let currentS = 1.0;
  let i = 0;
  
  while (i < sorted.length) {
    const currentTime = sorted[i].time;
    let events = 0;
    let censored = 0;
    
    while (i < sorted.length && sorted[i].time === currentTime) {
      if (sorted[i].status === 1) events++;
      else censored++;
      i++;
    }
    
    if (events > 0 && currentN > 0) {
      currentS *= (currentN - events) / currentN;
      result.push({ time: currentTime, surv: currentS });
    }
    
    currentN -= events + censored;
  }
  
  return result;
}

function extractAtRiskTable(km, nPoints = 6) {
  const maxTime = km[km.length - 1].time;
  const times = Array.from({ length: nPoints }, (_, i) => i / (nPoints - 1) * maxTime * 0.9);
  
  return times.map(t => {
    // Count patients still at risk at time t
    // This is approximate - in real scenario we'd have actual at-risk numbers
    const survAtT = getSurvAt(km, t);
    const n0 = Math.round(100 / km[1]?.surv || 100); // Estimate initial n
    return { time: t, n_risk: Math.round(survAtT * n0) };
  });
}

/**
 * Standard CEN-KM reconstruction
 */
function cenKmReconstruct(survPoints, atRiskTable) {
  if (survPoints[0].time > 0) {
    survPoints = [{ time: 0, surv: 1.0 }, ...survPoints];
  }
  
  const ipd = [];
  
  for (let i = 0; i < atRiskTable.length; i++) {
    const tStart = atRiskTable[i].time;
    const tEnd = i < atRiskTable.length - 1 
      ? atRiskTable[i + 1].time 
      : survPoints[survPoints.length - 1].time;
    
    const nStart = atRiskTable[i].n_risk;
    const nEnd = i < atRiskTable.length - 1 ? atRiskTable[i + 1].n_risk : 0;
    
    const sStart = getSurvAt(survPoints, tStart);
    const sEnd = getSurvAt(survPoints, tEnd);
    
    let nEvents = sStart > 0 ? Math.round(nStart * (1 - sEnd / sStart)) : 0;
    nEvents = Math.max(0, Math.min(nEvents, nStart));
    
    const nCensored = Math.max(0, nStart - nEnd - nEvents);
    const width = tEnd - tStart;
    
    // Events spread uniformly
    for (let k = 0; k < nEvents; k++) {
      ipd.push({ time: tStart + (k + 0.5) * width / nEvents, status: 1 });
    }
    
    // Censored with right-skewed distribution
    for (let k = 0; k < nCensored; k++) {
      const pos = Math.pow((k + 0.5) / nCensored, 0.6);
      ipd.push({ time: tStart + pos * width * 0.95, status: 0 });
    }
  }
  
  return ipd.sort((a, b) => a.time - b.time);
}


//==============================================================================
// WASSERSTEIN-OPTIMIZED RECONSTRUCTION
//==============================================================================

/**
 * Wasserstein-optimal IPD reconstruction
 * 
 * Key insight: Minimize W_2 by matching quantiles directly.
 * For each quantile level p, place an event at time Q(p) where
 * Q(p) is the survival quantile from the target curve.
 * 
 * This is essentially "quantile matching" reconstruction.
 */
function wassersteinOptimalReconstruct(survPoints, atRiskTable, nQuantiles = 100) {
  if (survPoints[0].time > 0) {
    survPoints = [{ time: 0, surv: 1.0 }, ...survPoints];
  }
  
  const maxTime = survPoints[survPoints.length - 1].time;
  const n0 = atRiskTable[0]?.n_risk || 100;
  
  // Estimate total events from survival curve
  const finalSurv = survPoints[survPoints.length - 1].surv;
  const nEvents = Math.round(n0 * (1 - finalSurv));
  const nCensored = n0 - nEvents;
  
  const ipd = [];
  
  // Place events at quantile times
  // Event at quantile p means time Q(p) where S(Q(p)) = 1-p
  for (let i = 0; i < nEvents; i++) {
    // Spread events across quantile levels 0 to 1-finalSurv
    const p = (i + 0.5) / nEvents * (1 - finalSurv);
    const eventTime = getQuantile(survPoints, p);
    
    ipd.push({ time: eventTime, status: 1 });
  }
  
  // Place censored observations
  // Use at-risk table to inform censoring distribution
  for (let k = 0; k < nCensored; k++) {
    // Find interval for this censored observation
    let interval = atRiskTable.length - 1;
    for (let i = 0; i < atRiskTable.length - 1; i++) {
      const expectedCensored = atRiskTable[i].n_risk - atRiskTable[i + 1].n_risk;
      // Distribute based on expected censoring per interval
      if (Math.random() < expectedCensored / nCensored) {
        interval = i;
        break;
      }
    }
    
    const tStart = atRiskTable[interval].time;
    const tEnd = interval < atRiskTable.length - 1 
      ? atRiskTable[interval + 1].time 
      : maxTime;
    
    // Right-skewed within interval
    const pos = Math.pow(Math.random(), 0.5);
    ipd.push({ time: tStart + pos * (tEnd - tStart), status: 0 });
  }
  
  return ipd.sort((a, b) => a.time - b.time);
}

/**
 * Iterative Wasserstein optimization
 * 
 * Start with CEN-KM reconstruction, then iteratively adjust
 * event times to minimize Wasserstein distance.
 */
function iterativeWassersteinReconstruct(survPoints, atRiskTable, maxIter = 50) {
  if (survPoints[0].time > 0) {
    survPoints = [{ time: 0, surv: 1.0 }, ...survPoints];
  }
  
  // Start with CEN-KM
  let ipd = cenKmReconstruct(survPoints, atRiskTable);
  let reconKM = calculateKM(ipd);
  let bestW1 = wassersteinSurvival1(survPoints, reconKM);
  
  console.log(`  Initial W1: ${bestW1.toFixed(2)}`);
  
  // Iteratively adjust event times
  for (let iter = 0; iter < maxIter; iter++) {
    let improved = false;
    
    for (let i = 0; i < ipd.length; i++) {
      if (ipd[i].status !== 1) continue;  // Only adjust events
      
      const originalTime = ipd[i].time;
      
      // Try adjusting event time toward quantile
      const idx = ipd.filter((p, j) => j < i && p.status === 1).length;
      const nEvents = ipd.filter(p => p.status === 1).length;
      const p = (idx + 0.5) / nEvents;
      const targetTime = getQuantile(survPoints, p * (1 - survPoints[survPoints.length - 1].surv));
      
      // Move toward target
      const newTime = originalTime + 0.3 * (targetTime - originalTime);
      ipd[i].time = Math.max(0.1, newTime);
      
      // Recalculate
      reconKM = calculateKM(ipd.sort((a, b) => a.time - b.time));
      const newW1 = wassersteinSurvival1(survPoints, reconKM);
      
      if (newW1 < bestW1) {
        bestW1 = newW1;
        improved = true;
      } else {
        ipd[i].time = originalTime;  // Revert
      }
    }
    
    if (!improved) break;
  }
  
  console.log(`  Final W1: ${bestW1.toFixed(2)}`);
  
  return ipd.sort((a, b) => a.time - b.time);
}


//==============================================================================
// COMPREHENSIVE VALIDATION METRICS
//==============================================================================

function calculateAllMetrics(trueIPD, reconIPD, name = '') {
  const trueKM = calculateKM(trueIPD);
  const reconKM = calculateKM(reconIPD);
  const maxTime = Math.max(...trueIPD.map(p => p.time));
  
  // Traditional metrics
  const trueEvents = trueIPD.filter(p => p.status === 1).length;
  const reconEvents = reconIPD.filter(p => p.status === 1).length;
  
  const trueMedian = getQuantile(trueKM, 0.5);
  const reconMedian = getQuantile(reconKM, 0.5);
  
  // RMST
  const tau = maxTime * 0.75;
  const trueRMST = calculateRMST(trueKM, tau);
  const reconRMST = calculateRMST(reconKM, tau);
  
  // Max pointwise difference
  let maxDiff = 0;
  for (let t = 0; t <= maxTime; t += maxTime / 100) {
    const diff = Math.abs(getSurvAt(trueKM, t) - getSurvAt(reconKM, t));
    maxDiff = Math.max(maxDiff, diff);
  }
  
  // WASSERSTEIN METRICS
  const w1 = wassersteinSurvival1(trueKM, reconKM, maxTime);
  const w2 = wassersteinSurvival2(trueKM, reconKM);
  
  // Normalized Wasserstein (divide by max possible = maxTime for W1)
  const w1_normalized = w1 / maxTime;
  
  return {
    n: { true: trueIPD.length, recon: reconIPD.length },
    events: { true: trueEvents, recon: reconEvents, pctDiff: ((reconEvents - trueEvents) / trueEvents * 100).toFixed(1) },
    median: { true: trueMedian, recon: reconMedian, pctDiff: trueMedian ? ((reconMedian - trueMedian) / trueMedian * 100).toFixed(1) : 'N/A' },
    rmst: { true: trueRMST.toFixed(1), recon: reconRMST.toFixed(1), pctDiff: ((reconRMST - trueRMST) / trueRMST * 100).toFixed(2) },
    maxSurvDiff: maxDiff.toFixed(4),
    wasserstein: {
      w1: w1.toFixed(2),
      w2: w2.toFixed(2),
      w1_normalized: w1_normalized.toFixed(4)
    }
  };
}

function calculateRMST(km, tau) {
  let rmst = 0;
  let prevTime = 0;
  let prevSurv = 1.0;
  
  for (const point of km) {
    const t = Math.min(point.time, tau);
    if (t > prevTime) {
      rmst += (t - prevTime) * prevSurv;
      prevTime = t;
    }
    prevSurv = point.surv;
    if (point.time >= tau) break;
  }
  
  if (prevTime < tau) {
    rmst += (tau - prevTime) * prevSurv;
  }
  
  return rmst;
}


//==============================================================================
// RUN VALIDATION
//==============================================================================

console.log('\n╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║          WASSERSTEIN-ENHANCED IPD RECONSTRUCTION VALIDATION             ║');
console.log('║     Comparing CEN-KM vs Wasserstein-Optimal vs True IPD                 ║');
console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

const datasets = [
  { name: 'Veterans\' Admin Lung (94% events)', data: VETERAN_DATA },
  { name: 'NCCTG Lung (84% events)', data: LUNG_DATA },
  { name: 'Ovarian (50% events - HIGH CENSORING)', data: OVARIAN_DATA }
];

for (const ds of datasets) {
  console.log('='.repeat(75));
  console.log(`DATASET: ${ds.name}`);
  console.log('='.repeat(75));
  
  const trueIPD = ds.data;
  const trueKM = calculateKM(trueIPD);
  const atRiskTable = extractAtRiskTable(trueKM, 6);
  
  console.log(`True IPD: n=${trueIPD.length}, events=${trueIPD.filter(p => p.status === 1).length}\n`);
  
  // Method 1: Standard CEN-KM
  console.log('1. CEN-KM Reconstruction:');
  const cenkmIPD = cenKmReconstruct(trueKM, atRiskTable);
  const cenkmMetrics = calculateAllMetrics(trueIPD, cenkmIPD);
  
  console.log(`   Events: ${cenkmMetrics.events.recon} (${cenkmMetrics.events.pctDiff}% diff)`);
  console.log(`   Median: ${cenkmMetrics.median.recon?.toFixed(1) || 'NR'} vs ${cenkmMetrics.median.true?.toFixed(1) || 'NR'} (${cenkmMetrics.median.pctDiff}% diff)`);
  console.log(`   RMST: ${cenkmMetrics.rmst.recon} vs ${cenkmMetrics.rmst.true} (${cenkmMetrics.rmst.pctDiff}% diff)`);
  console.log(`   Max S(t) diff: ${cenkmMetrics.maxSurvDiff}`);
  console.log(`   ★ Wasserstein-1: ${cenkmMetrics.wasserstein.w1} (normalized: ${cenkmMetrics.wasserstein.w1_normalized})`);
  console.log(`   ★ Wasserstein-2: ${cenkmMetrics.wasserstein.w2}`);
  
  // Method 2: Wasserstein-Optimal (Quantile Matching)
  console.log('\n2. Wasserstein-Optimal (Quantile Matching):');
  const wOptIPD = wassersteinOptimalReconstruct(trueKM, atRiskTable);
  const wOptMetrics = calculateAllMetrics(trueIPD, wOptIPD);
  
  console.log(`   Events: ${wOptMetrics.events.recon} (${wOptMetrics.events.pctDiff}% diff)`);
  console.log(`   Median: ${wOptMetrics.median.recon?.toFixed(1) || 'NR'} vs ${wOptMetrics.median.true?.toFixed(1) || 'NR'} (${wOptMetrics.median.pctDiff}% diff)`);
  console.log(`   RMST: ${wOptMetrics.rmst.recon} vs ${wOptMetrics.rmst.true} (${wOptMetrics.rmst.pctDiff}% diff)`);
  console.log(`   Max S(t) diff: ${wOptMetrics.maxSurvDiff}`);
  console.log(`   ★ Wasserstein-1: ${wOptMetrics.wasserstein.w1} (normalized: ${wOptMetrics.wasserstein.w1_normalized})`);
  console.log(`   ★ Wasserstein-2: ${wOptMetrics.wasserstein.w2}`);
  
  // Method 3: Iterative Wasserstein Optimization
  console.log('\n3. Iterative Wasserstein Optimization:');
  const iterIPD = iterativeWassersteinReconstruct(trueKM, atRiskTable);
  const iterMetrics = calculateAllMetrics(trueIPD, iterIPD);
  
  console.log(`   Events: ${iterMetrics.events.recon} (${iterMetrics.events.pctDiff}% diff)`);
  console.log(`   Median: ${iterMetrics.median.recon?.toFixed(1) || 'NR'} vs ${iterMetrics.median.true?.toFixed(1) || 'NR'} (${iterMetrics.median.pctDiff}% diff)`);
  console.log(`   RMST: ${iterMetrics.rmst.recon} vs ${iterMetrics.rmst.true} (${iterMetrics.rmst.pctDiff}% diff)`);
  console.log(`   Max S(t) diff: ${iterMetrics.maxSurvDiff}`);
  console.log(`   ★ Wasserstein-1: ${iterMetrics.wasserstein.w1} (normalized: ${iterMetrics.wasserstein.w1_normalized})`);
  console.log(`   ★ Wasserstein-2: ${iterMetrics.wasserstein.w2}`);
  
  console.log('\n');
}


//==============================================================================
// SUMMARY AND INTERPRETATION
//==============================================================================

console.log('\n╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║                         KEY INSIGHTS                                     ║');
console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

console.log('WHY WASSERSTEIN HELPS IPD RECONSTRUCTION:\n');

console.log('1. BETTER VALIDATION METRIC:');
console.log('   - W1 (area between curves) captures GLOBAL distributional difference');
console.log('   - More robust than max pointwise difference or single quantiles');
console.log('   - Naturally handles censoring through survival function comparison\n');

console.log('2. QUANTILE MATCHING:');
console.log('   - W2 = integral of squared quantile differences');
console.log('   - Optimizing W2 → place events at correct quantile times');
console.log('   - This is "optimal transport" of probability mass\n');

console.log('3. OPTIMIZATION TARGET:');
console.log('   - Traditional: Match KM steps and at-risk numbers');
console.log('   - Wasserstein: Match the ENTIRE distribution shape');
console.log('   - Better for downstream statistical analyses\n');

console.log('4. NORMALIZED W1 INTERPRETATION:');
console.log('   - W1 / max_time = "average survival probability difference"');
console.log('   - Values < 0.01 = excellent reconstruction');
console.log('   - Values 0.01-0.05 = good reconstruction');
console.log('   - Values > 0.05 = needs improvement\n');

console.log('RECOMMENDATION:');
console.log('Use Wasserstein-1 (normalized) as primary validation metric alongside');
console.log('traditional metrics (median, RMST, HR). W1 captures full distributional');
console.log('accuracy that single statistics miss.\n');

console.log('✓ Wasserstein validation complete!');
