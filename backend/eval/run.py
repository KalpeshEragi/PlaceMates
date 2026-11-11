"""Run the benchmark. Resumable: every step's output is saved, so a rerun skips finished work and continues
where a free daily quota stopped it.

Usage (from backend/):
    python -m eval.run                       # the 5-pair pilot
    python -m eval.run --plan "Kalpesh Eragi=6" "Riya Sharma=4"
    python -m eval.run --report-only
Outputs in backend/eval/out/ (git-ignored: it contains real profiles): report.md, claims.csv, one folder per pair.
"""

import argparse
import csv
import json
import logging
import statistics
from pathlib import Path

from app.db import SessionLocal
from eval import pairs as pairs_mod
from eval import scoring, systems
from eval.models import GEN_CHAIN, JUDGE_CHAIN, QuotaExhausted, exhausted, first_available

OUT = Path(__file__).parent / "out"
PILOT = {"Kalpesh Eragi": 3, "Riya Sharma": 2}
log = logging.getLogger("eval")


def _step(folder: Path, name: str, fn):
    """Run fn once; reuse its saved output on later runs."""
    path = folder / f"{name}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    log.info("%s: %s", folder.name, name)
    value = fn()
    path.write_text(json.dumps(value, indent=1, ensure_ascii=False, default=str), encoding="utf-8")
    return value


GEN_FILES = ("placemates", "baseline", "code_check", "coverage")
JUDGE_FILES = ("audit_placemates", "audit_baseline", "judge")


def _saved_model(folder: Path, name: str, key: str = "model") -> str | None:
    path = folder / f"{name}.json"
    return json.loads(path.read_text(encoding="utf-8")).get(key) if path.exists() else None


def _clear(folder: Path, names: tuple[str, ...]) -> None:
    for n in names:
        (folder / f"{n}.json").unlink(missing_ok=True)


def run_pair(pair: dict) -> None:
    """Both systems on one model, both resumes judged by one judge. If a daily quota runs out mid-pair,
    that half of the pair is thrown away and redone on the next model in the chain."""
    folder = OUT / pair["id"]
    folder.mkdir(parents=True, exist_ok=True)
    _step(folder, "pair", lambda: {k: pair[k] for k in ("id", "student", "job", "resume_text")})

    while True:  # generation
        model = _saved_model(folder, "placemates")
        if model is None or (model in exhausted and not (folder / "baseline.json").exists()):
            _clear(folder, GEN_FILES + JUDGE_FILES)
            model = first_available(GEN_CHAIN)
            if model is None:
                raise QuotaExhausted("all generation models", "every model's daily quota is used up")
        try:
            pm = _step(folder, "placemates", lambda: systems.placemates(pair, model))
            base = _step(folder, "baseline", lambda: systems.baseline(pair, model))
            break
        except QuotaExhausted as err:
            log.warning("%s: %s ran out; redoing this pair on the next model", pair["id"], err.model)
            _clear(folder, GEN_FILES + JUDGE_FILES)

    _step(folder, "code_check", lambda: {"placemates": scoring.code_check(pair, pm["text"]),
                                         "baseline": scoring.code_check(pair, base["text"])})
    _step(folder, "coverage", lambda: {"placemates": scoring.coverage(pm["brief"], pm["text"]),
                                       "baseline": scoring.coverage(pm["brief"], base["text"])})

    while True:  # judging
        judge = _saved_model(folder, "audit_placemates", "judge") or first_available(JUDGE_CHAIN)
        if judge is None:
            raise QuotaExhausted("all judge models", "every judge's daily quota is used up")
        try:
            _step(folder, "audit_placemates", lambda: scoring.audit(pair["resume_text"], pm["text"], judge))
            _step(folder, "audit_baseline", lambda: scoring.audit(pair["resume_text"], base["text"], judge))
            _step(folder, "judge", lambda: scoring.blind_compare(pair, base["text"], pm["text"], judge))
            return
        except QuotaExhausted as err:
            log.warning("%s: judge %s ran out; re-judging this pair on the next judge", pair["id"], err.model)
            _clear(folder, JUDGE_FILES)


def report() -> str:
    done = [p for p in sorted(OUT.iterdir()) if p.is_dir() and (p / "judge.json").exists()]
    if not done:
        return "No finished pairs yet."
    load = lambda p, n: json.loads((p / f"{n}.json").read_text(encoding="utf-8"))  # noqa: E731
    rows, claim_rows, judges, gens = {"placemates": [], "baseline": []}, [], set(), {}
    prefs = {"placemates": 0, "baseline": 0, "tie": 0}
    for p in done:
        cov, code, jd = load(p, "coverage"), load(p, "code_check"), load(p, "judge")
        gen = load(p, "placemates").get("model", "?")
        gens[gen] = gens.get(gen, 0) + 1
        prefs[jd["preferred"]] += 1
        judges.add(jd.get("judge", "?"))
        for system in ("placemates", "baseline"):
            a = load(p, f"audit_{system}")
            judges.add(a.get("judge", "?"))
            rows[system].append({"total": a["total"], "bad": a["bad"], "counts": a["counts"],
                                 "code": len(code[system]), "coverage": cov[system]["share"],
                                 "scores": jd[system]})
            claim_rows += [{"pair": p.name, "system": system, **c, "your_label": ""} for c in a["claims"]]

    def summary(system: str) -> dict:
        r = rows[system]
        total, bad = sum(x["total"] for x in r), sum(x["bad"] for x in r)
        crit = {k: round(statistics.mean(x["scores"][k] for x in r), 1) for k in r[0]["scores"]}
        return {"claims": total, "bad": bad, "bad_per_100": round(100 * bad / total, 1) if total else 0,
                "resumes_with_bad": sum(x["bad"] > 0 for x in r), "code_flags": sum(x["code"] for x in r),
                "coverage": round(100 * statistics.mean(x["coverage"] for x in r)), "rubric": crit,
                "rubric_avg": round(statistics.mean(crit.values()), 1)}

    pm, base = summary("placemates"), summary("baseline")
    n = len(done)
    with open(OUT / "claims.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["pair", "system", "claim", "kind", "label", "evidence", "your_label"])
        w.writeheader()
        w.writerows(claim_rows)
    reduction = (round(100 * (1 - pm["bad_per_100"] / base["bad_per_100"])) if base["bad_per_100"] else None)
    lines = [
        f"# PlaceMates benchmark: {n} resume-job pairs",
        "",
        "In every pair, the generic prompt and the PlaceMates pipeline ran on the same model. Pairs per model: "
        + ", ".join(f"`{m}` {c}" for m, c in gens.items()) + f". Judge(s): {', '.join(sorted(judges))}.",
        "Baseline = a typical 'here is my resume and a job description, tailor it' prompt on the same model.",
        "",
        "| Metric | Generic LLM | PlaceMates |",
        "|---|---|---|",
        f"| Factual claims audited | {base['claims']} | {pm['claims']} |",
        f"| Unsupported / contradictory / inaccurate claims | {base['bad']} | {pm['bad']} |",
        f"| Bad claims per 100 claims | {base['bad_per_100']} | {pm['bad_per_100']} |",
        f"| Resumes with at least one bad claim | {base['resumes_with_bad']} of {n} | {pm['resumes_with_bad']} of {n} |",
        f"| Code check: numbers/tech not in the student's facts | {base['code_flags']} | {pm['code_flags']} |",
        f"| Required-skill coverage (same job brief) | {base['coverage']}% | {pm['coverage']}% |",
        f"| Blind judge rubric average (1-10) | {base['rubric_avg']} | {pm['rubric_avg']} |",
        f"| Blind judge preferred | {prefs['baseline']} | {prefs['placemates']} (ties {prefs['tie']}) |",
        "",
        f"Rubric detail, generic LLM: {base['rubric']}",
        f"Rubric detail, PlaceMates: {pm['rubric']}",
        "",
        (f"**Unsupported-claim rate: {reduction}% lower with PlaceMates** "
         f"({base['bad_per_100']} vs {pm['bad_per_100']} per 100 claims)." if reduction is not None else ""),
        "",
        f"Small sample (n={n}): treat as a pilot, not a final result. Hand-check `claims.csv` (fill `your_label`) "
        "to confirm the judge's labels before quoting numbers.",
    ]
    text = "\n".join(lines)
    (OUT / "report.md").write_text(text, encoding="utf-8")
    return text


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", nargs="*", help='"Full Name=jobs" per student (default: the 5-pair pilot)')
    parser.add_argument("--report-only", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    for noisy in ("httpx", "httpcore", "crewai", "LiteLLM"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    OUT.mkdir(exist_ok=True)

    if not args.report_only:
        plan = {k: int(v) for k, v in (p.rsplit("=", 1) for p in args.plan)} if args.plan else PILOT
        with SessionLocal() as db:
            pair_list = pairs_mod.build(db, plan)
        for pair in pair_list:
            try:
                run_pair(pair)
            except QuotaExhausted as err:
                print(f"\nStopped: a free daily quota ran out ({err}). Run the same command again later; "
                      "finished steps are kept.")
                break
    print(report())


if __name__ == "__main__":
    main()
