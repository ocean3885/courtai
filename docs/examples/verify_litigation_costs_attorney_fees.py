#!/usr/bin/env python3
"""Independent marginal-band Fraction oracle, not the TS cumulative formula."""
import argparse
import json
from fractions import Fraction as F
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUTPUT = Path(__file__).with_name('litigation-costs-attorney-fee-oracle.json')


def standard(value):
    result = F(300000)
    segments = [(3000000, 20000000, F(1, 10)), (20000000, 50000000, F(8, 100)),
                (50000000, 100000000, F(6, 100)), (100000000, 150000000, F(4, 100)),
                (150000000, 200000000, F(2, 100)), (200000000, 500000000, F(1, 100)),
                (500000000, 9007199254740991, F(5, 1000))]
    for low, high, rate in segments:
        result += max(0, min(value, high) - low) * rate
    return result


def exact(value):
    return dict(numerator=str(value.numerator), denominator=str(value.denominator))


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--check', action='store_true'); args = parser.parse_args()
    points = sorted({0, 1, 2000000, 1000000000, 9007199254740991} | {n + delta for n in [3000000, 20000000, 50000000, 100000000, 150000000, 200000000, 500000000] for delta in [-1, 0, 1]})
    scenarios = [(v, 9007199254740991, 0, 'ordinary') for v in points]
    scenarios += [(50000000, 10000000, 0, 'ordinary'), (50000000, 3300000, 0, 'ordinary'),
                  (50000000, 0, 0, 'ordinary'), (50000000, 5000000, 2000000, 'ordinary'),
                  (50000000, 1000000, 0, 'half'), (50000000, 10000000, 0, 'half'),
                  (3000011, 9007199254740991, 0, 'half'), (154110828, 10000000, 0, 'ordinary')]
    rows = []
    for value, paid, refund, treatment in scenarios:
        base = standard(value); limit = base / (2 if treatment == 'half' else 1)
        rows.append(dict(input=dict(schedule='2020-12-28', treatment=treatment, litigationValue=str(value)), paid=str(paid), refund=str(refund),
                         expected=dict(standardExact=exact(base), standardAmount=str(int(base)), limitExact=exact(limit), limitAmount=str(int(limit)), recognized=str(min(int(limit), paid-refund)))))
    cases = json.loads((ROOT/'src/lib/fixtures/litigation-costs-attorney-fee-cases.json').read_text())
    for case in cases:
        total = int(case['applicationFee'])
        for fee in case['fees']:
            recognized = min(int(standard(int(fee['litigationValue']))), int(fee['paid']))
            assert recognized == int(fee['recognized']), case['id']
            total += recognized
        assert total == int(case['expected']['net']), case['id']
        print(f"{case['id']}: {total:,} won independently verified")
    rendered = json.dumps(dict(scope='2020.12.28. 별표·명시적 제5조·실비 상한의 산술 검산. 소가·지급의무·규칙 적용 시점의 법률 판단은 별도.', rows=rows), ensure_ascii=False, indent=2)+'\n'
    if args.check:
        assert OUTPUT.read_text() == rendered, 'Oracle is stale; review changes before regenerating.'
    else:
        OUTPUT.write_text(rendered)
    print(f'{len(rows)} exact fee scenarios verified')

if __name__ == '__main__': main()
