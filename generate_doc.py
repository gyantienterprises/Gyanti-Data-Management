import sys
import json
import os
from datetime import datetime
from docxtpl import DocxTemplate, InlineImage
from docx.shared import Inches

try:
    from num2words import num2words
except ImportError:
    num2words = None

def amount_to_words(amount):
    """Converts a numeric cost to words in Indian currency format."""
    if not amount:
        return ""
    try:
        val = float(amount)
        if num2words:
            words = num2words(val, lang='en_IN').title()
            return f"{words} Only"
        return str(val)
    except Exception:
        return str(amount)

def generate_documents(data):
    # Extract common fields
    sr_no = data.get("sr_no", "")
    name = data.get("customer_name", "Customer")
    address = data.get("customer_address", "")
    date_str = data.get("date") or datetime.today().strftime("%B %d, %Y")
    signature_path = data.get("signature_path", "")
    
    # Extract technical specs for quotation
    kw = data.get("kw", "")
    panel_company = data.get("panel_company", "")
    panel_watt = data.get("panel_watt", "")
    panel_quantity = data.get("panel_quantity", "")
    inverter_company = data.get("inverter_company", "")
    inverter_watt = data.get("inverter_watt", "")
    structure_watt = data.get("structure_watt", "")
    cost = data.get("cost", 0)

    # Output Directory & Template Paths
    target_dir = data.get("target_dir")
    template_dir = data.get("template_dir")

    # 1. Generate Agreement Document
    agreement_template_path = os.path.join(template_dir, "Agrement_template.docx")
    agreement_output_path = os.path.join(target_dir, f"{sr_no} {name} Agrement.docx")

    if os.path.exists(agreement_template_path):
        doc_agreement = DocxTemplate(agreement_template_path)
        agreement_context = {
            "customer_name": name,
            "customer_address": address,
            "date": date_str,
        }
        if signature_path and os.path.exists(signature_path):
            agreement_context["signature"] = InlineImage(doc_agreement, signature_path, width=Inches(2.0))
        else:
            agreement_context["signature"] = ""

        doc_agreement.render(agreement_context)
        doc_agreement.save(agreement_output_path)

    # 2. Generate Quotation Document
    quotation_template_path = os.path.join(template_dir, "Quotation_template.docx")
    quotation_output_path = os.path.join(target_dir, f"{sr_no} {name} Quotation.docx")

    if os.path.exists(quotation_template_path):
        doc_quotation = DocxTemplate(quotation_template_path)
        quotation_context = {
            "sr_no": sr_no,
            "date": date_str,
            "customer_name": name,
            "kw": kw,
            "solar_panel_brand": panel_company,
            "solar_panel_watt": panel_watt,
            "solar_panel_pcs": panel_quantity,
            "inverter_brand": inverter_company,
            "inverter_kw": inverter_watt,
            "structure_kw": structure_watt,
            "total_cost_number": f"₹ {cost:,}" if isinstance(cost, (int, float)) else f"₹ {cost}",
            "total_cost_words": amount_to_words(cost)
        }

        doc_quotation.render(quotation_context)
        doc_quotation.save(quotation_output_path)

    print(json.dumps({
        "success": True, 
        "agreement": agreement_output_path, 
        "quotation": quotation_output_path
    }))

if __name__ == "__main__":
    try:
        # Read JSON directly from standard input stream
        raw_input = sys.stdin.read()
        if raw_input.strip():
            payload = json.loads(raw_input)
            generate_documents(payload)
        else:
            print(json.dumps({"success": False, "error": "No JSON payload provided in stdin"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)