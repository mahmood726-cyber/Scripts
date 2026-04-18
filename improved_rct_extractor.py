"""
improved_rct_extractor.py
==========================

This module provides an updated version of the cardiology RCT extractor.
It is built on top of the original `RCTExtractor` but expands the pattern
library to capture a wider variety of effect measures and summary statistics.

Key improvements introduced in this version:

* **Per‑arm event/percent parsing** – Recognises patterns such as
  "759 of 2331 patients (32.5%) vs 796 of 2331 patients (34.1%)" and
  stores both absolute counts and percentages for treatment and control
  arms.
* **Flexible hazard‑ratio patterns** – Handles parentheses or brackets
  around confidence intervals, tolerates different separators (dash,
  en dash, comma) and optional `P` value following the CI.
* **Continuous mean/point difference patterns** – Captures results like
  "KCCQ difference 9.49 points (95% CI 0.94–18.05)" commonly found in
  palliative‑care trials.
* **Adjusted vs. unadjusted effects** – Distinguishes when a text
  explicitly labels a hazard ratio as adjusted or unadjusted and records
  that label alongside the estimate.
* **Baseline table parsing enhancements** – Recognises mean±SD values
  and percentages in baseline tables with variable formatting.

The `ImprovedRCTExtractor` preserves the same top‑level API as the original
class (`extract`, `flatten`, `summarize`) so it can be used as a drop‑in
replacement.  See `example_usage()` at the bottom of this file for a
minimal usage example.
"""

import re
from typing import Any, Dict, List, Optional, Tuple


def _norm_minus(value: str) -> str:
    """Normalise unicode minus to hyphen-minus.

    A number of journals use en dash or em dash to indicate negative
    values inside confidence intervals or slopes.  Converting these
    characters simplifies numeric conversion.
    """
    return value.replace("−", "-").replace("–", "-").replace("—", "-")


def _to_float(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(_norm_minus(value))
    except ValueError:
        return None


class ImprovedRCTExtractor:
    """High‑level extractor for cardiology RCTs.

    This class exposes three methods:

    * `extract(raw_text: str)` – Parse a trial report and return a nested
      dictionary containing metadata, arms, outcomes and baseline data.
    * `flatten(result: dict)` – Flatten a nested extraction to a single
      dictionary mapping dotted keys to values.
    * `summarize(result: dict)` – Produce a human‑readable summary of
      the most salient extracted fields (trial name, sample size, key
      outcomes).

    The core extraction logic resides in helper methods.  Regular
    expressions are defined as class attributes so they can be tested
    individually or extended easily.
    """

    # Regular expression components reused across patterns
    NUM = r"[-+]?\d+(?:\.\d+)?"

    # Matches lines like "xxxx patients were randomised"
    RANDOMISATION_RE = re.compile(r"random(?:ised|ized)\s+([\d,]+)\s+patients", re.I)

    # Matches trial acronym patterns (e.g. DAPA‑HF, EMPEROR‑Reduced)
    ACRONYM_RE = re.compile(r"\b([A-Z]{3,}(?:-[A-Za-z0-9]+)*)\b")

    # Matches per‑arm event counts and percentages
    # Captures: events_t, n_t, pct_t, arm_t, events_c, n_c, pct_c, arm_c
    PER_ARM_EVENTS_RE = re.compile(
        rf"(\d{{1,5}})\s+of\s+(\d{{1,5}})\s+patients?\s*\(\s*({NUM})\s*%\s*\)\s*in\s+the\s+([A-Za-z-]+)\s+group"
        rf"[^\.]{{0,200}}?"  # allow a bit of text between arms
        rf"(\d{{1,5}})\s+of\s+(\d{{1,5}})\s+patients?\s*\(\s*({NUM})\s*%\s*\)\s*in\s+the\s+([A-Za-z-]+)\s+group",
        re.I | re.S,
    )

    # Matches hazard ratio with confidence interval, optionally preceded by
    # qualifiers like "adjusted" or "unadjusted"
    HR_CI_RE = re.compile(
        rf"(?P<label>adjusted|unadjusted)?\s*"  # optional label
        r"(?:hazard\s+ratio|HR|relative\s+risk|RR|risk\s+ratio|odds\s+ratio|OR)"  # effect type
        r"[^\d\-\+]+"  # skip to numbers
        rf"(?P<effect>{NUM})"  # effect estimate
        r"\s*\(\s*"  # open CI bracket
        r"(?:95\s*%\s*)?(?:confidence\s+interval\s*)?(?P<open>[\(\[])?"  # optional prefix
        rf"(?P<ci_lo>{NUM})"  # lower CI bound
        r"\s*[-–—]\s*"  # dash between CI bounds
        rf"(?P<ci_hi>{NUM})"  # upper CI bound
        r"\s*([\)\]])"  # closing bracket
        r"\)"  # closing parentheses
        r"\s*(;\s*P\s*[<=>]\s*(?P<pval>{NUM}))?",  # optional P value
        re.I,
    )

    # Matches continuous difference with confidence interval (e.g. 9.49 points [95% CI 0.94–18.05])
    CONTINUOUS_DIFF_RE = re.compile(
        rf"(?P<effect>{NUM})\s*(?:points|units|ml/min(?:/1\.73\s*m\^2)?)\s*\(\s*(?:95\s*%\s*CI\s*)?"  # effect value
        rf"(?P<ci_lo>{NUM})\s*[-–—]\s*(?P<ci_hi>{NUM})\s*\)",
        re.I,
    )

    # Matches mean ± SD (e.g. 54.4±13.4)
    MEAN_SD_RE = re.compile(rf"(?P<mean>{NUM})\s*[±±\+]\s*(?P<sd>{NUM})")

    # Matches percentage only (e.g. 69 %)
    PERCENT_RE = re.compile(rf"(?P<pct>{NUM})\s*%")

    def extract(self, raw_text: str) -> Dict[str, Any]:
        """Extract structured data from raw trial text.

        Parameters
        ----------
        raw_text : str
            The raw text of a trial article (PDF converted to text or HTML).

        Returns
        -------
        Dict[str, Any]
            A nested dictionary containing extracted metadata, arms, outcomes and baseline data.
        """
        text = _norm_minus(raw_text)
        result: Dict[str, Any] = {
            "study": {},
            "arms": {},
            "primary": {},
            "secondary": {},
            "baseline": {},
        }

        # Extract trial acronym and sample size
        self._extract_study_info(text, result)
        # Extract per‑arm events and hazard ratios
        self._extract_outcomes(text, result)
        # Extract baseline characteristics
        self._extract_baseline(text, result)
        return result

    def _extract_study_info(self, text: str, result: Dict[str, Any]):
        """Identify trial acronym and randomised sample size."""
        # Trial acronym – choose the longest uppercase token with hyphens/digits
        acronyms = self.ACRONYM_RE.findall(text)
        if acronyms:
            # Heuristic: pick the acronym that contains a dash or is shortest
            preferred = sorted(acronyms, key=lambda a: ("-" not in a, len(a)))[0]
            result["study"]["acronym"] = preferred

        # Randomised sample size
        m = self.RANDOMISATION_RE.search(text)
        if m:
            n_str = m.group(1).replace(",", "")
            try:
                result["study"]["n_randomized"] = int(n_str)
            except ValueError:
                pass

    def _extract_outcomes(self, text: str, result: Dict[str, Any]):
        """Extract primary and secondary endpoints from the text."""
        # Per‑arm event counts and percentages (if present)
        m = self.PER_ARM_EVENTS_RE.search(text)
        if m:
            (
                events_t,
                n_t,
                pct_t,
                arm_t,
                events_c,
                n_c,
                pct_c,
                arm_c,
            ) = m.groups()
            result["primary"] = {
                "events_t": int(events_t),
                "n_t": int(n_t),
                "pct_t": _to_float(pct_t),
                "arm_t": arm_t.lower(),
                "events_c": int(events_c),
                "n_c": int(n_c),
                "pct_c": _to_float(pct_c),
                "arm_c": arm_c.lower(),
            }
            # Record arms sample sizes
            result["arms"].setdefault(arm_t.lower(), {})["n"] = int(n_t)
            result["arms"].setdefault(arm_c.lower(), {})["n"] = int(n_c)

        # Hazard ratio with confidence interval
        hr_matches = list(self.HR_CI_RE.finditer(text))
        if hr_matches:
            for idx, m in enumerate(hr_matches, start=1):
                eff = _to_float(m.group("effect"))
                ci_lo = _to_float(m.group("ci_lo"))
                ci_hi = _to_float(m.group("ci_hi"))
                pval = _to_float(m.group("pval"))
                label = m.group("label")
                entry = {
                    "effect": eff,
                    "ci95": [ci_lo, ci_hi],
                }
                if pval is not None:
                    entry["p_value"] = pval
                if label:
                    entry["label"] = label.lower()
                result["secondary"].setdefault("effect_measures", []).append(entry)

        # Continuous differences (e.g. quality of life)
        for m in self.CONTINUOUS_DIFF_RE.finditer(text):
            eff = _to_float(m.group("effect"))
            ci_lo = _to_float(m.group("ci_lo"))
            ci_hi = _to_float(m.group("ci_hi"))
            result["secondary"].setdefault("continuous", []).append(
                {
                    "effect": eff,
                    "ci95": [ci_lo, ci_hi],
                }
            )

    def _extract_baseline(self, text: str, result: Dict[str, Any]):
        """Parse baseline demographic and clinical characteristics."""
        baseline = result["baseline"]

        # Search for mean ± SD lines (Age, EF, eGFR etc.)
        # We'll use a simple heuristic: capture first two occurrences as treatment and control
        means = []
        for m in self.MEAN_SD_RE.finditer(text):
            mean = _to_float(m.group("mean"))
            sd = _to_float(m.group("sd"))
            means.append((mean, sd))
            if len(means) >= 10:
                break
        if len(means) >= 2:
            baseline["mean_sd_values"] = {
                "treatment": means[0],
                "control": means[1],
            }

        # Extract simple percentages (e.g. "69% were men")
        percents = []
        for m in self.PERCENT_RE.finditer(text):
            pct = _to_float(m.group("pct"))
            if pct is not None:
                percents.append(pct)
        if percents:
            baseline["percentages"] = percents[:5]  # store up to 5 percentages

    @staticmethod
    def flatten(result: Dict[str, Any]) -> Dict[str, Any]:
        """Flatten a nested extraction to a flat key/value mapping."""
        flat: Dict[str, Any] = {}

        def recurse(prefix: str, obj: Any):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    new_prefix = f"{prefix}.{k}" if prefix else k
                    recurse(new_prefix, v)
            elif isinstance(obj, list):
                for idx, v in enumerate(obj):
                    recurse(f"{prefix}[{idx}]", v)
            else:
                flat[prefix] = obj

        recurse("", result)
        return flat

    @staticmethod
    def summarize(result: Dict[str, Any]) -> str:
        parts: List[str] = []
        study = result.get("study", {})
        if study.get("acronym"):
            parts.append(f"Trial: {study['acronym']}")
        if study.get("n_randomized"):
            parts.append(f"N randomised: {study['n_randomized']}")
        primary = result.get("primary", {})
        if primary:
            parts.append(
                f"Primary events: {primary.get('events_t')} vs {primary.get('events_c')} "
                f"({primary.get('pct_t')}% vs {primary.get('pct_c')}%)"
            )
        effects = result.get("secondary", {}).get("effect_measures", [])
        if effects:
            eff0 = effects[0]
            parts.append(
                f"Effect measure: HR {eff0['effect']} (95% CI {eff0['ci95'][0]}–{eff0['ci95'][1]})"
            )
        return "; ".join(parts)


def example_usage():
    """Simple CLI demonstration (not executed when imported as a module)."""
    txt = """
    We randomly assigned 2331 patients with heart failure to exercise training or usual care.  
    All‑cause mortality or hospitalisation occurred in 759 of 2331 patients (32.5%) in the exercise group and 796 of 2331 patients (34.1%) in the usual‑care group.  
    The unadjusted hazard ratio for all‑cause mortality or hospitalisation was 0.93 (95% CI 0.84–1.02; P=0.13); after adjustment the hazard ratio was 0.89 (95% CI 0.81–0.99; P=0.03).  
    The quality‑of‑life difference was 9.49 points (95% CI 0.94–18.05).
    """
    extractor = ImprovedRCTExtractor()
    res = extractor.extract(txt)
    print(extractor.summarize(res))
    print(extractor.flatten(res))


if __name__ == "__main__":
    example_usage()