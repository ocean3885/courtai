"""HWP 별지 2의 산술 재현. 범용 소송비용 계산기나 법률 규칙 엔진이 아니다.

실행: python docs/examples/verify_litigation_costs_hwp.py
출력: docs/examples/litigation-costs-hwp-results.json
원문에서 전사한 입력과 쌍별 금액을 exact Fraction 산술로 비교한다.
"""
import json
from fractions import Fraction as F
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def floor10(value):
    assert value >= 0, "이 사례의 방향별 양수 금액에만 적용"
    return value.numerator // (value.denominator * 10) * 10


def exact(value):
    return {"numerator": value.numerator, "denominator": value.denominator}


def calculate(case):
    main, counter = case["main_value"], case["counter_value"]
    total = main + counter
    c = case["costs"]
    plaintiffs, defendants = case["plaintiffs"], case["defendants"]
    np, nd = len(plaintiffs), len(defendants)
    nc = sum(p["counter_defendant"] for p in plaintiffs)
    assert sum(p["main_value"] for p in plaintiffs) == main
    appeal_main = case["appeal_defendant_main_value"]
    appeal_total = appeal_main + case["appeal_defendant_counter_value"]
    assert appeal_total + case["appeal_incidental_value"] == total
    expected = {(r["debtor"], r["creditor"]): r for r in case["published_directions_floor10"]}
    rows = []
    allocated_p = allocated_d = forward_total = reverse_total = F(0)
    for d in defendants:
        for p in plaintiffs:
            w = F(p["main_value"], main)
            # 본소·반소의 배분 비율과 당사자별 배분 비율을 구분한다.
            fee_weight = F(p["main_value"], total)
            counter_weight = F(counter, total)
            p_lines = {
                "trial_main_fee": c["p_trial_fee"] * fee_weight / nd,
                "trial_main_stamp": c["p_trial_stamp"] * w / nd,
                "trial_main_fixed": F(c["p_trial_service"] + c["p_trial_expert"], np * nd),
                "appeal_main_fee": c["p_appeal_fee"] * fee_weight / nd,
                "appeal_main_stamp": c["p_appeal_stamp"] * w / nd,
                "application": F(c["application"], np * nd),
            }
            d_lines = {
                "trial_main_fee": c["d_trial_fee"] * fee_weight / nd,
                "appeal_main_fee": c["d_appeal_fee"] * fee_weight / nd,
                "appeal_main_stamp": c["d_appeal_stamp"] * F(appeal_main, appeal_total) * w / nd,
                "appeal_main_service": F(c["d_appeal_service"], 2 * np * nd),
                "appeal_main_expert": F(c["d_appeal_expert"], np * nd),
            }
            if d == case["counter_claimant"] and p["counter_defendant"]:
                p_lines.update({
                    "trial_counter_fee": c["p_trial_fee"] * counter_weight / nc,
                    "appeal_counter_fee": c["p_appeal_fee"] * counter_weight / nc,
                })
                d_lines.update({
                    "trial_counter_fee": c["d_trial_fee"] * counter_weight / nc,
                    "trial_counter_stamp": F(c["d_trial_counter_stamp"], nc),
                    "trial_counter_service": F(c["d_trial_counter_service"], nc),
                    "appeal_counter_fee": c["d_appeal_fee"] * counter_weight / nc,
                    "appeal_counter_stamp": c["d_appeal_stamp"] * F(counter, appeal_total) / nc,
                    "appeal_counter_service": F(c["d_appeal_service"], 2 * nc),
                })
            p_cost, d_cost = sum(p_lines.values(), F(0)), sum(d_lines.values(), F(0))
            own_burden = F(*p["own_burden"])
            forward, reverse = p_cost * (1 - own_burden), d_cost * own_burden
            pf, df = floor10(forward), floor10(reverse)
            net = pf - df
            ref = expected[(d, p["id"])]
            assert (pf, df, net) == (ref["forward"], ref["reverse"], ref["net"]), (d, p["id"])
            assert counter_weight > 0
            rows.append({
                "debtor": d, "creditor": p["id"], "creditor_label": p["label"],
                "plaintiff_allocations": {k: exact(v) for k, v in p_lines.items()},
                "defendant_allocations": {k: exact(v) for k, v in d_lines.items()},
                "forward_exact": exact(forward), "reverse_exact": exact(reverse),
                "forward_floor10": pf, "reverse_floor10": df, "net_source_method": net,
                "net_then_floor10_comparison": floor10(forward - reverse),
            })
            allocated_p += p_cost
            allocated_d += d_cost
            forward_total += forward
            reverse_total += reverse
    # 비용 누락·중복을 최종 차액 일치와 별도로 검증한다.
    p_input = sum(v for k, v in c.items() if k.startswith("p_") or k == "application")
    d_input = sum(v for k, v in c.items() if k.startswith("d_"))
    assert allocated_p == p_input == 26400329
    assert allocated_d == d_input == 12667663
    forward_floor1 = forward_total.numerator // forward_total.denominator
    reverse_floor1 = reverse_total.numerator // reverse_total.denominator
    # A→나: 절사 위치가 바뀌면 10원 차이가 나는 회귀 기준 사례.
    a_na = next(r for r in rows if r["debtor"] == "A" and r["creditor"] == "p2")
    assert a_na["net_source_method"] == 4764820
    assert a_na["net_then_floor10_comparison"] == 4764810
    return {
        "case": case["id"], "status": "문서의 쌍별 8개 금액 및 절사 전 배분 보존 검증 통과",
        "scope": "문서에 명시된 비용액과 사례별 배분식의 산술만 검증; 법률 일반화·원문 시각 대조 미완료",
        "rows": rows,
        "summary": {
            "allocated_plaintiff_total": p_input, "allocated_defendant_total": d_input,
            "forward_exact": exact(forward_total), "reverse_exact": exact(reverse_total),
            "source_aggregate_forward": case["source_aggregate_forward"],
            "source_aggregate_reverse": case["source_aggregate_reverse"],
            "recomputed_aggregate_forward_floor1": forward_floor1,
            "recomputed_aggregate_reverse_floor1": reverse_floor1,
            "forward_aggregate_difference": forward_floor1 - case["source_aggregate_forward"],
            "reverse_aggregate_difference": reverse_floor1 - case["source_aggregate_reverse"],
            "sum_forward_floor10": sum(r["forward_floor10"] for r in rows),
            "sum_reverse_floor10": sum(r["reverse_floor10"] for r in rows),
            "sum_net_source_method": sum(r["net_source_method"] for r in rows),
        },
    }


if __name__ == "__main__":
    case = json.loads((ROOT / "litigation-costs-hwp-case.json").read_text())
    result = calculate(case)
    out = ROOT / "litigation-costs-hwp-results.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(result["status"])
    for row in result["rows"]:
        print(f'{row["debtor"]} → {row["creditor_label"]}: {row["net_source_method"]:,}원')
    print("절사 전 비용 배분 총액 보존 및 절사 시점 회귀 사례 통과")
    print("미해결: 문서 총괄액과 정밀 재계산의 차이(원):",
          result["summary"]["forward_aggregate_difference"],
          result["summary"]["reverse_aggregate_difference"])
