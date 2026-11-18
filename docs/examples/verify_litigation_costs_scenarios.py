#!/usr/bin/env python3
"""Deterministic synthetic matrix; Python Fraction expectations never call the app.

Uses the separately implemented recognized-cost oracle. Source figures are not
new legal conclusions. --check verifies the committed oracle without rewriting it.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
from verify_litigation_costs_cases import verify

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'src/lib/fixtures/litigation-costs-cases.json'
OUTPUT = Path(__file__).with_name('litigation-costs-scenario-oracle.json')


def build():
    scenarios = []
    for base in json.loads(SOURCE.read_text()):
        if base['expectedStatus'] != 'preview':
            continue
        for variant in ['source', 'awkward', 'zero']:
            for unit in ['1', '10']:
                for timing in ['direction', 'net']:
                    for setoff in ['mutual', 'applicantOnly']:
                        case = copy.deepcopy(base)
                        case['sourceAmounts'] = []
                        case['rounding'] = dict(unit=unit, timing=timing)
                        case['setoff'] = setoff
                        for i, cost in enumerate(case['costs']):
                            if variant == 'awkward':
                                cost['recognized'] = str((i + 1) * 10003 + 200 + int(cost['recognized']) % 997)
                            elif variant == 'zero':
                                cost['recognized'] = '0'
                        expected = verify(case)
                        assert expected['status'] == 'preview'
                        rows = [[r['applicantId'], r['respondentId'], r['forward']['numerator'], r['forward']['denominator'],
                                 r['reverse']['numerator'], r['reverse']['denominator'], r['forwardRounded'], r['reverseRounded'], r['net']]
                                for r in expected['rows']]
                        scenarios.append(dict(id=f"{base['id']}-{variant}-{unit}-{timing}-{setoff}", baseId=base['id'],
                                              variant=variant, unit=unit, timing=timing, setoff=setoff,
                                              traceCount=expected['traceCount'], rows=rows))
    return dict(description='Synthetic recognized-cost matrix; independent Python Fraction expectations, no legal approval.',
                sourceSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(), scenarios=scenarios)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    data = build()
    # One scenario per line keeps this generated artifact reviewable without many thousands of lines.
    header = {k: v for k, v in data.items() if k != 'scenarios'}
    rendered = json.dumps(header, ensure_ascii=False)[:-1] + ',\n"scenarios": [\n' + ',\n'.join(
        json.dumps(case, ensure_ascii=False, separators=(',', ':')) for case in data['scenarios']) + '\n]}\n'
    if args.check:
        assert OUTPUT.read_text() == rendered, 'Scenario oracle is stale; review before regenerating.'
    else:
        OUTPUT.write_text(rendered)
    cases = data['scenarios']
    print(f"{len(cases)} synthetic scenarios; {sum(len(c['rows']) for c in cases)} pair results; {sum(c['traceCount'] for c in cases)} expense paths; independent Fraction oracle {'checked' if args.check else 'written'}")


if __name__ == '__main__':
    main()
