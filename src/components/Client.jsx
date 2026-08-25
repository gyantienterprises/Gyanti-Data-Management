import React, { useState, useEffect } from "react";

const { ipcRenderer } = window.require ? window.require("electron") : {};

export default function Client() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [clientFilesMap, setClientFilesMap] = useState({});
  const [editingClient, setEditingClient] = useState(null);

  const loadCustomers = () => {
    if (ipcRenderer) {
      const res = ipcRenderer.sendSync("get-all-customers");
      if (res.success) {
        setCustomers(res.customers);
      }
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const toggleRow = (client) => {
    if (expandedRowId === client.id) {
      setExpandedRowId(null);
    } else {
      setExpandedRowId(client.id);

      if (ipcRenderer && !clientFilesMap[client.id]) {
        const fileRes = ipcRenderer.sendSync("get-client-files", {
          sr_no: client.sr_no,
          name: client.name,
        });

        if (fileRes.success) {
          setClientFilesMap((prev) => ({
            ...prev,
            [client.id]: fileRes.files,
          }));
        }
      }
    }
  };

  const handleOpenFile = (filePath) => {
    if (ipcRenderer) {
      ipcRenderer.sendSync("open-file", filePath);
    }
  };

  const handleDelete = (customer, e) => {
    e.stopPropagation();
    if (
      window.confirm(
        `Are you sure you want to delete ${customer.name} (SR NO: ${customer.sr_no})?`,
      )
    ) {
      if (ipcRenderer) {
        const res = ipcRenderer.sendSync("delete-customer", {
          id: customer.id,
          sr_no: customer.sr_no,
          name: customer.name,
        });

        if (res.success) {
          loadCustomers();
        } else {
          alert("Failed to delete client: " + res.error);
        }
      }
    }
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (ipcRenderer && editingClient) {
      const res = ipcRenderer.sendSync("update-customer", editingClient);
      if (res.success) {
        setEditingClient(null);
        loadCustomers();
      } else {
        alert("Failed to update client: " + res.error);
      }
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      String(c.sr_no).includes(search),
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="bg-[#111827] border border-gray-800 p-6 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">
            Client Directory
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Click on any client row to view PDFs, signatures, and installation
            details.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search SR No or Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-gray-900 border border-gray-700/80 text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Client List Table */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs font-semibold uppercase tracking-wider bg-gray-900/60">
                <th className="py-4 px-6">SR NO</th>
                <th className="py-4 px-6">Client Name</th>
                <th className="py-4 px-6">KW Capacity</th>
                <th className="py-4 px-6">Bill Date</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 text-sm">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((client) => {
                  const isExpanded = expandedRowId === client.id;
                  const clientFiles = clientFilesMap[client.id] || [];
                  const signatureFile = clientFiles.find((f) => f.isSignature);

                  // Only include PDF files (filters out .docx entirely)
                  const pdfFiles = clientFiles.filter((f) => f.isPDF);

                  return (
                    <React.Fragment key={client.id}>
                      {/* Interactive Row */}
                      <tr
                        onClick={() => toggleRow(client)}
                        className={`cursor-pointer transition-colors duration-150 ${
                          isExpanded ? "bg-blue-950/20" : "hover:bg-gray-800/40"
                        }`}
                      >
                        <td className="py-4 px-6 font-mono font-semibold text-blue-400">
                          <span className="bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1.5">
                            <span>{isExpanded ? "▼" : "▶"}</span>
                            <span>#{client.sr_no}</span>
                          </span>
                        </td>
                        <td className="py-4 px-6 font-medium text-gray-100">
                          {client.name}
                        </td>
                        <td className="py-4 px-6 text-gray-300">
                          {client.kw ? (
                            <span className="font-semibold text-amber-400">
                              {client.kw}{" "}
                              <span className="text-xs text-amber-500/80">
                                KW
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-500 italic">N/A</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {client.bill_date ? (
                            <span className="text-gray-300">
                              {client.bill_date}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-400 border border-gray-700">
                              None
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingClient(client);
                            }}
                            className="px-3 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 rounded-lg text-xs font-medium transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => handleDelete(client, e)}
                            className="px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/30 rounded-lg text-xs font-medium transition-all"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Details Pane */}
                      {isExpanded && (
                        <tr className="bg-gray-900/40">
                          <td
                            colSpan="5"
                            className="p-6 border-b border-gray-800"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* 1. Hardware Specs */}
                              <div className="space-y-3 bg-gray-900/80 p-4 rounded-xl border border-gray-800">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 border-b border-gray-800 pb-2">
                                  System & Installation Specs
                                </h4>
                                <div className="space-y-1.5 text-xs text-gray-300">
                                  <p>
                                    <span className="text-gray-500">
                                      Address:
                                    </span>{" "}
                                    {client.address || "N/A"}
                                  </p>
                                  <p>
                                    <span className="text-gray-500">
                                      Total Cost:
                                    </span>{" "}
                                    <span className="text-green-400 font-semibold">
                                      {client.cost ? `₹${client.cost}` : "N/A"}
                                    </span>
                                  </p>
                                  <p>
                                    <span className="text-gray-500">
                                      Panel Brand:
                                    </span>{" "}
                                    {client.panel_company || "N/A"} (
                                    {client.panel_watt || 0}W x{" "}
                                    {client.panel_quantity || 0})
                                  </p>
                                  <p>
                                    <span className="text-gray-500">
                                      Inverter Brand:
                                    </span>{" "}
                                    {client.inverter_company || "N/A"} (
                                    {client.inverter_watt || 0}W)
                                  </p>
                                  <p>
                                    <span className="text-gray-500">
                                      Structure Watt:
                                    </span>{" "}
                                    {client.structure_watt || "N/A"}
                                  </p>
                                </div>
                              </div>

                              {/* 2. PDF Documents ONLY */}
                              <div className="space-y-3 bg-gray-900/80 p-4 rounded-xl border border-gray-800">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 border-b border-gray-800 pb-2">
                                  PDF Documents
                                </h4>
                                {pdfFiles.length > 0 ? (
                                  <div className="space-y-2">
                                    {pdfFiles.map((file, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between bg-gray-800/60 p-2 rounded-lg text-xs border border-gray-700/50"
                                      >
                                        <span
                                          className="truncate max-w-[170px] text-gray-200 font-medium"
                                          title={file.name}
                                        >
                                          📄 {file.name}
                                        </span>
                                        <button
                                          onClick={() =>
                                            handleOpenFile(file.path)
                                          }
                                          className="px-2.5 py-1 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/30 rounded text-[11px] font-medium transition-colors"
                                        >
                                          Open PDF
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-500 italic">
                                    No PDF files found in folder.
                                  </p>
                                )}
                              </div>

                              {/* 3. Base64 Rendered Signature */}
                              <div className="space-y-3 bg-gray-900/80 p-4 rounded-xl border border-gray-800">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 border-b border-gray-800 pb-2">
                                  Saved Signature
                                </h4>
                                {signatureFile && signatureFile.fileUrl ? (
                                  <div className="bg-white p-2 rounded-lg flex items-center justify-center border border-gray-700 shadow-inner min-h-[90px]">
                                    <img
                                      src={signatureFile.fileUrl}
                                      alt="Customer Signature"
                                      className="max-h-24 object-contain"
                                    />
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-500 italic">
                                    No signature file found.
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="5"
                    className="py-12 text-center text-gray-500 text-sm"
                  >
                    No client records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-gray-700 p-6 rounded-2xl max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white">
                Edit Client{" "}
                <span className="text-blue-400">#{editingClient.sr_no}</span>
              </h3>
              <button
                onClick={() => setEditingClient(null)}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Client Name
                </label>
                <input
                  type="text"
                  value={editingClient.name || ""}
                  onChange={(e) =>
                    setEditingClient({ ...editingClient, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={editingClient.address || ""}
                  onChange={(e) =>
                    setEditingClient({
                      ...editingClient,
                      address: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  KW Capacity
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={editingClient.kw || ""}
                  onChange={(e) =>
                    setEditingClient({ ...editingClient, kw: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
