import sys
import json
import os
import shutil
import tempfile
import subprocess
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

import openpyxl
from openpyxl import load_workbook
from openpyxl.cell.cell import MergedCell

try:
    from docxtpl import DocxTemplate, InlineImage
    from docx.shared import Inches
except ImportError:
    DocxTemplate = None
    InlineImage = None
    Inches = None

try:
    from num2words import num2words
except ImportError:
    num2words = None


# ============================================================================
# CURRENCY & NUMBER FORMATTERS
# ============================================================================

def format_indian_currency(amount):
    if amount is None or amount == "":
        return "₹ 0"
    try:
        val = float(amount)
        is_negative = val < 0
        val = abs(val)

        amount_str = f"{val:.2f}".rstrip('0').rstrip('.')

        if '.' in amount_str:
            integer_part, decimal_part = amount_str.split('.')
            decimal_part = '.' + decimal_part
        else:
            integer_part, decimal_part = amount_str, ''

        if len(integer_part) <= 3:
            formatted_int = integer_part
        else:
            last_three = integer_part[-3:]
            remaining = integer_part[:-3]
            out = []
            while len(remaining) > 2:
                out.append(remaining[-2:])
                remaining = remaining[:-2]
            if remaining:
                out.append(remaining)
            out.reverse()
            formatted_int = ",".join(out) + "," + last_three

        prefix = "-" if is_negative else ""
        return f"₹ {prefix}{formatted_int}{decimal_part}"
    except Exception:
        return f"₹ {amount}"


def amount_to_words(amount):
    if not amount:
        return "Rupees Zero Only"
    try:
        val = float(amount)
        if num2words:
            words = num2words(val, lang='en_IN').title()
            return f"Rupees {words} Only"
        return f"Rupees {val} Only"
    except Exception:
        return f"Rupees {amount} Only"


# ============================================================================
# PDF CONVERSION DRIVERS
# ============================================================================

def convert_batch_win32(conversion_list):
    try:
        import win32com.client
        import pythoncom
        pythoncom.CoInitialize()

        word = win32com.client.DispatchEx("Word.Application")
        word.Visible = False
        word.DisplayAlerts = 0

        successful_pdfs = []

        for docx_path, pdf_path in conversion_list:
            if os.path.exists(docx_path):
                abs_docx = os.path.abspath(docx_path)
                abs_pdf = os.path.abspath(pdf_path)

                doc = word.Documents.Open(abs_docx, ReadOnly=True)
                doc.SaveAs(abs_pdf, FileFormat=17)  # 17 = wdFormatPDF
                doc.Close(0)
                successful_pdfs.append(pdf_path)

        word.Quit()
        return successful_pdfs
    except Exception as e:
        sys.stderr.write(f"Word COM Error: {e}\n")
        return []


def convert_with_libreoffice(input_path, output_path):
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
            subprocess.run(cmd, capture_output=True, timeout=30, text=True)
            gen_pdf = os.path.join(temp_dir, f"{os.path.splitext(os.path.basename(input_path))[0]}.pdf")
            if os.path.exists(gen_pdf) and os.path.getsize(gen_pdf) > 0:
                shutil.copy2(gen_pdf, output_path)
                return True
        except Exception as e:
            sys.stderr.write(f"LibreOffice error: {e}\n")
    return False


def convert_excel_to_pdf(input_path, output_path):
    abs_xlsx = os.path.abspath(input_path)
    abs_pdf = os.path.abspath(output_path)

    if os.name == 'nt':
        try:
            import win32com.client
            import pythoncom
            pythoncom.CoInitialize()

            excel = win32com.client.DispatchEx("Excel.Application")
            excel.Visible = False
            excel.DisplayAlerts = False

            wb = excel.Workbooks.Open(abs_xlsx)
            wb.ExportAsFixedFormat(0, abs_pdf)  # 0 = xlTypePDF
            wb.Close(False)
            excel.Quit()
            if os.path.exists(abs_pdf) and os.path.getsize(abs_pdf) > 0:
                return True
        except Exception as e:
            sys.stderr.write(f"Excel COM error: {e}\n")

    return convert_with_libreoffice(abs_xlsx, abs_pdf)


# ============================================================================
# DOCUMENT RENDERING HELPERS
# ============================================================================

def render_agreement(template_path, output_docx_path, context_data):
    if not os.path.exists(template_path) or not DocxTemplate:
        return None
    doc = DocxTemplate(template_path)

    sig_path = context_data.get("signature_path", "")
    context = {
        "customer_name": context_data.get("customer_name", "Customer"),
        "customer_address": context_data.get("customer_address", ""),
        "date": context_data.get("date_str"),
        "signature": InlineImage(doc, sig_path, width=Inches(2.0)) if sig_path and os.path.exists(sig_path) and InlineImage else ""
    }
    doc.render(context)
    doc.save(output_docx_path)
    return output_docx_path


def render_quotation(template_path, output_docx_path, context_data):
    if not os.path.exists(template_path) or not DocxTemplate:
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
        "total_cost_number": format_indian_currency(cost),
        "total_cost_words": amount_to_words(cost)
    }
    doc.render(context)
    doc.save(output_docx_path)
    return output_docx_path


def render_invoice_docx(template_path, output_docx_path, context_data):
    if not os.path.exists(template_path) or not DocxTemplate:
        return None
    doc = DocxTemplate(template_path)
    total_amt = context_data.get("total_amount", 0)

    context = {
        "invoice_no": context_data.get("invoice_no", ""),
        "sr_no": context_data.get("sr_no", ""),
        "date": context_data.get("date_str"),
        "customer_name": context_data.get("customer_name", "Customer"),
        "customer_address": context_data.get("customer_address", ""),
        "panel_company": context_data.get("panel_company", ""),
        "panel_watt": context_data.get("panel_watt", ""),
        "panel_quantity": context_data.get("panel_quantity", ""),
        "panel_total_cost": format_indian_currency(context_data.get("panel_total_cost", 0)),
        "inverter_company": context_data.get("inverter_company", ""),
        "inverter_watt": context_data.get("inverter_watt", ""),
        "inverter_total_cost": format_indian_currency(context_data.get("inverter_total_cost", 0)),
        "structure_watt": context_data.get("structure_watt", ""),
        "structure_total_cost": format_indian_currency(context_data.get("structure_total_cost", 0)),
        "installation_total_cost": format_indian_currency(context_data.get("installation_total_cost", 0)),
        "total_amount": format_indian_currency(total_amt),
        "total_amount_words": amount_to_words(total_amt)
    }
    doc.render(context)
    doc.save(output_docx_path)
    return output_docx_path


def render_excel_invoice(template_path, output_xlsx_path, context_data):
    wb = openpyxl.load_workbook(template_path)
    sheet = wb.active

    sheet["B9"] = f"Name.: {context_data.get('customer_name', '')}"
    sheet["B10"] = f"Address.: {context_data.get('customer_address', '')}"
    sheet["J9"] = context_data.get("invoice_no", "")
    sheet["J10"] = context_data.get("date_str", "")

    p_watt = context_data.get("panel_watt", "")
    p_comp = context_data.get("panel_company", "")
    p_qty = context_data.get("panel_quantity", "")
    p_cost = float(context_data.get("panel_total_cost", 0) or 0)
    sheet["B13"] = f"SPGS (SOLAR POWER GENERATING SYST {p_watt} WATT {p_comp} SOLAR {p_qty}PS) (25 YEARS GUARANTEE)"
    sheet["J13"] = p_cost

    i_comp = context_data.get("inverter_company", "")
    i_watt = context_data.get("inverter_watt", "")
    i_cost = float(context_data.get("inverter_total_cost", 0) or 0)
    sheet["B14"] = f"ONGRID INVERTER {i_comp} {i_watt}KW (8 YEARS WARRENTY)"
    sheet["J14"] = i_cost

    s_cost = float(context_data.get("structure_total_cost", 0) or 0)
    sheet["J15"] = s_cost

    inst_cost = float(context_data.get("installation_total_cost", 0) or 0)
    include_installation = context_data.get("include_installation", True)

    if include_installation and inst_cost > 0:
        sheet["J16"] = inst_cost
        target_words_cell = "B20"
    else:
        sheet.delete_rows(16, 1)
        target_words_cell = "B19"

    total_amount = context_data.get("total_amount", 0)
    sheet[target_words_cell] = amount_to_words(total_amount)

    wb.save(output_xlsx_path)
    return output_xlsx_path


# ============================================================================
# MAIN PIPELINE
# ============================================================================

def generate_documents(data):
    sr_no = str(data.get("sr_no", "")).strip()
    raw_name = str(data.get("customer_name", "Customer")).strip()
    safe_name = "".join([c for c in raw_name if c.isalnum() or c in (" ", "_", "-")]).strip()

    data["date_str"] = data.get("date") or datetime.today().strftime("%d/%m/%Y")

    # 1. SAFELY GRAB PATHS
    target_dir_raw = data.get("target_dir")
    template_dir_raw = data.get("template_dir")

    # 2. VALIDATE THEY EXIST
    if not target_dir_raw or not template_dir_raw:
        print(json.dumps({
            "success": False, 
            "error": "Missing 'target_dir' or 'template_dir' in JSON payload. Files cannot be saved."
        }))
        return

    target_dir = os.path.abspath(target_dir_raw)
    template_dir = os.path.abspath(template_dir_raw)
    doc_type = data.get("doc_type", "all")

    if not os.path.exists(target_dir):
        os.makedirs(target_dir, exist_ok=True)

    generated_files = {}

    if doc_type == "invoice":
        inv_tpl_xlsx = os.path.join(template_dir, "Invoice_template.xlsx")
        if not os.path.exists(inv_tpl_xlsx):
            inv_tpl_xlsx = os.path.join(template_dir, "invoice_template.xlsx")

        inv_tpl_docx = os.path.join(template_dir, "Invoice_template.docx")
        if not os.path.exists(inv_tpl_docx):
            inv_tpl_docx = os.path.join(template_dir, "invoice_template.docx")

        if os.path.exists(inv_tpl_xlsx):
            inv_xlsx = os.path.join(target_dir, f"{sr_no} {safe_name} Invoice.xlsx")
            inv_pdf = os.path.join(target_dir, f"{sr_no} {safe_name} Invoice.pdf")

            render_excel_invoice(inv_tpl_xlsx, inv_xlsx, data)
            generated_files["invoice_xlsx"] = inv_xlsx

            if convert_excel_to_pdf(inv_xlsx, inv_pdf):
                generated_files["invoice_pdf"] = inv_pdf

        elif os.path.exists(inv_tpl_docx):
            inv_docx = os.path.join(target_dir, f"{sr_no} {safe_name} Invoice.docx")
            inv_pdf = os.path.join(target_dir, f"{sr_no} {safe_name} Invoice.pdf")

            render_invoice_docx(inv_tpl_docx, inv_docx, data)
            generated_files["invoice_docx"] = inv_docx

            converted = []
            if os.name == 'nt':
                converted = convert_batch_win32([(inv_docx, inv_pdf)])
            if not converted and os.path.exists(inv_docx):
                if convert_with_libreoffice(inv_docx, inv_pdf):
                    converted.append(inv_pdf)

            if inv_pdf in converted:
                generated_files["invoice_pdf"] = inv_pdf
        else:
            print(json.dumps({"success": False, "error": f"Invoice Template missing in {template_dir}"}))
            return

    else:
        agr_tpl = os.path.join(template_dir, "Agrement_template.docx")
        if not os.path.exists(agr_tpl):
            agr_tpl = os.path.join(template_dir, "agreement_template.docx")

        agr_docx = os.path.join(target_dir, f"{sr_no} {safe_name} Agrement.docx")
        agr_pdf = os.path.join(target_dir, f"{sr_no} {safe_name} Agrement.pdf")

        quo_tpl = os.path.join(template_dir, "Quotation_template.docx")
        if not os.path.exists(quo_tpl):
            quo_tpl = os.path.join(template_dir, "quotation_template.docx")

        quo_docx = os.path.join(target_dir, f"{sr_no} {safe_name} Quotation.docx")
        quo_pdf = os.path.join(target_dir, f"{sr_no} {safe_name} Quotation.pdf")

        with ThreadPoolExecutor(max_workers=2) as executor:
            f1 = executor.submit(render_agreement, agr_tpl, agr_docx, data)
            f2 = executor.submit(render_quotation, quo_tpl, quo_docx, data)
            f1.result()
            f2.result()

        generated_files["agreement_docx"] = agr_docx
        generated_files["quotation_docx"] = quo_docx

        conversions_to_run = [(agr_docx, agr_pdf), (quo_docx, quo_pdf)]
        converted_pdfs = []

        if os.name == 'nt':
            converted_pdfs = convert_batch_win32(conversions_to_run)

        if len(converted_pdfs) < len(conversions_to_run):
            for docx, pdf in conversions_to_run:
                if pdf not in converted_pdfs and os.path.exists(docx):
                    if convert_with_libreoffice(docx, pdf):
                        converted_pdfs.append(pdf)

        if agr_pdf in converted_pdfs:
            generated_files["agreement_pdf"] = agr_pdf
        if quo_pdf in converted_pdfs:
            generated_files["quotation_pdf"] = quo_pdf

    print(json.dumps({"success": True, "files": generated_files, "saved_to": target_dir}))

if __name__ == "__main__":
    try:
        raw_input = sys.stdin.read().strip()
        if raw_input:
            payload = json.loads(raw_input)
            generate_documents(payload)
        else:
            print(json.dumps({"success": False, "error": "No JSON payload provided in stdin"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)