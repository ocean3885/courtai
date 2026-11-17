#!/usr/bin/env python3
"""Independent arithmetic notes for user-provided PDF extracts.

Recognized amounts and explicit formulas are manually transcribed. This does not
infer legal entitlement, validate fee schedules, or read confidential originals.
--check compares the stored notes without changing them.
"""
import argparse
import json
from fractions import Fraction as F
from pathlib import Path

OUTPUT = Path(__file__).with_name('arithmetic-audit.json')


def floor_unit(value, unit=1):
    value = F(value)
    assert value >= 0
    return value.numerator // (value.denominator * unit) * unit


def note(document, label, value, source=None, unit=1):
    value = F(value)
    result = dict(document=document, label=label,
                  exact=dict(numerator=str(value.numerator), denominator=str(value.denominator)),
                  unit=str(unit), computed=str(floor_unit(value, unit)))
    if source is not None:
        result.update(source=str(source), difference=str(floor_unit(value, unit) - source))
    return result


def calculate():
    notes = [
        note('PDF-01', '기재 인정액의 합계', 9482216 * 2 + 900 + 12967 + 1000, 18979299),
        note('PDF-02', '기재 인정액의 합계', 300000 + 900 + 11695, 312595),
        note('PDF-06', '기재 인정액의 합계', 2789442 + 900 + 11219, 2801561),
        note('PDF-09', '기재 인정액의 합계', 9658000 + 635900 + 7860 + 900 + 6377 + 1000, 10310037),
    ]
    forward = ((F(12541412 + 1540300) * F(207070613, 600941226) + F(96340, 3)) * F(3, 5)
               + F(15382806, 2) * F(3, 5) + F(17642, 3) * F(3, 5))
    reverse = F(5500000 + 15382806 + 4989600 + 11630) * F(2, 5) / 2
    third = F(12541412 + 1540300) * F(186800000, 600941226) + F(96340 + 17642, 3)
    notes.extend([
        note('PDF-03', 'B1·B2 각 정밀 상계 후 원 미만 절사', forward - reverse, 2372170),
        note('PDF-03', 'B1·B2 각 정밀 상계 후 10원 미만 절사', forward - reverse, 2372170, 10),
        note('PDF-03', 'B3 정밀 부담액의 10원 미만 절사', third, 4415230, 10),
    ])
    for second_value, variant in [(55291428, '2쪽 산식의 반소 가액'), (55921428, '1쪽 표의 반소 가액')]:
        for party, weight, source in [('A1', 96462800, 1625012), ('A2', 64308500, 1085223)]:
            value = (F(5500000) * F(78289999, 303369799) * F(weight, 225079800)
                     + F(6600000) * F(second_value, 216692728) * F(weight, 160771300) + F(12129, 2))
            notes.append(note('PDF-04', f'{party} · {variant} 경로', value, source))
    forward = F(57670546 + 19950691) * F(3, 5) + 14300000 + F(12475) * F(3, 5)
    reverse = F(18611042 + 20653240) * F(2, 5)
    notes.extend([
        note('PDF-05', '중간 표시 신청인 본안 부담액 합계', 34602328 + 11970415 + 14300000, 60872742),
        note('PDF-05', '양방향 원 미만 절사 후 상계', floor_unit(forward) - floor_unit(reverse), 45174515),
        note('PDF-05', '정밀 상계 후 원 미만 절사', forward - reverse, 45174515),
        note('PDF-07', '전체 피고 3명의 몫 유지 후 최종 10원 미만 절사', F(600961) - F(147948, 3), 551640, 10),
        note('PDF-08', '본안비용 + 신청비용', 9152233 + 233227, 9165460),
        note('PDF-08', '별지와 표제 소가의 차이', 105361798 - 105355798),
    ])
    for respondent, weight, source in [('B1', 105361798, 1527576), ('B2', 57144171, 1082161)]:
        value = F(9165460, 2) * F(2, 3) / 2 - F(7600000) * F(weight, 162505969) * F(1, 3) / 2
        notes.append(note('PDF-08', f'2쪽 {respondent} 산식을 그대로 실행한 신청인별 금액', value, source))
    return dict(scope='원문 인정액·명시 산식의 일부 산술 대조. 법률 검증·정답 확정·계산기 편입 미완료.', notes=notes)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    rendered = json.dumps(calculate(), ensure_ascii=False, indent=2) + '\n'
    if args.check:
        if OUTPUT.read_text() != rendered:
            raise SystemExit('Stored arithmetic notes differ; review before regenerating.')
    else:
        OUTPUT.write_text(rendered)
    print(f'{len(calculate()["notes"])} arithmetic paths verified; source differences retained.')


if __name__ == '__main__':
    main()
