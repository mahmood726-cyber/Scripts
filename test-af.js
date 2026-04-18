/**
 * RCT Extractor v3.1 - AF Trial Test Suite
 * Tests enhanced AF module with RE-LY trial
 */

const fs = require('fs');
const { RCTExtractor, DomainDetector } = require('./RCTExtractor_v3_1.js');

// Test RE-LY trial (first 680 lines only - before ENGAGE-AF begins)
function testRELY() {
    const fullText = fs.readFileSync('/mnt/user-data/uploads/Dabigatran_versus_Warfarin_in_Patie.txt', 'utf8');
    const lines = fullText.split('\n');
    const text = lines.slice(0, 680).join('\n');
    
    console.log('='.repeat(70));
    console.log('RCT EXTRACTOR v3.1 - AF MODULE TEST');
    console.log('='.repeat(70));
    console.log('\nTrial: RE-LY (Dabigatran vs Warfarin in AF)');
    console.log('Source: NEJM 2009');
    
    // Domain detection
    const domain = DomainDetector.detect(text);
    console.log(`\nDomain: ${domain.primary} (${domain.confidence})`);
    
    // Extract
    const result = RCTExtractor.extract(text);
    const flat = RCTExtractor.flatten(result);
    const summary = RCTExtractor.getSummary(result);
    
    console.log(`\n${'─'.repeat(70)}`);
    console.log('EXTRACTION SUMMARY');
    console.log('─'.repeat(70));
    console.log(`Acronym:         ${summary.acronym}`);
    console.log(`Field Count:     ${summary.fieldCount}`);
    console.log(`Treatment N:     ${summary.treatmentN}`);
    console.log(`Control N:       ${summary.controlN}`);
    console.log(`Primary Effect:  RR ${summary.primaryHR} (95% CI ${flat['contrast.ciLo']}-${flat['contrast.ciHi']})`);
    
    // Ground truth validation
    const groundTruth = {
        'study.acronym': 'RE-LY',
        'contrast.effect': 0.66,
        'contrast.ciLo': 0.53,
        'contrast.ciHi': 0.82,
        'arm.treatment.n': 6076,
        'arm.control.n': 6022,
        'baseline.age.mean': 71.5,
        'baseline.sex.female_pct': 36.8,
        'baseline.diabetes_pct': 23.1,
        'baseline.hypertension_pct': 78.9,
        'baseline.prior_mi_pct': 16.9,
        'baseline.chads2_score.mean': 2.1,
        'baseline.af_type.paroxysmal_pct': 32.6,
        'baseline.af_type.persistent_pct': 31.4,
        'baseline.af_type.permanent_pct': 36.0,
        'baseline.prior_stroke_tia_pct': 20.3,
        'baseline.heart_failure_pct': 31.8,
        'baseline.meds.bb_pct': 63.7,
        'baseline.meds.aspirin_pct': 38.7,
        'baseline.meds.statin_pct': 43.9,
        'baseline.meds.arb_pct': 66.7,
        'study.sites': 951,
        'study.countries': 44,
        'study.followUp': 2.0
    };
    
    console.log(`\n${'─'.repeat(70)}`);
    console.log('ACCURACY VALIDATION vs Ground Truth');
    console.log('─'.repeat(70));
    
    let matched = 0, missing = 0, wrong = 0;
    
    Object.entries(groundTruth).forEach(([key, expected]) => {
        const extracted = flat[key];
        if (extracted === undefined || extracted === null) {
            missing++;
            console.log(`❌ MISSING: ${key} (expected: ${expected})`);
        } else if (typeof expected === 'number') {
            const diff = Math.abs(extracted - expected);
            const threshold = expected < 2 ? 0.1 : expected < 100 ? 2 : expected * 0.1;
            if (diff <= threshold) {
                matched++;
                console.log(`✓  ${key.padEnd(35)} ${String(extracted).padStart(8)} (expected: ${expected})`);
            } else {
                wrong++;
                console.log(`✗  ${key.padEnd(35)} ${String(extracted).padStart(8)} (expected: ${expected}) ⚠️`);
            }
        } else if (typeof expected === 'string') {
            if (String(extracted).toUpperCase().includes(expected.toUpperCase())) {
                matched++;
                console.log(`✓  ${key.padEnd(35)} ${extracted}`);
            } else {
                wrong++;
                console.log(`✗  ${key.padEnd(35)} ${extracted} (expected: ${expected}) ⚠️`);
            }
        }
    });
    
    console.log(`\n${'─'.repeat(70)}`);
    console.log('AF-SPECIFIC FIELDS EXTRACTED');
    console.log('─'.repeat(70));
    
    const afFields = [
        ['baseline.chads2_score.mean', 'CHADS₂ Score'],
        ['baseline.af_type.paroxysmal_pct', 'AF Type: Paroxysmal'],
        ['baseline.af_type.persistent_pct', 'AF Type: Persistent'],
        ['baseline.af_type.permanent_pct', 'AF Type: Permanent'],
        ['baseline.prior_stroke_tia_pct', 'Prior Stroke/TIA'],
        ['baseline.prior_warfarin_pct', 'Prior VKA Therapy'],
        ['baseline.ttr_pct.mean', 'TTR (warfarin group)'],
        ['baseline.heart_failure_pct', 'Heart Failure']
    ];
    
    afFields.forEach(([key, label]) => {
        const val = flat[key];
        console.log(`  ${label.padEnd(25)} ${val !== undefined ? val + '%' : 'Not found'}`);
    });
    
    console.log(`\n${'='.repeat(70)}`);
    console.log('RESULTS');
    console.log('='.repeat(70));
    console.log(`Matched:  ${matched}/${Object.keys(groundTruth).length} (${(100*matched/Object.keys(groundTruth).length).toFixed(0)}%)`);
    console.log(`Missing:  ${missing}`);
    console.log(`Wrong:    ${wrong}`);
    console.log('='.repeat(70));
    
    return { matched, missing, wrong, total: Object.keys(groundTruth).length };
}

// Run test
const results = testRELY();

console.log('\n\nv3.1 AF Module Enhancements:');
console.log('─'.repeat(40));
console.log('• Relative risk (RR) pattern extraction');
console.log('• Multi-arm trial superiority prioritization');
console.log('• n/total (pct) value format support');
console.log('• Multi-line label handling');
console.log('• AF type extraction without prefix');
console.log('• Prior VKA/warfarin experience');
console.log('• TTR extraction from prose');
console.log('• Female % calculation from male %');
