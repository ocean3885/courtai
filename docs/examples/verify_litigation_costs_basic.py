#!/usr/bin/env python3
"""Independent expected amounts for cases entered through the blank form.

The asserted net amounts are fixed in the input before execution. Uses Python
Fraction and marginal fee bands, and never imports TypeScript/app output.
"""
import argparse
import json
from fractions import Fraction as F
from pathlib import Path
from verify_litigation_costs_attorney_fees import standard
ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT/'src/lib/fixtures/litigation-costs-basic-cases.json'
OUTPUT = Path(__file__).with_name('litigation-costs-basic-oracle.json')

def exact(v):
    return dict(numerator=str(v.numerator), denominator=str(v.denominator))

def truncate(v, unit):
    return (-1 if v < 0 else 1) * (abs(v.numerator)//(v.denominator*unit))*unit

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--check',action='store_true'); args=parser.parse_args()
    data=json.loads(INPUT.read_text()); common=data['defaults']; rows=[]
    for c in data['cases']:
        p=dict(common['plaintiff']); d=dict(common['defendant']); app=dict(common['application'])
        if c.get('plaintiffFee'): p['fee']=c['plaintiffFee']
        if c.get('zero'):
            p={k:'0' for k in p}; d={k:'0' for k in d}; app={k:'0' for k in app}
        cap=int(standard(int(common['litigationValue'])))
        def costs(side):
            return min(cap,int(side['fee']))+int(side['stamp'])+int(side['servicePaid'])-int(side['serviceRefund'])
        applicant=costs(p if c['applicantRole']=='원고' else d)+sum(map(int,app.values()))
        respondent=costs(d if c['applicantRole']=='원고' else p)
        share=F(*map(int,c['share']))
        f=F(0) if c['mode']=='own' else applicant*(1-share)
        r=F(0) if c['mode']=='own' else respondent*share
        unit=int(c['unit']); direction=c['timing']=='direction'
        net=truncate(f,unit)-truncate(r,unit) if direction else truncate(f-r,unit)
        assert str(net)==c['expectedNet'],(c['id'],net,c['expectedNet'])
        rows.append(dict(id=c['id'],forward=exact(f),reverse=exact(r),forwardRounded=str(truncate(f,unit)) if direction else None,
                         reverseRounded=str(truncate(r,unit)) if direction else None,net=str(net),
                         applicantRecognized=str(applicant),respondentRecognized=str(respondent)))
        print(f"{c['id']}: independent expectation {net:,} won")
    rendered=json.dumps(dict(scope=data['scope'],cases=rows),ensure_ascii=False,indent=2)+'\n'
    if args.check: assert OUTPUT.read_text()==rendered,'Basic oracle is stale; review before regenerating.'
    else: OUTPUT.write_text(rendered)

if __name__=='__main__': main()
