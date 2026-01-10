import pdfplumber
import os
import sys
import json
from pathlib import Path

class PDFPlumberOCR:
    def __init__(self):
        pass

    def format_table_as_html(self, table_data):
        """표 데이터를 HTML <table> 형식으로 변환합니다."""
        if not table_data or not table_data[0]:
            return ""
        
        # 1. 데이터 클리닝 (토큰 절약을 위해 줄바꿈 삭제 및 앞뒤 공백 정리)
        clean_table = [[(str(cell).replace('\n', '').strip() if cell else "") for cell in row] for row in table_data]
        
        # 2. 스마트 패딩 (Smart Padding) - HTML에서도 열 정렬을 위해 동일하게 적용
        num_cols = max(len(row) for row in clean_table)
        final_table = []
        summary_keywords = ["합계", "총계", "소계", "계"]
        
        for row in clean_table:
            current_len = len(row)
            if current_len < num_cols:
                is_summary = any(row[0].startswith(kw) for kw in summary_keywords) if row else False
                if is_summary:
                    padding_needed = num_cols - current_len
                    new_row = [row[0]] + [""] * padding_needed + row[1:]
                    final_table.append(new_row)
                else:
                    new_row = row + [""] * (num_cols - current_len)
                    final_table.append(new_row)
            else:
                final_table.append(row)

        # 3. HTML 생성 (토큰 절약을 위해 스타일 최소화)
        html = ["<table border='1'>"]
        for i, row in enumerate(final_table):
            html.append("  <tr>")
            for cell in row:
                tag = "th" if i == 0 else "td"
                html.append(f"    <{tag}>{cell}</{tag}>")
            html.append("  </tr>")
        html.append("</table>")
        
        return "\n".join(html)

    def extract_text_and_tables(self, pdf_path: str) -> str:
        """
        PDF 파일에서 텍스트와 표를 추출하여 위치 순서대로 병합된 문자열을 반환합니다.
        표는 HTML 형식으로 변환되어 포함됩니다.
        """
        elements = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    elements.append({"type": "page_marker", "value": i + 1})
                    
                    # 1. 표 찾기 및 좌표 정보 추출
                    tables = page.find_tables()
                    table_objects = []
                    for t in tables:
                        table_objects.append({
                            "top": t.bbox[1],
                            "bottom": t.bbox[3],
                            "data": t.extract()
                        })
                    
                    # 표를 수직 위치순(top)으로 정렬
                    table_objects.sort(key=lambda x: x["top"])
                    
                    last_bottom = 0
                    
                    # 2. 표 사이사이의 텍스트와 표를 순서대로 배치
                    for t_obj in table_objects:
                        # 표 이전의 텍스트 영역 추출
                        if t_obj["top"] > last_bottom:
                            text_region = page.within_bbox((0, last_bottom, page.width, t_obj["top"]))
                            text = text_region.extract_text()
                            if text and text.strip():
                                elements.append({"type": "text", "value": text})
                        
                        elements.append({"type": "table", "value": t_obj["data"]})
                        last_bottom = t_obj["bottom"]
                    
                    # 마지막 표 이후의 남은 텍스트 추출
                    if last_bottom < page.height:
                        remaining_region = page.within_bbox((0, last_bottom, page.width, page.height))
                        text = remaining_region.extract_text()
                        if text and text.strip():
                            elements.append({"type": "text", "value": text})
            
            # 3. 테이블 병합 로직
            merged_elements = []
            for elem in elements:
                if not merged_elements:
                    merged_elements.append(elem)
                    continue
                
                # 현재 요소가 테이블인 경우 병합 시도
                if elem["type"] == "table":
                    merge_target_idx = -1
                    can_merge = False
                    
                    # 거꾸로 올라가며 병합 가능한 직전 테이블 찾기
                    for j in range(len(merged_elements) - 1, -1, -1):
                        prev = merged_elements[j]
                        if prev["type"] == "table":
                            merge_target_idx = j
                            can_merge = True
                            break
                        elif prev["type"] == "text":
                            if prev["value"].strip():
                                break
                    
                    if can_merge:
                        target_table = merged_elements[merge_target_idx]
                        target_table["value"].extend(elem["value"])
                        del merged_elements[merge_target_idx + 1:]
                    else:
                        merged_elements.append(elem)
                else:
                    merged_elements.append(elem)

            # 4. 최종 결과 생성
            final_output = []
            for elem in merged_elements:
                if elem["type"] == "page_marker":
                    final_output.append(f"\n\n{'='*20} Page {elem['value']} {'='*20}\n")
                elif elem["type"] == "text":
                    final_output.append(elem["value"])
                elif elem["type"] == "table":
                    final_output.append("\n[TABLE START]")
                    # 여기에서 HTML 또는 ASCII 선택 가능 (현재는 HTML)
                    final_output.append(self.format_table_as_html(elem["value"]))
                    final_output.append("[TABLE END]\n")
            
            return "\n".join(final_output)
            
        except Exception as e:
            return f"Error processing PDF with pdfplumber: {str(e)}"

def convert_txt_to_html_tables(txt_content: str) -> str:
    """
    텍스트 내의 [TABLE START]...[TABLE END] 블록(ASCII 표)을 HTML 표로 변환합니다.
    이미 생성된 TXT 파일을 가공할 때 유용합니다.
    """
    import re
    
    def ascii_to_html(match):
        table_text = match.group(1).strip()
        rows = []
        for line in table_text.split('\n'):
            if line.startswith('|'):
                # '|'로 분리하고 앞뒤 '|' 제거 후 각 셀 추출
                cells = [c.strip() for c in line.split('|') if c.strip() or line.count('|') > 1]
                # split('|') 결과의 처음과 마지막 빈 값 제외 (줄이 |로 시작/끝나기 때문)
                cells = [c.strip() for c in line[1:-1].split('|')]
                if cells:
                    rows.append(cells)
        
        if not rows:
            return match.group(0)
            
        # PDFPlumberOCR의 로직을 재사용하여 HTML 생성
        parser = PDFPlumberOCR()
        return f"\n[TABLE START]\n{parser.format_table_as_html(rows)}\n[TABLE END]\n"

    # [TABLE START]와 [TABLE END] 사이의 내용을 찾음 (DOTALL 모드)
    pattern = re.compile(r'\[TABLE START\](.*?)\[TABLE END\]', re.DOTALL)
    return pattern.sub(ascii_to_html, txt_content)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python pdf_parser.py <input_pdf_path> <output_txt_path>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    parser = PDFPlumberOCR()
    extracted_text = parser.extract_text_and_tables(input_path)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(extracted_text)
    
    print(f"Success: Extracted text saved to {output_path}")
