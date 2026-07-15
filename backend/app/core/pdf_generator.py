import base64
import tempfile
import os
from fpdf import FPDF
from typing import Dict, Any

def clean_text(text: str) -> str:
    if not text:
        return ""
    replacements = {
        '\u2014': '-', '\u2013': '-', '\u2018': "'", '\u2019': "'",
        '\u201c': '"', '\u201d': '"', '\u2026': '...', '\u2022': '-'
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text.encode('latin-1', 'replace').decode('latin-1')

class ReportPDF(FPDF):
    def header(self):
        self.set_font('helvetica', 'B', 15)
        self.cell(0, 10, 'Darelm Autonomous AI Analysis Report', border=False, new_x="LMARGIN", new_y="NEXT", align='C')
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Page {self.page_no()}', border=False, align='C')

def generate_report_pdf(report: Dict[str, Any]) -> bytes:
    pdf = ReportPDF()
    pdf.add_page()
    
    # Title
    pdf.set_font('helvetica', 'B', 20)
    pdf.multi_cell(0, 10, txt=clean_text(report.get("title", "Analysis Report")), new_x="LMARGIN", new_y="NEXT", align='C')
    pdf.ln(10)
    
    # Executive Summary
    if "executive_summary" in report:
        pdf.set_font('helvetica', 'B', 14)
        pdf.cell(0, 10, "Executive Summary", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font('helvetica', '', 11)
        pdf.multi_cell(0, 6, txt=clean_text(report["executive_summary"]), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(8)
    
    for section in report.get("sections", []):
        pdf.set_font('helvetica', 'B', 14)
        pdf.multi_cell(0, 10, txt=clean_text(section.get("heading", "")), new_x="LMARGIN", new_y="NEXT")
        
        if section.get("key_stat"):
            pdf.set_font('helvetica', 'B', 11)
            pdf.set_text_color(41, 128, 185) # Blue
            pdf.cell(0, 8, clean_text(f"Key Stat: {section.get('key_stat')}"), new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(0, 0, 0)
            
        pdf.set_font('helvetica', '', 11)
        pdf.multi_cell(0, 6, txt=clean_text(section.get("narrative", "")), new_x="LMARGIN", new_y="NEXT")
        
        if section.get("chart_base64"):
            b64_data = section["chart_base64"].split(",")[-1]
            try:
                img_data = base64.b64decode(b64_data)
                with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
                    tmp.write(img_data)
                    tmp_path = tmp.name
                
                # Insert image, scaled to fit page width
                pdf.ln(5)
                # Max width is 190 (210mm A4 - 20mm margins)
                pdf.image(tmp_path, w=150, x="C")
                os.unlink(tmp_path)
            except Exception as e:
                print(f"Failed to embed image in PDF: {e}")
        pdf.ln(8)
        
    # Conclusions
    if report.get("conclusions"):
        pdf.add_page()
        pdf.set_font('helvetica', 'B', 14)
        pdf.cell(0, 10, "Conclusions", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font('helvetica', '', 11)
        for conc in report["conclusions"]:
            pdf.multi_cell(0, 6, txt=clean_text(f"• {conc}"), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(8)
        
    # Recommendations
    if report.get("recommendations"):
        pdf.set_font('helvetica', 'B', 14)
        pdf.cell(0, 10, "Recommendations", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font('helvetica', '', 11)
        for rec in report["recommendations"]:
            pdf.multi_cell(0, 6, txt=clean_text(f"→ {rec}"), new_x="LMARGIN", new_y="NEXT")
            
    # fpdf2 output() returns a bytearray if dest="S"
    return pdf.output()
