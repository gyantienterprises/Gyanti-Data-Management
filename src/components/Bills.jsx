import { useState, useEffect } from "react";
import {
  UserCheck,
  Receipt,
  Wrench,
  ShieldCheck,
  Zap,
  Cpu,
  Layers,
  FileText,
  CheckCircle,
  Loader2,
} from "lucide-react";

const COMPANY_OPTIONS = [
  "UTL/Fujiyama",
  "Waaree",
  "Luminous",
  "Adani",
  "Tata",
  "Eastman",
  "Microtech",
  "Livguard",
];

export default function InvoiceSection() {
  const [customersList, setCustomersList] = useState([]);
  const [selectedSrNo, setSelectedSrNo] = useState("");
  const [includeInstallation, setIncludeInstallation] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [billData, setBillData] = useState({
    invoice_no: "",
    sr_no: "",
    name: "",
    address: "",
    kw: "",

    panel_company: COMPANY_OPTIONS[0],
    panel_watt: "",
    panel_quantity: "",
    panel_total_cost: "",

    inverter_company: COMPANY_OPTIONS[0],
    inverter_watt: "",
    inverter_total_cost: "",

    structure_watt: "",
    structure_total_cost: "",

    installation_total_cost: "",
  });

  useEffect(() => {
    fetchCustomers();
    fetchNextInvoiceNo();
  }, []);

  const fetchNextInvoiceNo = () => {
    if (window.require) {
      try {
        const { ipcRenderer } = window.require("electron");
        const response = ipcRenderer.sendSync("get-next-invoice-no");
        if (response && response.success) {
          setBillData((prev) => ({
            ...prev,
            invoice_no: response.nextInvoiceNo,
          }));
        }
      } catch (err) {
        console.error("Failed to load next invoice number:", err);
      }
    }
  };

  const fetchCustomers = () => {
    if (window.require) {
      try {
        const { ipcRenderer } = window.require("electron");
        const response = ipcRenderer.sendSync("get-all-customers");
        if (response && response.success) {
          setCustomersList(response.customers || []);
        }
      } catch (err) {
        console.error("Failed to load customers:", err);
      }
    }
  };

  const handleSelectCustomer = (e) => {
    const srNo = e.target.value;
    setSelectedSrNo(srNo);

    if (!srNo) {
      setBillData((prev) => ({
        ...prev,
        sr_no: "",
        name: "",
        address: "",
        kw: "",
        panel_company: COMPANY_OPTIONS[0],
        panel_watt: "",
        panel_quantity: "",
        panel_total_cost: "",
        inverter_company: COMPANY_OPTIONS[0],
        inverter_watt: "",
        inverter_total_cost: "",
        structure_watt: "",
        structure_total_cost: "",
        installation_total_cost: "",
      }));
      return;
    }

    const matchedClient = customersList.find(
      (c) => String(c.sr_no) === String(srNo),
    );

    if (matchedClient) {
      setBillData((prev) => ({
        ...prev,
        sr_no: matchedClient.sr_no || "",
        name: matchedClient.name || "",
        address: matchedClient.address || "",
        kw: matchedClient.kw || "",
        panel_company: matchedClient.panel_company || COMPANY_OPTIONS[0],
        panel_watt: matchedClient.panel_watt || "",
        panel_quantity: matchedClient.panel_quantity || "",
        inverter_company: matchedClient.inverter_company || COMPANY_OPTIONS[0],
        inverter_watt: matchedClient.inverter_watt || "",
        structure_watt: matchedClient.structure_watt || "",

        panel_total_cost: "",
        inverter_total_cost: "",
        structure_total_cost: "",
        installation_total_cost: "",
      }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBillData((prev) => ({ ...prev, [name]: value }));
  };

  const calculateTotalInvoiceCost = () => {
    const pCost = parseFloat(billData.panel_total_cost) || 0;
    const iCost = parseFloat(billData.inverter_total_cost) || 0;
    const sCost = parseFloat(billData.structure_total_cost) || 0;
    const instCost = includeInstallation
      ? parseFloat(billData.installation_total_cost) || 0
      : 0;

    return pCost + iCost + sCost + instCost;
  };

  const handleMakeInvoice = async () => {
    if (!billData.sr_no || !billData.name) {
      alert("Please select a valid customer first.");
      return;
    }

    setIsSubmitting(true);

    if (window.require) {
      try {
        const { ipcRenderer } = window.require("electron");
        const payload = {
          ...billData,
          customer_name: billData.name,
          customer_address: billData.address,
          include_installation: includeInstallation,
          installation_total_cost: includeInstallation
            ? billData.installation_total_cost
            : "0",
          total_amount: calculateTotalInvoiceCost(),
        };

        const result = await ipcRenderer.invoke("create-invoice", payload);

        if (result && result.success) {
          alert("Invoice created and saved successfully!");
          fetchNextInvoiceNo();
        } else {
          alert(
            "Error generating invoice: " + (result?.error || "Unknown error"),
          );
        }
      } catch (err) {
        console.error("IPC invocation error:", err);
        alert("Failed to create invoice.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full max-h-screen flex flex-col justify-between p-6 bg-[#0B0F19] text-white overflow-y-auto">
      <div className="space-y-4">
        {/* Header & Customer Selection Top Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Receipt className="text-amber-500 w-7 h-7" /> GENERATE INVOICE
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Select customer record to pre-fill parameters. All fields remain
              editable.
            </p>
          </div>

          <div className="min-w-[340px]">
            <select
              value={selectedSrNo}
              onChange={handleSelectCustomer}
              className="w-full p-2.5 bg-[#131A2B] border border-amber-500/40 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="">-- Select Existing Customer --</option>
              {customersList.map((client) => (
                <option key={client.id || client.sr_no} value={client.sr_no}>
                  SR #{client.sr_no} - {client.name} ({client.kw || "0"} KW)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Client Info Bar */}
        <div className="bg-[#131A2B] border border-slate-800 px-5 py-4 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-500 uppercase tracking-wider">
            <UserCheck className="w-4 h-4" /> Client & Invoice Details
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-amber-400 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> Invoice No
              </label>
              <input
                type="text"
                name="invoice_no"
                value={billData.invoice_no}
                onChange={handleInputChange}
                className="w-full p-2 bg-[#0F1423] border border-amber-500/60 rounded-lg text-sm text-amber-300 font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Sr No
              </label>
              <input
                type="text"
                name="sr_no"
                value={billData.sr_no}
                onChange={handleInputChange}
                className="w-full p-2 bg-[#0F1423] border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Name
              </label>
              <input
                type="text"
                name="name"
                value={billData.name}
                onChange={handleInputChange}
                className="w-full p-2 bg-[#0F1423] border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Address
              </label>
              <input
                type="text"
                name="address"
                value={billData.address}
                onChange={handleInputChange}
                className="w-full p-2 bg-[#0F1423] border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Capacity (KW)
              </label>
              <input
                type="text"
                name="kw"
                value={billData.kw}
                onChange={handleInputChange}
                className="w-full p-2 bg-[#0F1423] border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* 2-Column Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Panel Info Card */}
          <div className="bg-[#131A2B] border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
              <Zap className="w-4 h-4 text-amber-500" /> Panel Specifications
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Company
                </label>
                <select
                  name="panel_company"
                  value={billData.panel_company}
                  onChange={handleInputChange}
                  className="w-full p-2 bg-[#0F1423] border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  {COMPANY_OPTIONS.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Wattage
                </label>
                <input
                  type="text"
                  name="panel_watt"
                  value={billData.panel_watt}
                  onChange={handleInputChange}
                  className="w-full p-2 bg-[#0F1423] border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Quantity
                </label>
                <input
                  type="text"
                  name="panel_quantity"
                  value={billData.panel_quantity}
                  onChange={handleInputChange}
                  className="w-full p-2 bg-[#0F1423] border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-amber-400 mb-1">
                  Panel Total Cost (₹)
                </label>
                <input
                  type="number"
                  name="panel_total_cost"
                  value={billData.panel_total_cost}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  className="w-full p-2 bg-[#0F1423] border border-amber-500/50 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Inverter Info Card */}
          <div className="bg-[#131A2B] border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
              <Cpu className="w-4 h-4 text-amber-500" /> Inverter Specifications
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Company
                </label>
                <select
                  name="inverter_company"
                  value={billData.inverter_company}
                  onChange={handleInputChange}
                  className="w-full p-2 bg-[#0F1423] border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  {COMPANY_OPTIONS.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Wattage
                </label>
                <input
                  type="text"
                  name="inverter_watt"
                  value={billData.inverter_watt}
                  onChange={handleInputChange}
                  className="w-full p-2 bg-[#0F1423] border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-amber-400 mb-1">
                  Inverter Total Cost (₹)
                </label>
                <input
                  type="number"
                  name="inverter_total_cost"
                  value={billData.inverter_total_cost}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  className="w-full p-2 bg-[#0F1423] border border-amber-500/50 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Structure Info Card */}
          <div className="bg-[#131A2B] border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
              <Layers className="w-4 h-4 text-amber-500" /> Structure Details
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Wattage
                </label>
                <input
                  type="text"
                  name="structure_watt"
                  value={billData.structure_watt}
                  onChange={handleInputChange}
                  className="w-full p-2 bg-[#0F1423] border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-amber-400 mb-1">
                  Structure Cost (₹)
                </label>
                <input
                  type="number"
                  name="structure_total_cost"
                  value={billData.structure_total_cost}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  className="w-full p-2 bg-[#0F1423] border border-amber-500/50 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Installation Info Card */}
          <div className="bg-[#131A2B] border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Wrench className="w-4 h-4 text-amber-500" /> Installation
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-amber-400">
                <input
                  type="checkbox"
                  checked={includeInstallation}
                  onChange={(e) => setIncludeInstallation(e.target.checked)}
                  className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer"
                />
                Include Cost
              </label>
            </div>

            {includeInstallation ? (
              <div>
                <label className="block text-xs font-semibold text-amber-400 mb-1">
                  Installation Cost (₹)
                </label>
                <input
                  type="number"
                  name="installation_total_cost"
                  value={billData.installation_total_cost}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  className="w-full p-2 bg-[#0F1423] border border-amber-500/50 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic pt-2">
                Installation cost excluded.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Summary Bar */}
      <div className="mt-4 bg-[#131A2B] border-2 border-amber-500/40 px-5 py-3 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            Total Invoice Amount
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-2xl font-black text-amber-400">
            ₹{" "}
            {calculateTotalInvoiceCost().toLocaleString("en-IN", {
              minimumFractionDigits: 2,
            })}
          </div>

          <button
            onClick={handleMakeInvoice}
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold px-6 py-2.5 rounded-lg shadow-md hover:shadow-amber-500/20 transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            Make Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
