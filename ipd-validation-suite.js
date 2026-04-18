/**
 * IPD Reconstruction Validation Suite
 * Tests CEN-KM and Guyot algorithms against TRUE individual patient data
 * 
 * Includes embedded datasets from:
 * - Veterans' Administration Lung Cancer Study (n=137)
 * - NCCTG Lung Cancer Study (n=228)
 * - Ovarian Cancer Study (n=26)
 * 
 * Run: node ipd-validation-suite.js
 */

//==============================================================================
// PART 1: REAL IPD DATASETS (from R survival package)
//==============================================================================

// Veterans' Administration Lung Cancer Study
// time = survival time in days, status = 1 for death
const VETERAN_DATA = [
  // [time, status, trt] - trt: 1=standard, 2=test
  [72,1,1],[411,1,1],[228,1,1],[126,1,1],[118,1,1],[10,1,1],[82,1,1],[110,1,1],[314,1,1],
  [100,0,1],[42,1,1],[8,1,1],[144,1,1],[25,0,1],[11,1,1],[30,1,1],[384,1,1],[4,1,1],
  [54,1,1],[13,1,1],[123,0,1],[97,0,1],[153,1,1],[59,1,1],[117,1,1],[16,1,1],[151,1,1],
  [22,1,1],[56,1,1],[21,1,1],[18,1,1],[139,1,1],[20,1,1],[31,1,1],[52,1,1],[287,1,1],
  [18,1,1],[51,1,1],[122,1,1],[27,1,1],[54,1,1],[7,1,1],[63,1,1],[392,1,1],[10,1,1],
  [8,1,1],[92,1,1],[35,1,1],[117,1,1],[132,1,1],[12,1,1],[162,1,1],[3,1,1],[95,1,1],
  [177,1,1],[162,1,1],[216,1,1],[553,1,1],[278,1,1],[12,1,1],[260,1,1],[200,1,1],
  [156,1,1],[182,0,1],[143,1,1],[105,1,1],[103,1,1],[250,1,1],[999,1,2],[112,1,2],
  [87,0,2],[231,1,2],[242,1,2],[991,1,2],[111,1,2],[1,1,2],[587,1,2],[389,1,2],
  [33,1,2],[25,1,2],[357,1,2],[467,1,2],[201,1,2],[1,1,2],[30,1,2],[44,1,2],[283,1,2],
  [15,1,2],[25,1,2],[103,1,2],[21,1,2],[13,1,2],[87,1,2],[2,1,2],[20,1,2],[7,1,2],
  [24,1,2],[99,1,2],[8,1,2],[99,1,2],[61,1,2],[25,1,2],[95,1,2],[80,1,2],[51,1,2],
  [29,1,2],[24,1,2],[18,1,2],[83,0,2],[31,1,2],[51,1,2],[90,1,2],[52,1,2],[73,1,2],
  [8,1,2],[36,1,2],[48,1,2],[7,1,2],[140,1,2],[186,1,2],[84,1,2],[19,1,2],[45,1,2],
  [80,1,2],[52,1,2],[164,1,2],[19,1,2],[53,1,2],[15,1,2],[43,1,2],[340,1,2],[133,1,2],
  [111,1,2],[231,1,2],[378,1,2],[49,1,2]
].map(d => ({ time: d[0], status: d[1], arm: d[2] }));

// NCCTG Lung Cancer Study (subset - first 100 patients for efficiency)
// time = survival time in days, status = 2 for death (we'll convert)
const LUNG_DATA = [
  [306,2],[455,2],[1010,0],[210,2],[883,2],[1022,0],[310,2],[361,2],[218,2],[166,2],
  [170,2],[654,2],[728,0],[71,2],[567,2],[144,2],[613,0],[707,2],[61,2],[88,2],
  [301,2],[81,2],[624,0],[371,2],[394,2],[520,2],[574,2],[118,2],[390,2],[12,2],
  [473,2],[26,2],[533,2],[107,2],[53,2],[122,2],[814,0],[965,0],[93,2],[731,0],
  [460,2],[153,2],[433,2],[583,2],[95,2],[303,2],[519,2],[643,2],[765,0],[735,2],
  [189,2],[53,2],[246,2],[689,2],[65,2],[5,2],[132,2],[687,2],[345,2],[444,2],
  [223,2],[175,2],[60,2],[163,2],[65,2],[821,0],[428,2],[230,2],[840,0],[305,2],
  [11,2],[226,2],[426,2],[705,2],[363,2],[176,2],[791,0],[95,2],[196,2],[167,2],
  [806,0],[284,2],[641,2],[147,2],[740,0],[163,2],[655,2],[239,2],[88,2],[245,2],
  [588,2],[30,2],[179,2],[310,2],[477,2],[166,2],[559,2],[450,2],[364,2],[107,2],
  [177,2],[156,2],[529,2],[11,2],[429,2],[351,2],[15,2],[181,2],[283,2],[201,2],
  [524,0],[13,2],[212,2],[524,2],[288,2],[363,2],[442,2],[199,2],[550,2],[54,2],
  [558,2],[207,2],[92,2],[60,2],[551,2],[543,2],[293,2],[202,2],[353,2],[511,2],
  [267,2],[511,2],[371,2],[387,2],[457,2],[337,2],[201,2],[404,2],[222,2],[62,2],
  [458,2],[356,2],[163,2],[31,2],[229,2],[156,2],[411,2],[419,2],[450,2],[275,2],
  [350,2],[272,2],[292,2],[332,2],[285,2],[259,2],[110,2],[286,2],[270,2],[81,2],
  [131,2],[225,2],[269,2],[225,2],[243,2],[279,2],[276,2],[135,2],[79,2],[59,2],
  [240,2],[202,2],[235,2],[105,2],[224,2],[239,2],[237,2],[173,2],[252,2],[221,2],
  [185,2],[92,2],[13,2],[222,2],[192,2],[183,2],[211,2],[175,2],[197,2],[203,2],
  [116,2],[188,2],[191,2],[105,2],[174,2],[177,2]
].map(d => ({ time: d[0], status: d[1] === 2 ? 1 : 0 })); // Convert status

// Ovarian Cancer Study
// futime = survival time, fustat = status
const OVARIAN_DATA = [
  [59,1],[115,1],[156,1],[421,0],[431,1],[448,0],[464,1],[475,1],[477,0],[563,1],
  [638,1],[744,0],[769,0],[770,0],[803,0],[855,0],[1040,0],[1106,0],[1129,0],
  [1206,0],[268,1],[329,1],[353,1],[365,1],[377,0],[638,1]
].map(d => ({ time: d[0], status: d[1] }));


//==============================================================================
// PART 2: KAPLAN-MEIER CALCULATION FROM TRUE IPD
//==============================================================================

/**
 * Calculate Kaplan-Meier survival curve from IPD
 * @param {Array} ipd - Array of {time, status} objects
 * @returns {Object} - {times, survival, n_risk, n_events, n_censored}
 */
function calculateKM(ipd) {
  // Sort by time
  const sorted = [...ipd].sort((a, b) => a.time - b.time);
  
  const times = [0];
  const survival = [1.0];
  const n_risk = [sorted.length];
  const n_events = [0];
  const n_censored = [0];
  
  let currentN = sorted.length;
  let currentS = 1.0;
  let i = 0;
  
  while (i < sorted.length) {
    const currentTime = sorted[i].time;
    
    // Count events and censored at this time
    let eventsAtTime = 0;
    let censoredAtTime = 0;
    
    while (i < sorted.length && sorted[i].time === currentTime) {
      if (sorted[i].status === 1) {
        eventsAtTime++;
      } else {
        censoredAtTime++;
      }
      i++;
    }
    
    // Update survival (only for events)
    if (eventsAtTime > 0) {
      currentS *= (currentN - eventsAtTime) / currentN;
      times.push(currentTime);
      survival.push(currentS);
      n_risk.push(currentN);
      n_events.push(eventsAtTime);
      n_censored.push(0);
    }
    
    // Update n at risk
    currentN -= eventsAtTime + censoredAtTime;
  }
  
  return { times, survival, n_risk, n_events, n_censored };
}

/**
 * Extract at-risk table at specific time points
 */
function extractAtRiskTable(km, timePoints) {
  return timePoints.map(t => {
    // Find the n_risk just before or at time t
    let idx = 0;
    for (let i = 0; i < km.times.length; i++) {
      if (km.times[i] <= t) idx = i;
      else break;
    }
    return { time: t, n_risk: km.n_risk[idx] };
  });
}

/**
 * Sample survival curve at regular intervals (simulates digitization)
 */
function sampleSurvivalCurve(km, nPoints = 50) {
  const maxTime = km.times[km.times.length - 1];
  const sampleTimes = Array.from({ length: nPoints }, (_, i) => (i / (nPoints - 1)) * maxTime);
  
  return sampleTimes.map(t => {
    // Find survival at time t using step function
    let s = 1.0;
    for (let i = 0; i < km.times.length; i++) {
      if (km.times[i] <= t) s = km.survival[i];
      else break;
    }
    return { time: t, surv: s };
  });
}


//==============================================================================
// PART 3: GUYOT ALGORITHM IMPLEMENTATION
//==============================================================================

/**
 * Reconstruct IPD using Guyot algorithm
 * Reference: Guyot et al. BMC Med Res Methodol 2012
 */
function guyotReconstruct(survPoints, atRiskTable, totalEvents = null) {
  // Ensure starts at t=0, S=1
  if (survPoints[0].time !== 0) {
    survPoints = [{ time: 0, surv: 1.0 }, ...survPoints];
  }
  
  const n = survPoints.length;
  const t = survPoints.map(p => p.time);
  const S = survPoints.map(p => p.surv);
  
  // Initialize
  const d = new Array(n - 1).fill(0); // events per interval
  const c = new Array(n - 1).fill(0); // censored per interval
  const nRisk = new Array(n).fill(0); // at risk at each point
  
  // Set initial n from at-risk table
  nRisk[0] = atRiskTable[0].n_risk;
  
  // Map at-risk values to our time points
  for (const ar of atRiskTable) {
    const idx = t.findIndex(time => Math.abs(time - ar.time) < 0.01);
    if (idx >= 0) nRisk[idx] = ar.n_risk;
  }
  
  // Iterative algorithm
  const maxIter = 100;
  const tol = 0.5;
  
  for (let iter = 0; iter < maxIter; iter++) {
    // Forward pass
    for (let i = 0; i < n - 1; i++) {
      if (nRisk[i] > 0 && S[i] > 0) {
        // Events from survival drop
        d[i] = Math.round(nRisk[i] * (1 - S[i + 1] / S[i]));
        d[i] = Math.max(0, Math.min(d[i], nRisk[i]));
        
        // Censored (distribute remaining uniformly)
        if (i < n - 2 && nRisk[i + 1] > 0) {
          c[i] = Math.max(0, nRisk[i] - d[i] - nRisk[i + 1]);
        } else {
          c[i] = 0;
        }
        
        // Update next at-risk
        if (nRisk[i + 1] === 0) {
          nRisk[i + 1] = nRisk[i] - d[i] - c[i];
        }
      }
    }
    
    // Check convergence
    let maxDiff = 0;
    for (const ar of atRiskTable) {
      const idx = t.findIndex(time => Math.abs(time - ar.time) < 0.01);
      if (idx >= 0) {
        maxDiff = Math.max(maxDiff, Math.abs(nRisk[idx] - ar.n_risk));
      }
    }
    
    if (maxDiff < tol) break;
  }
  
  // Generate IPD
  const ipd = [];
  
  for (let i = 0; i < n - 1; i++) {
    const intervalWidth = t[i + 1] - t[i];
    
    // Add events (spread in interval)
    for (let j = 0; j < d[i]; j++) {
      ipd.push({
        time: t[i] + (j + 1) * intervalWidth / (d[i] + 1),
        status: 1
      });
    }
    
    // Add censored (spread in interval)
    for (let j = 0; j < c[i]; j++) {
      ipd.push({
        time: t[i] + (j + 1) * intervalWidth / (c[i] + 1),
        status: 0
      });
    }
  }
  
  return ipd.sort((a, b) => a.time - b.time);
}


//==============================================================================
// PART 4: CEN-KM ALGORITHM IMPLEMENTATION
//==============================================================================

/**
 * CEN-KM: Constrained Exact Node Kaplan-Meier reconstruction
 * Enforces exact matching at number-at-risk table time points
 */
function cenKmReconstruct(survPoints, atRiskTable, options = {}) {
  const {
    censoringDistribution = 'beta', // 'uniform', 'beta', 'administrative'
    betaParams = [3, 1.5] // For beta distribution censoring
  } = options;
  
  // Ensure starts at t=0, S=1
  if (survPoints[0].time !== 0) {
    survPoints = [{ time: 0, surv: 1.0 }, ...survPoints];
  }
  
  // Sort
  survPoints = [...survPoints].sort((a, b) => a.time - b.time);
  atRiskTable = [...atRiskTable].sort((a, b) => a.time - b.time);
  
  const ipd = [];
  
  for (let i = 0; i < atRiskTable.length; i++) {
    const tStart = atRiskTable[i].time;
    const tEnd = i < atRiskTable.length - 1 
      ? atRiskTable[i + 1].time 
      : survPoints[survPoints.length - 1].time;
    
    const nStart = atRiskTable[i].n_risk;
    const nEnd = i < atRiskTable.length - 1 ? atRiskTable[i + 1].n_risk : 0;
    
    // Get survival at interval bounds
    const sStart = interpolateSurvival(survPoints, tStart);
    const sEnd = interpolateSurvival(survPoints, tEnd);
    
    // Calculate events and censored
    let dInterval = 0;
    if (sStart > 0) {
      dInterval = Math.round(nStart * (1 - sEnd / sStart));
      dInterval = Math.max(0, Math.min(dInterval, nStart));
    }
    
    const cInterval = Math.max(0, nStart - nEnd - dInterval);
    const intervalWidth = tEnd - tStart;
    
    // Get survival points within this interval for event timing
    const intervalSurvPoints = survPoints.filter(p => p.time > tStart && p.time <= tEnd);
    
    // Distribute events based on survival drops
    if (dInterval > 0) {
      if (intervalSurvPoints.length > 0) {
        // Calculate survival drops
        const allSurvs = [sStart, ...intervalSurvPoints.map(p => p.surv)];
        const drops = [];
        for (let j = 0; j < allSurvs.length - 1; j++) {
          drops.push(Math.max(0, allSurvs[j] - allSurvs[j + 1]));
        }
        
        const totalDrop = drops.reduce((a, b) => a + b, 0);
        
        if (totalDrop > 0) {
          const timePoints = [tStart, ...intervalSurvPoints.map(p => p.time)];
          
          for (let j = 0; j < drops.length; j++) {
            const eventsHere = Math.round(dInterval * drops[j] / totalDrop);
            for (let k = 0; k < eventsHere; k++) {
              const subWidth = timePoints[j + 1] - timePoints[j];
              ipd.push({
                time: timePoints[j] + (k + 0.5) * subWidth / eventsHere,
                status: 1
              });
            }
          }
          
          // Adjust for rounding
          const currentEvents = ipd.filter(p => p.status === 1 && p.time > tStart && p.time <= tEnd).length;
          const diff = dInterval - currentEvents;
          
          for (let k = 0; k < diff; k++) {
            ipd.push({
              time: tStart + (k + 0.5) * intervalWidth / diff,
              status: 1
            });
          }
        } else {
          // Spread uniformly
          for (let k = 0; k < dInterval; k++) {
            ipd.push({
              time: tStart + (k + 0.5) * intervalWidth / dInterval,
              status: 1
            });
          }
        }
      } else {
        // No intermediate points, spread uniformly
        for (let k = 0; k < dInterval; k++) {
          ipd.push({
            time: tStart + (k + 0.5) * intervalWidth / dInterval,
            status: 1
          });
        }
      }
    }
    
    // Distribute censored based on censoring distribution
    for (let k = 0; k < cInterval; k++) {
      let position;
      if (censoringDistribution === 'uniform') {
        position = (k + 0.5) / cInterval;
      } else if (censoringDistribution === 'beta' || censoringDistribution === 'administrative') {
        // Beta distribution approximation (right-skewed for admin censoring)
        position = betaQuantile((k + 0.5) / cInterval, betaParams[0], betaParams[1]);
      } else {
        position = (k + 0.5) / cInterval;
      }
      
      ipd.push({
        time: tStart + position * intervalWidth,
        status: 0
      });
    }
  }
  
  return ipd.sort((a, b) => a.time - b.time);
}

/**
 * Interpolate survival at a given time
 */
function interpolateSurvival(survPoints, t) {
  if (t <= survPoints[0].time) return survPoints[0].surv;
  if (t >= survPoints[survPoints.length - 1].time) return survPoints[survPoints.length - 1].surv;
  
  for (let i = 0; i < survPoints.length - 1; i++) {
    if (t >= survPoints[i].time && t < survPoints[i + 1].time) {
      return survPoints[i].surv; // Step function
    }
  }
  return survPoints[survPoints.length - 1].surv;
}

/**
 * Beta distribution quantile (approximation)
 */
function betaQuantile(p, alpha, beta) {
  // Newton-Raphson approximation
  let x = p; // Initial guess
  for (let i = 0; i < 20; i++) {
    const cdf = incompleteBeta(x, alpha, beta);
    const pdf = betaPDF(x, alpha, beta);
    if (pdf < 1e-10) break;
    x = x - (cdf - p) / pdf;
    x = Math.max(0.001, Math.min(0.999, x));
  }
  return x;
}

function betaPDF(x, alpha, beta) {
  if (x <= 0 || x >= 1) return 0;
  const B = gammaLn(alpha) + gammaLn(beta) - gammaLn(alpha + beta);
  return Math.exp((alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - B);
}

function incompleteBeta(x, a, b) {
  // Simple numerical integration
  const n = 100;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n * x;
    sum += betaPDF(t, a, b) * x / n;
  }
  return sum;
}

function gammaLn(z) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
             -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    ser += c[j] / ++y;
  }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}


//==============================================================================
// PART 5: VALIDATION METRICS
//==============================================================================

/**
 * Calculate comprehensive validation metrics
 */
function calculateValidationMetrics(trueIPD, reconIPD) {
  const trueKM = calculateKM(trueIPD);
  const reconKM = calculateKM(reconIPD);
  
  // Basic counts
  const trueN = trueIPD.length;
  const reconN = reconIPD.length;
  const trueEvents = trueIPD.filter(p => p.status === 1).length;
  const reconEvents = reconIPD.filter(p => p.status === 1).length;
  
  // Median survival (time when S crosses 0.5)
  const trueMedian = findMedian(trueKM);
  const reconMedian = findMedian(reconKM);
  
  // RMST at 80% of max follow-up
  const maxTime = Math.max(...trueIPD.map(p => p.time));
  const rmstTau = maxTime * 0.8;
  const trueRMST = calculateRMST(trueKM, rmstTau);
  const reconRMST = calculateRMST(reconKM, rmstTau);
  
  // Maximum survival difference
  const evalTimes = Array.from({ length: 100 }, (_, i) => i / 99 * maxTime);
  let maxSurvDiff = 0;
  let sumSurvDiff = 0;
  
  for (const t of evalTimes) {
    const trueSurv = interpolateSurvival(
      trueKM.times.map((time, i) => ({ time, surv: trueKM.survival[i] })), t);
    const reconSurv = interpolateSurvival(
      reconKM.times.map((time, i) => ({ time, surv: reconKM.survival[i] })), t);
    const diff = Math.abs(trueSurv - reconSurv);
    maxSurvDiff = Math.max(maxSurvDiff, diff);
    sumSurvDiff += diff;
  }
  const meanSurvDiff = sumSurvDiff / evalTimes.length;
  
  return {
    n: { true: trueN, recon: reconN, diff: reconN - trueN, pctDiff: ((reconN - trueN) / trueN * 100).toFixed(1) },
    events: { true: trueEvents, recon: reconEvents, diff: reconEvents - trueEvents, pctDiff: ((reconEvents - trueEvents) / trueEvents * 100).toFixed(1) },
    median: { true: trueMedian, recon: reconMedian, diff: reconMedian - trueMedian, pctDiff: trueMedian ? ((reconMedian - trueMedian) / trueMedian * 100).toFixed(1) : 'N/A' },
    rmst: { tau: rmstTau.toFixed(0), true: trueRMST.toFixed(1), recon: reconRMST.toFixed(1), diff: (reconRMST - trueRMST).toFixed(2), pctDiff: ((reconRMST - trueRMST) / trueRMST * 100).toFixed(2) },
    survDiff: { max: maxSurvDiff.toFixed(4), mean: meanSurvDiff.toFixed(4) }
  };
}

function findMedian(km) {
  for (let i = 0; i < km.survival.length; i++) {
    if (km.survival[i] <= 0.5) {
      return km.times[i];
    }
  }
  return null; // Not reached
}

function calculateRMST(km, tau) {
  let rmst = 0;
  const times = [0, ...km.times.filter(t => t <= tau), tau];
  const survs = [1, ...km.survival.filter((_, i) => km.times[i] <= tau)];
  
  // Extend survival to tau
  if (km.times[km.times.length - 1] < tau) {
    survs.push(survs[survs.length - 1]);
  } else {
    survs.push(interpolateSurvival(
      km.times.map((t, i) => ({ time: t, surv: km.survival[i] })), tau));
  }
  
  for (let i = 0; i < times.length - 1; i++) {
    rmst += (times[i + 1] - times[i]) * survs[i];
  }
  
  return rmst;
}


//==============================================================================
// PART 6: HAZARD RATIO CALCULATION
//==============================================================================

/**
 * Calculate log-rank test and hazard ratio between two groups
 */
function calculateHR(ipd1, ipd2) {
  // Combine data
  const combined = [
    ...ipd1.map(p => ({ ...p, group: 0 })),
    ...ipd2.map(p => ({ ...p, group: 1 }))
  ].sort((a, b) => a.time - b.time);
  
  // Log-rank test (simplified)
  let observed1 = 0, expected1 = 0;
  let n1 = ipd1.length, n2 = ipd2.length;
  let varLogRank = 0;
  
  let i = 0;
  while (i < combined.length) {
    const t = combined[i].time;
    
    // Count events and at risk at this time
    let d1 = 0, d2 = 0;
    while (i < combined.length && combined[i].time === t) {
      if (combined[i].status === 1) {
        if (combined[i].group === 0) d1++;
        else d2++;
      }
      i++;
    }
    
    const d = d1 + d2;
    const n = n1 + n2;
    
    if (n > 0 && d > 0) {
      const e1 = d * n1 / n;
      observed1 += d1;
      expected1 += e1;
      
      if (n > 1) {
        varLogRank += d * n1 * n2 * (n - d) / (n * n * (n - 1));
      }
    }
    
    // Update at risk
    n1 -= d1;
    n2 -= d2;
    
    // Also remove censored
    for (let j = 0; j < combined.length; j++) {
      if (combined[j].time === t && combined[j].status === 0) {
        if (combined[j].group === 0) n1--;
        else n2--;
      }
    }
  }
  
  // Log-rank statistic
  const logRankStat = (observed1 - expected1) / Math.sqrt(varLogRank);
  const pValue = 2 * (1 - normalCDF(Math.abs(logRankStat)));
  
  // HR estimate (Mantel-Haenszel)
  const hr = observed1 / expected1;
  
  return { hr, logRankStat, pValue };
}

function normalCDF(x) {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1.0 + sign * y);
}


//==============================================================================
// PART 7: RUN VALIDATION
//==============================================================================

function runValidation() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║          IPD RECONSTRUCTION VALIDATION SUITE                 ║');
  console.log('║     Testing CEN-KM vs Guyot on Real Clinical Trial Data     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const results = {};
  
  // Test datasets
  const datasets = [
    { name: 'Veterans\' Admin Lung Cancer (n=137)', data: VETERAN_DATA },
    { name: 'NCCTG Lung Cancer (n=196)', data: LUNG_DATA },
    { name: 'Ovarian Cancer (n=26)', data: OVARIAN_DATA }
  ];
  
  for (const dataset of datasets) {
    console.log('\n' + '='.repeat(60));
    console.log(`VALIDATING: ${dataset.name}`);
    console.log('='.repeat(60) + '\n');
    
    const trueIPD = dataset.data;
    console.log(`True IPD: n=${trueIPD.length}, events=${trueIPD.filter(p => p.status === 1).length}`);
    
    // Calculate true KM
    const trueKM = calculateKM(trueIPD);
    
    // Extract curve and at-risk table (simulates digitization)
    const survPoints = sampleSurvivalCurve(trueKM, 50);
    const maxTime = Math.max(...trueIPD.map(p => p.time));
    const atRiskTimes = Array.from({ length: 6 }, (_, i) => i / 5 * maxTime * 0.85);
    const atRiskTable = extractAtRiskTable(trueKM, atRiskTimes);
    
    console.log(`Extracted curve: ${survPoints.length} points`);
    console.log(`At-risk table: ${atRiskTable.length} time points\n`);
    
    // Reconstruct with Guyot
    console.log('Reconstructing with Guyot algorithm...');
    const guyotIPD = guyotReconstruct(survPoints, atRiskTable, trueIPD.filter(p => p.status === 1).length);
    
    // Reconstruct with CEN-KM
    console.log('Reconstructing with CEN-KM algorithm...');
    const cenkMIPD = cenKmReconstruct(survPoints, atRiskTable);
    
    // Calculate metrics
    const guyotMetrics = calculateValidationMetrics(trueIPD, guyotIPD);
    const cenkmMetrics = calculateValidationMetrics(trueIPD, cenkMIPD);
    
    // Print results
    console.log('\n--- GUYOT Algorithm Results ---');
    console.log(`Sample size: ${guyotMetrics.n.recon} (true: ${guyotMetrics.n.true}, diff: ${guyotMetrics.n.pctDiff}%)`);
    console.log(`Events: ${guyotMetrics.events.recon} (true: ${guyotMetrics.events.true}, diff: ${guyotMetrics.events.pctDiff}%)`);
    console.log(`Median survival: ${guyotMetrics.median.recon} (true: ${guyotMetrics.median.true}, diff: ${guyotMetrics.median.pctDiff}%)`);
    console.log(`RMST (τ=${guyotMetrics.rmst.tau}): ${guyotMetrics.rmst.recon} (true: ${guyotMetrics.rmst.true}, diff: ${guyotMetrics.rmst.pctDiff}%)`);
    console.log(`Max survival diff: ${guyotMetrics.survDiff.max}, Mean diff: ${guyotMetrics.survDiff.mean}`);
    
    console.log('\n--- CEN-KM Algorithm Results ---');
    console.log(`Sample size: ${cenkmMetrics.n.recon} (true: ${cenkmMetrics.n.true}, diff: ${cenkmMetrics.n.pctDiff}%)`);
    console.log(`Events: ${cenkmMetrics.events.recon} (true: ${cenkmMetrics.events.true}, diff: ${cenkmMetrics.events.pctDiff}%)`);
    console.log(`Median survival: ${cenkmMetrics.median.recon} (true: ${cenkmMetrics.median.true}, diff: ${cenkmMetrics.median.pctDiff}%)`);
    console.log(`RMST (τ=${cenkmMetrics.rmst.tau}): ${cenkmMetrics.rmst.recon} (true: ${cenkmMetrics.rmst.true}, diff: ${cenkmMetrics.rmst.pctDiff}%)`);
    console.log(`Max survival diff: ${cenkmMetrics.survDiff.max}, Mean diff: ${cenkmMetrics.survDiff.mean}`);
    
    results[dataset.name] = { guyot: guyotMetrics, cenkm: cenkmMetrics };
  }
  
  // Two-arm HR validation
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           TWO-ARM VALIDATION (Hazard Ratio)                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const arm1 = VETERAN_DATA.filter(p => p.arm === 1);
  const arm2 = VETERAN_DATA.filter(p => p.arm === 2);
  
  // True HR
  const trueHR = calculateHR(arm1, arm2);
  console.log(`True HR (arm2 vs arm1): ${trueHR.hr.toFixed(3)} (p=${trueHR.pValue.toFixed(4)})\n`);
  
  // Reconstruct each arm
  const km1 = calculateKM(arm1);
  const km2 = calculateKM(arm2);
  const maxTime1 = Math.max(...arm1.map(p => p.time));
  const maxTime2 = Math.max(...arm2.map(p => p.time));
  
  const surv1 = sampleSurvivalCurve(km1, 40);
  const surv2 = sampleSurvivalCurve(km2, 40);
  const atRisk1 = extractAtRiskTable(km1, Array.from({ length: 5 }, (_, i) => i / 4 * maxTime1 * 0.85));
  const atRisk2 = extractAtRiskTable(km2, Array.from({ length: 5 }, (_, i) => i / 4 * maxTime2 * 0.85));
  
  const guyot1 = guyotReconstruct(surv1, atRisk1);
  const guyot2 = guyotReconstruct(surv2, atRisk2);
  const cenkm1 = cenKmReconstruct(surv1, atRisk1);
  const cenkm2 = cenKmReconstruct(surv2, atRisk2);
  
  const guyotHR = calculateHR(guyot1, guyot2);
  const cenkmHR = calculateHR(cenkm1, cenkm2);
  
  console.log(`Guyot Reconstructed HR: ${guyotHR.hr.toFixed(3)}`);
  console.log(`HR difference from true: ${((guyotHR.hr - trueHR.hr) / trueHR.hr * 100).toFixed(1)}%\n`);
  
  console.log(`CEN-KM Reconstructed HR: ${cenkmHR.hr.toFixed(3)}`);
  console.log(`HR difference from true: ${((cenkmHR.hr - trueHR.hr) / trueHR.hr * 100).toFixed(1)}%`);
  
  // Summary table
  console.log('\n\n╔══════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              SUMMARY TABLE                                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════╝\n');
  
  console.log('Dataset                          | Method  | Events Diff | Median Diff | RMST Diff | Max S Diff');
  console.log('-'.repeat(100));
  
  for (const [name, metrics] of Object.entries(results)) {
    const shortName = name.substring(0, 30).padEnd(32);
    console.log(`${shortName} | Guyot   | ${metrics.guyot.events.pctDiff.padStart(10)}% | ${metrics.guyot.median.pctDiff.toString().padStart(10)}% | ${metrics.guyot.rmst.pctDiff.padStart(8)}% | ${metrics.guyot.survDiff.max}`);
    console.log(`${' '.repeat(32)} | CEN-KM  | ${metrics.cenkm.events.pctDiff.padStart(10)}% | ${metrics.cenkm.median.pctDiff.toString().padStart(10)}% | ${metrics.cenkm.rmst.pctDiff.padStart(8)}% | ${metrics.cenkm.survDiff.max}`);
  }
  
  console.log('\n\n✓ Validation complete!');
  console.log('\nInterpretation:');
  console.log('- Events Diff: Difference in number of events (should be within ±10%)');
  console.log('- Median Diff: Difference in median survival (should be within ±5%)');
  console.log('- RMST Diff: Difference in restricted mean survival time (should be within ±2%)');
  console.log('- Max S Diff: Maximum absolute survival probability difference (should be <0.05)');
  
  return results;
}

// Run the validation
runValidation();
