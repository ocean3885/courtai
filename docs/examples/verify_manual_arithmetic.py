"""첨부 실무자료의 대표 산술 점검. 법률 일반 규칙이나 운영 계산기가 아니다.

python docs/examples/verify_manual_arithmetic.py
추출 텍스트의 수식과 결과 불일치도 숨기지 않고 JSON에 기록한다.
"""
import json
from fractions import Fraction as F
from pathlib import Path


def floor_unit(n, unit=1):
    assert n >= 0
    return n.numerator // (n.denominator * unit) * unit


def number(n):
    return {"numerator": n.numerator, "denominator": n.denominator}


def audit():
    simple = F(5945679) * F(2, 3) - F(2750000) * F(1, 3)
    assert floor_unit(simple) == 3047119
    main_value, counter_value = 49500000, 71664790
    total_value = main_value + counter_value
    fee, stamp, service, application = 3300000, 327400, 47625, 23138
    main = fee * F(main_value, total_value) + F(service, 2)
    counter = fee * F(counter_value, total_value) + stamp + F(service, 2)
    assert main + counter == fee + stamp + service == 3675025
    full = main * F(4, 5) + counter * F(1, 4) + application
    omitted = main * F(4, 5) + (counter - stamp) * F(1, 4) + application
    assert full - omitted == stamp * F(1, 4) == 81850
    assert floor_unit(full, 10) == 1696480
    assert floor_unit(omitted, 10) == 1614630
    source_counter_display = 1975649
    printed_component_sum = 1951836 + 327400 + 23813
    assert printed_component_sum - source_counter_display == stamp
    assert floor_unit(full, 10) - floor_unit(omitted, 10) == 81850
    old_fee = 6800000 + (500000000 - 200000000) * F(1, 100)
    new_fee = 10400000 + (500000000 - 200000000) * F(1, 100)
    assert old_fee == 9800000 and new_fee == 13400000
    return {
        "status": "대표 산술 검증 완료; 반소 사례 불일치는 미해결",
        "scope": "전 사례 검증 아님. 원본 시각 대조와 법률 적용 검증 미완료",
        "checks": [
            {"id": "A1", "status": "일치", "topic": "기본 일부승소 사례",
             "exact": number(simple), "source_floor1": 3047119},
            {"id": "A2", "status": "원본 대조 필요", "topic": "반소 인지대 누락 의심",
             "main_exact": number(main), "counter_exact": number(counter),
             "allocation_conservation": 3675025,
             "printed_component_sum": printed_component_sum,
             "source_counter_display": source_counter_display,
             "component_discrepancy": stamp,
             "with_stamp_floor10": floor_unit(full, 10),
             "without_stamp_floor10": floor_unit(omitted, 10),
             "source_final": 1614630, "final_discrepancy": 81850,
             "note": "인지대 포함 비교 경로가 법률상 최종 정답임을 선언하지 않는다."},
            {"id": "A3", "status": "버전 차이 확인", "topic": "5억원 보수 기준 예",
             "manual_old_basis": int(old_fee), "verified_2020_basis": int(new_fee),
             "difference": int(new_fee - old_fee),
             "note": "자료 구요율과 2020년 별표의 차이. 구자료 산술 오류로 처리하지 않음."},
        ],
    }


if __name__ == "__main__":
    result = audit()
    dest = Path(__file__).with_name("litigation-costs-manual-audit.json")
    dest.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    for row in result["checks"]:
        print(row["id"], row["topic"], row["status"])
    print("반소 최종액 비교 차이 81,850원: 미해결 상태로 기록")
