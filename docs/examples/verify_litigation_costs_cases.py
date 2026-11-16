#!/usr/bin/env python3
"""Independent Fraction oracle for the shipped recognized-cost case data.

Does not import the TypeScript adapter or allocation engine. The fixture specifies
source-recognized costs and explicit weights; this is no fee-rule/legal oracle.
Run with --check to detect stale committed expectations without writing them.
"""
import argparse
import json
from collections import defaultdict
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / 'src/lib/fixtures/litigation-costs-cases.json'
OUTPUT = Path(__file__).with_name('litigation-costs-case-oracle.json')


def exact(value):
    return dict(numerator=str(value.numerator), denominator=str(value.denominator))


def truncate(value, unit):
    return (-1 if value < 0 else 1) * (abs(value.numerator) // (value.denominator * unit)) * unit


def verify(case):
    parties = {p['id']: p for p in case['parties']}
    rules = {r['id']: r for r in case['rules']}
    stages = {s['id']: s for s in case['stages']}
    claims = {c['id']: c for c in case['claims']}
    pairs = defaultdict(lambda: [Fraction(0), Fraction(0)])
    budgets = []
    count = 0
    for cost in case['costs']:
        owners = cost['owners']
        owner_total = sum(Fraction(o['weight']) for o in owners)
        assert owner_total > 0
        allocated = Fraction(0)
        for owner in owners:
            route_total = sum(Fraction(r['weight']) for r in owner['routes'])
            assert route_total > 0
            for route in owner['routes']:
                rule = rules[route['ruleId']]
                payer_ids = rule.get('payerIds', [rule['respondentId']])
                if len(payer_ids) != 1:
                    return dict(id=case['id'], status='blocked', reason='복수·연대', rows=[], budgets=[], traceCount=0, sourceComparison=[])
                person, other = parties[owner['ownerId']], parties[route['otherId']]
                roles = {person['applicationRole'], other['applicationRole']}
                if roles != {'신청인', '피신청인'}:
                    return dict(id=case['id'], status='blocked', reason='신청 대상 외', rows=[], budgets=[], traceCount=0, sourceComparison=[])
                assert {person['id'], other['id']} == {rule['applicantId'], rule['respondentId']}
                assert person['id'] in stages[cost['stageId']]['partyIds']
                assert other['id'] in stages[cost['stageId']]['partyIds']
                claim = claims[route['claimId']]
                assert ((person['id'] in claim['claimantIds'] and other['id'] in claim['opponentIds']) or
                        (other['id'] in claim['claimantIds'] and person['id'] in claim['opponentIds']))
                assert route['claimId'] in rule['claimIds']
                assert cost['stageId'] in rule['stageIds'] or stages[cost['stageId']]['type'] == '확정신청'
                share = Fraction(cost['recognized']) * Fraction(owner['weight']) / owner_total * Fraction(route['weight']) / route_total
                allocated += share
                forward = person['applicationRole'] == '신청인'
                ratio = rule['forward' if forward else 'reverse']
                burden = Fraction(int(ratio[0]), int(ratio[1]))
                assert 0 <= burden <= 1
                if forward or case['setoff'] == 'mutual':
                    pairs[rule['applicantId'], rule['respondentId']][0 if forward else 1] += share * burden
                else:
                    pairs[rule['applicantId'], rule['respondentId']]
                count += 1
        assert allocated == Fraction(cost['recognized']), (case['id'], cost['id'])
        budgets.append(dict(costId=cost['id'], recognized=cost['recognized'], allocated=exact(allocated)))
    rows = []
    unit = int(case['rounding']['unit'])
    for (applicant, respondent), (forward, reverse) in pairs.items():
        f, r = truncate(forward, unit), truncate(reverse, unit)
        directional = case['rounding']['timing'] == 'direction'
        net = f - r if directional else truncate(forward - reverse, unit)
        rows.append(dict(applicantId=applicant, respondentId=respondent, forward=exact(forward), reverse=exact(reverse),
                         forwardRounded=str(f) if directional else None, reverseRounded=str(r) if directional else None, net=str(net)))
    comparison = []
    for source in case['sourceAmounts']:
        row = next(r for r in rows if r['applicantId'] == source['applicantId'] and r['respondentId'] == source['respondentId'])
        comparison.append(dict(**source, computed=row['net'], difference=str(int(row['net']) - int(source['net']))))
    return dict(id=case['id'], status='preview', rows=rows, budgets=budgets, traceCount=count, sourceComparison=comparison)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    cases = json.loads(INPUT.read_text())
    results = [verify(c) for c in cases]
    for case, result in zip(cases, results):
        assert result['status'] == case['expectedStatus'], case['id']
        if result['status'] == 'blocked':
            assert result['reason'] == case['expectedError'], case['id']
    data = dict(description='입력 인정액·명시적 배분의 독립 분수 검산. 원문 기재액의 차이를 그대로 보존하며 법률상 정답·현행 보수 기준으로 확정하지 않음.', cases=results)
    rendered = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    if args.check:
        assert OUTPUT.read_text() == rendered, 'Oracle output is stale. Review changes before regenerating.'
    else:
        OUTPUT.write_text(rendered)
    for case, result in zip(cases, results):
        differences = [r for r in result['sourceComparison'] if r['difference'] != '0']
        print(f"{case['id']}: {result['status']}, {len(result['rows'])} pairs, {len(differences)} source differences")


if __name__ == '__main__':
    main()
