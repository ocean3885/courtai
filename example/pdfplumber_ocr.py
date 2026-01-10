import pdfplumber
import os
from pathlib import Path

class PDFPlumberOCR:
    def __init__(self):
        pass

    def format_table_as_text(self, table_data):
        """표 데이터를 텍스트 형식(ASCII 표 스타일)으로 변환합니다."""
        if not table_data or not table_data[0]:
            return ""
        
        # None 값을 빈 문자열로 변환하고 줄바꿈 제거
        clean_table = [[(str(cell).replace('\n', ' ').strip() if cell else "") for cell in row] for row in table_data]
        
        # 열 개수가 일치하지 않는 경우에 대비한 방어 로직
        num_cols = max(len(row) for row in clean_table)
        for row in clean_table:
            while len(row) < num_cols:
                row.append("")

        # 열 너비 계산 (최소 너비 2)
        col_widths = [max(len(str(row[i])) for row in clean_table) for i in range(num_cols)]
        col_widths = [max(w, 2) for w in col_widths]
        
        output = []
        separator = "+" + "+".join("-" * (w + 2) for w in col_widths) + "+"
        
        output.append(separator)
        for row in clean_table:
            formatted_row = "| " + " | ".join(str(cell).ljust(col_widths[i]) for i, cell in enumerate(row)) + " |"
            output.append(formatted_row)
            output.append(separator)
            
        return "\n".join(output)

    def extract_text_and_tables(self, pdf_path: str) -> str:
        """
        PDF 파일에서 텍스트와 표를 추출하여 위치 순서대로 병합된 문자열을 반환합니다.
        """
        merged_output = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    merged_output.append(f"\n\n{'='*20} Page {i+1} {'='*20}\n")
                    
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
                            # 텍스트만 추출하기 위해 표가 없는 영역을 크롭
                            text_region = page.within_bbox((0, last_bottom, page.width, t_obj["top"]))
                            text = text_region.extract_text()
                            if text:
                                merged_output.append(text)
                        
                        # 표 데이터를 ASCII 텍스트로 추가
                        merged_output.append("\n[TABLE START]")
                        merged_output.append(self.format_table_as_text(t_obj["data"]))
                        merged_output.append("[TABLE END]\n")
                        
                        last_bottom = t_obj["bottom"]
                    
                    # 마지막 표 이후의 남은 텍스트 추출
                    if last_bottom < page.height:
                        remaining_region = page.within_bbox((0, last_bottom, page.width, page.height))
                        text = remaining_region.extract_text()
                        if text:
                            merged_output.append(text)
                            
            return "\n".join(merged_output)
            
        except Exception as e:
            return f"Error processing PDF with pdfplumber: {str(e)}"

    def save_to_file(self, content: str, output_path: str):
        """추출된 내용을 파일로 저장합니다."""
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)