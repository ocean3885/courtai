#!/usr/bin/env python3
"""Check independently entered expectations for simple output validation cases.

Reads explicit recognized costs and burden ratios. No TypeScript calculator,
renderer, legal fee schedule or source PDFs are used.
"""
import json
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def truncate(value, unit):
    return (-1 if value < 0 else 1) * (abs(value.numerator) // (value.denominator * unit)) * unit


def main():
    cases = json.loads((ROOT / 'src/lib/fixtures/litigation-costs-report-cases.json').read_text())
    for case in cases:
        rule = case['rules'][0]
        forward, reverse = Fraction(0), Fraction(0)
        for cost in case['costs']:
            assert len(cost['owners']) == 1 and len(cost['owners'][0]['routes']) == 1
            owner = cost['owners'][0]
            assert owner['routes'][0]['ruleId'] == rule['id']
            is_applicant = owner['ownerId'] == rule['applicantId']
            numerator, denominator = rule['forward' if is_applicant else 'reverse']
            value = int(cost['recognized']) * Fraction(int(numerator), int(denominator))
            if is_applicant:
                forward += value
            else:
                reverse += value
        unit = int(case['rounding']['unit'])
        net = truncate(forward - reverse, unit) if case['rounding']['timing'] == 'net' else truncate(forward, unit) - truncate(reverse, unit)
        expected = case['expected']
        assert forward == Fraction(expected['forward']), case['id']
        assert reverse == Fraction(expected['reverse']), case['id']
        assert net == int(expected['net']), case['id']
        assert abs(net) == int(expected['amount']), case['id']
        assert expected['debtorId'] == (rule['respondentId'] if net > 0 else rule['applicantId'] if net < 0 else ''), case['id']
        assert expected['creditorId'] == (rule['applicantId'] if net > 0 else rule['respondentId'] if net < 0 else ''), case['id']
        print(f"{case['id']}: forward {forward}, reverse {reverse}, net {net}: expectation verified")


if __name__ == '__main__':
    main()
