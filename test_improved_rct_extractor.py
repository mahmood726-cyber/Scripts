"""Minimal regression tests for improved_rct_extractor.

Locks in the HR/CI extraction fix: the original HR_CI_RE matched zero
hazard ratios because it required two closing brackets and used a literal
``{NUM}`` token (not the NUM pattern) for the p-value group.
"""

from improved_rct_extractor import ImprovedRCTExtractor


def test_import_and_extract_runs():
    e = ImprovedRCTExtractor()
    res = e.extract("A trial of nothing in particular.")
    assert isinstance(res, dict)
    assert "secondary" in res


def test_hazard_ratio_with_pvalue_inside_parens():
    """HR 0.89 (95% CI 0.81-0.99; P=0.03) must extract effect, CI and p."""
    e = ImprovedRCTExtractor()
    txt = (
        "The unadjusted hazard ratio was 0.93 (95% CI 0.84-1.02; P=0.13); "
        "after adjustment the hazard ratio was 0.89 (95% CI 0.81-0.99; P=0.03)."
    )
    res = e.extract(txt)
    effects = res["secondary"].get("effect_measures", [])
    assert len(effects) == 2, f"expected 2 effect measures, got {len(effects)}"

    e0 = effects[0]
    assert e0["effect"] == 0.93
    assert e0["ci95"] == [0.84, 1.02]
    assert e0["p_value"] == 0.13
    assert e0["label"] == "unadjusted"

    e1 = effects[1]
    assert e1["effect"] == 0.89
    assert e1["ci95"] == [0.81, 0.99]
    assert e1["p_value"] == 0.03


def test_hazard_ratio_with_to_separator():
    e = ImprovedRCTExtractor()
    res = e.extract("Dabigatran reduced stroke; hazard ratio 0.66 (95% CI 0.53 to 0.82).")
    effects = res["secondary"].get("effect_measures", [])
    assert len(effects) == 1
    assert effects[0]["effect"] == 0.66
    assert effects[0]["ci95"] == [0.53, 0.82]
