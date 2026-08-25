import sys
import json
import os
import shutil
import tempfile
import subprocess
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from docxtpl import DocxTemplate, InlineImage
from docx.shared import Inches

try:
    from num2words import num2words
except ImportError:
    num2words = None


# ============================================================================
# OPTIMIZED PDF CONVERTER
# ============================================================================

def convert_batch_win32(conversion_list):
    """
    Converts a list of (input_docx, output_pdf) tuples in a single, fast Word process.
    """
    try:
        import win32com.client
        import pythoncom
        pythoncom.CoInitialize()

        # Launch Word instance ONCE for all conversions
        word = win32com.client.DispatchEx("Word.Application")
        word.Visible = False
        word.DisplayAlerts = 0  # Disable warning dialogs for faster execution

        successful_pdfs = []

        for docx_path, pdf_path in conversion_list:
            if os.path.exists(docx_path):
                abs_docx = os.path.abspath(docx_path)
                abs_pdf = os.path.abspath(pdf_path)
                
                doc = word.Documents.Open(abs_docx, ReadOnly=True)
                doc.SaveAs(abs_pdf, FileFormat=17)  # 17 = wdFormatPDF
                doc.Close(0)  # 0 = wdDoNotSaveChanges
                successful_pdfs.append(pdf_path)

        word.Quit()
        return successful_pdfs
    except Exception:
        return []

def convert_with_libreoffice(input_path, output_path):
    """Fallback 1: Fast headless LibreOffice conversion."""
    soffice = shutil.which('soffice') or shutil.which('libreoffice')
    if not soffice:
        for p in [r'C:\Program Files\LibreOffice\program\soffice.exe', r'C:\Program Files (x86)\LibreOffice\program\soffice.exe']:
            if os.path.exists(p):
                soffice = p
                break

    if not soffice:
        return False

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_input = os.path.join(temp_dir, os.path.basename(input_path))
        shutil.copy2(input_path, temp_input)
        cmd = [soffice, '--headless', '--convert-to', 'pdf', '--outdir', temp_dir, temp_input]
        try:
            res = subprocess.run(cmd, capture_output=True, timeout=30, text=True)
            gen_pdf = os.path.join(temp_dir, f"{os.path.splitext(os.path.basename(input_path))[0]}.pdf")
            if os.path.exists(gen_pdf) and os.path.getsize(gen_pdf) > 0:
                shutil.copy2(gen_pdf, output_path)
                return True
        except Exception:
            pass
    return False


# ============================================================================
# DOCUMENT RENDERING HELPERS
# ============================================================================

def amount_to_words(amount):
    if not amount:
        return ""
    try:
        val = float(amount)
        if num2words:
            return f"{num2words(val, lang='en_IN').title()} Only"
        return str(val)
    except Exception:
        return str(amount)

def render_agreement(template_path, output_docx_path, context_data):
    if not os.path.exists(template_path):
        return None
    doc = DocxTemplate(template_path)
    
    sig_path = context_data.get("signature_path", "")
    context = {
        "customer_name": context_data.get("customer_name", "Customer"),
        "customer_address": context_data.get("customer_address", ""),
        "date": context_data.get("date_str"),
        "signature": InlineImage(doc, sig_path, width=Inches(2.0)) if sig_path and os.path.exists(sig_path) else ""
    }
    doc.render(context)
    doc.save(output_docx_path)
    return output_docx_path

def render_quotation(template_path, output_docx_path, context_data):
    if not os.path.exists(template_path):
        return None
    doc = DocxTemplate(template_path)
    cost = context_data.get("cost", 0)
    
    context = {
        "sr_no": context_data.get("sr_no", ""),
        "date": context_data.get("date_str"),
        "customer_name": context_data.get("customer_name", "Customer"),
        "kw": context_data.get("kw", ""),
        "solar_panel_brand": context_data.get("panel_company", ""),
        "solar_panel_watt": context_data.get("panel_watt", ""),
        "solar_panel_pcs": context_data.get("panel_quantity", ""),
        "inverter_brand": context_data.get("inverter_company", ""),
        "inverter_kw": context_data.get("inverter_watt", ""),
        "structure_kw": context_data.get("structure_watt", ""),
        "total_cost_number": f"₹ {cost:,}" if isinstance(cost, (int, float)) else f"₹ {cost}",
        "total_cost_words": amount_to_words(cost)
    }
    doc.render(context)
    doc.save(output_docx_path)
    return output_docx_path


# ============================================================================
# MAIN PIPELINE
# ============================================================================

def generate_documents(data):
    sr_no = data.get("sr_no", "")
    name = data.get("customer_name", "Customer")
    data["date_str"] = data.get("date") or datetime.today().strftime("%B %d, %Y")

    target_dir = data.get("target_dir")
    template_dir = data.get("template_dir")

    agr_tpl = os.path.join(template_dir, "Agrement_template.docx")
    agr_docx = os.path.join(target_dir, f"{sr_no} {name} Agrement.docx")
    agr_pdf = os.path.join(target_dir, f"{sr_no} {name} Agrement.pdf")

    quo_tpl = os.path.join(template_dir, "Quotation_template.docx")
    quo_docx = os.path.join(target_dir, f"{sr_no} {name} Quotation.docx")
    quo_pdf = os.path.join(target_dir, f"{sr_no} {name} Quotation.pdf")

    # Step 1: Generate both DOCX templates in parallel threads
    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(render_agreement, agr_tpl, agr_docx, data)
        f2 = executor.submit(render_quotation, quo_tpl, quo_docx, data)
        f1.result()
        f2.result()

    generated_files = {
        "agreement_docx": agr_docx,
        "quotation_docx": quo_docx
    }

    # Step 2: Batch PDF conversion in a single Word COM instance
    conversions_to_run = [
        (agr_docx, agr_pdf),
        (quo_docx, quo_pdf)
    ]

    converted_pdfs = []
    if os.name == 'nt':
        converted_pdfs = convert_batch_win32(conversions_to_run)

    # Step 3: LibreOffice fallback if Word COM is unavailable
    if len(converted_pdfs) < len(conversions_to_run):
        for docx, pdf in conversions_to_run:
            if pdf not in converted_pdfs and os.path.exists(docx):
                if convert_with_libreoffice(docx, pdf):
                    converted_pdfs.append(pdf)

    if agr_pdf in converted_pdfs:
        generated_files["agreement_pdf"] = agr_pdf
    if quo_pdf in converted_pdfs:
        generated_files["quotation_pdf"] = quo_pdf

    print(json.dumps({
        "success": True, 
        "files": generated_files
    }))


if __name__ == "__main__":
    try:
        raw_input = sys.stdin.read()
        if raw_input.strip():
            payload = json.loads(raw_input)
            generate_documents(payload)
        else:
            print(json.dumps({"success": False, "error": "No JSON payload provided in stdin"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)