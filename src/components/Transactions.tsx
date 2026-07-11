import React, { useState } from "react";
import { Transaction, Item, Permission } from "../types";
import { 
  db, 
  collection, 
  addDoc, 
  doc, 
  updateDoc 
} from "../firebase";
import { logAudit, formatNPR, calculateItemMetrics } from "../utils";
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Filter, 
  X, 
  FileText,
  Calendar,
  AlertTriangle,
  BadgeAlert
} from "lucide-react";

interface TransactionsProps {
  transactions: Transaction[];
  items: Item[];
  user: any;
  userProfile: any;
  permissions: Permission;
}

export default function Transactions({ transactions, items, user, userProfile, permissions }: TransactionsProps) {
  const [showForm, setShowForm] = useState(false);
  const [txType, setTxType] = useState<"STOCK_IN" | "STOCK_OUT">("STOCK_IN");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterItemId, setFilterItemId] = useState("");

  // Form Fields
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [rate, setRate] = useState(0);
  const [total, setTotal] = useState(0);
  
  // STOCK_IN Fields
  const [supplier, setSupplier] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [billNo, setBillNo] = useState("");

  // STOCK_OUT Fields
  const [purpose, setPurpose] = useState<"Production" | "Damage" | "Transfer" | "Other">("Production");
  const [batchId, setBatchId] = useState("");
  const [notes, setNotes] = useState("");

  const activeItem = items.find((i) => i.id === itemId);

  // Sync Rate and Total when Item or Quantity changes
  const handleItemChange = (selectedId: string) => {
    setItemId(selectedId);
    const item = items.find((i) => i.id === selectedId);
    if (item) {
      setRate(item.cost);
      setTotal(quantity * item.cost);
      if (txType === "STOCK_IN") {
        setSupplier(item.supplier || "");
      }
    }
  };

  const handleQtyChange = (qty: number) => {
    setQuantity(qty);
    setTotal(qty * rate);
  };

  const handleRateChange = (r: number) => {
    setRate(r);
    setTotal(quantity * r);
  };

  const handleResetForm = () => {
    setItemId("");
    setQuantity(0);
    setRate(0);
    setTotal(0);
    setSupplier("");
    setVehicleNo("");
    setBillNo("");
    setPurpose("Production");
    setBatchId("");
    setNotes("");
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.create) return;

    if (quantity <= 0 || rate <= 0) {
      alert("Quantity and Rate must be positive numbers.");
      return;
    }

    // If Stock Out, double check current stock
    if (txType === "STOCK_OUT" && activeItem) {
      const metrics = calculateItemMetrics(activeItem, transactions);
      if (metrics.closingStock < quantity) {
        const proceed = confirm(
          `Warning: Current Stock level is ${metrics.closingStock} ${activeItem.unit}. You are issuing ${quantity} ${activeItem.unit}. This will result in negative inventory. Do you still want to proceed?`
        );
        if (!proceed) return;
      }
    }

    try {
      const payload: Omit<Transaction, "id"> = {
        date,
        type: txType,
        itemId,
        quantity: Number(quantity),
        rate: Number(rate),
        total: Number(total),
        supplier: txType === "STOCK_IN" ? supplier.trim() : undefined,
        vehicleNo: txType === "STOCK_IN" ? vehicleNo.trim() : undefined,
        billNo: txType === "STOCK_IN" ? billNo.trim() : undefined,
        purpose: txType === "STOCK_OUT" ? purpose : undefined,
        batchId: txType === "STOCK_OUT" ? batchId.trim() : undefined,
        notes: notes.trim() || undefined,
        createdBy: user.uid,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, "transactions"), payload);

      // Optionally update item unit cost in Item Master if Purchase Rate changed (Average costing)
      if (txType === "STOCK_IN" && activeItem && Number(rate) !== activeItem.cost) {
        // Simple update: update the cost of item to the latest purchase rate
        const itemRef = doc(db, "items", itemId);
        await updateDoc(itemRef, {
          cost: Number(rate),
          updatedAt: new Date().toISOString()
        });
      }

      await logAudit(
        user.uid,
        user.email,
        txType,
        `Recorded ${txType} of ${quantity} ${activeItem?.unit} of ${activeItem?.name} @ NPR ${rate}. Total: NPR ${total}`,
        docRef.id,
        "transaction"
      );

      handleResetForm();
    } catch (error) {
      console.error("Error creating transaction:", error);
    }
  };

  // Filter Transactions
  const filteredTxs = transactions.filter((tx) => {
    const item = items.find((i) => i.id === tx.itemId);
    const itemName = item?.name || "";
    
    const matchesSearch = itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          tx.supplier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          tx.billNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          tx.batchId?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = filterType === "" || tx.type === filterType;
    const matchesItem = filterItemId === "" || tx.itemId === filterItemId;

    return matchesSearch && matchesType && matchesItem;
  });

  // Sort by date then created time descending
  filteredTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div id="transactions-module" className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Ledger Operations</h2>
          <p className="text-xs text-slate-400">Record inventory arrivals (Stock In) and issue materials (Stock Out) for production, damage, or transfer</p>
        </div>
        {permissions.create && !showForm && (
          <div className="flex gap-2">
            <button
              id="stock-in-btn"
              onClick={() => { setTxType("STOCK_IN"); setShowForm(true); }}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md transition"
            >
              <ArrowUpRight className="w-4 h-4" />
              Stock In (Purchase)
            </button>
            <button
              id="stock-out-btn"
              onClick={() => { setTxType("STOCK_OUT"); setShowForm(true); }}
              className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md transition"
            >
              <ArrowDownLeft className="w-4 h-4" />
              Stock Out (Issue)
            </button>
          </div>
        )}
      </div>

      {/* Transaction Form Card */}
      {showForm && (
        <div id="tx-form-card" className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex justify-between items-center pb-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              {txType === "STOCK_IN" ? (
                <>
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  <span>Record STOCK IN (Material Purchase / Receipt)</span>
                </>
              ) : (
                <>
                  <ArrowDownLeft className="w-4 h-4 text-red-400" />
                  <span>Record STOCK OUT (Material Consumption / Issue)</span>
                </>
              )}
            </h3>
            <button 
              onClick={handleResetForm} 
              className="text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              {/* Date */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Transaction Date <span className="text-emerald-400">*</span></label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-10 pr-3 text-sm text-white"
                  />
                </div>
              </div>

              {/* Item Selection */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-medium text-slate-300">Select Item <span className="text-emerald-400">*</span></label>
                <select
                  required
                  value={itemId}
                  onChange={(e) => handleItemChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white"
                >
                  <option value="">-- Choose Inventory Item --</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} - Cost: NPR {i.cost}/{i.unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit display */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Measurement Unit</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={activeItem?.unit || "Select Item"}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-500"
                />
              </div>

              {/* Quantity */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Quantity <span className="text-emerald-400">*</span></label>
                <input
                  type="number"
                  required
                  min="0.001"
                  step="any"
                  value={quantity || ""}
                  onChange={(e) => handleQtyChange(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:outline-none"
                />
              </div>

              {/* Rate */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Purchase Rate (NPR ₹) <span className="text-emerald-400">*</span></label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  value={rate || ""}
                  onChange={(e) => handleRateChange(Number(e.target.value))}
                  placeholder="Rate per unit"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:outline-none"
                />
              </div>

              {/* Total display */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-medium text-slate-400">Calculated Total</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={formatNPR(total)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm font-semibold text-emerald-400"
                />
              </div>
            </div>

            {/* TYPE-SPECIFIC FIELDS */}
            {txType === "STOCK_IN" ? (
              /* Stock In Purchase fields */
              <div className="bg-slate-900/40 p-4 border border-slate-750 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Supplier Name</label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="e.g. Purina Agro Corp"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Vehicle No.</label>
                  <input
                    type="text"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                    placeholder="e.g. BA 2 KHA 4050"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Gate Pass / Bill No.</label>
                  <input
                    type="text"
                    value={billNo}
                    onChange={(e) => setBillNo(e.target.value)}
                    placeholder="e.g. BILL-9402"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white"
                  />
                </div>
              </div>
            ) : (
              /* Stock Out Consumption fields */
              <div className="bg-slate-900/40 p-4 border border-slate-750 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Issue Purpose</label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white"
                  >
                    <option value="Production">Production Consumption</option>
                    <option value="Damage">Wastage / Damage</option>
                    <option value="Transfer">Inter-Warehouse Transfer</option>
                    <option value="Other">Other / Experimental</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Batch ID (For production tracing)</label>
                  <input
                    type="text"
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    placeholder="e.g. BATCH-2026-07A"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Log Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter short details..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white"
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <button
                type="button"
                onClick={handleResetForm}
                className="border border-slate-700 text-slate-300 hover:bg-slate-750 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-5 py-2 rounded-lg text-xs font-bold cursor-pointer transition shadow-md ${
                  txType === "STOCK_IN"
                    ? "bg-emerald-500 hover:bg-emerald-600 text-slate-950"
                    : "bg-red-500 hover:bg-red-600 text-white"
                }`}
              >
                {txType === "STOCK_IN" ? "Record Stock In" : "Record Stock Out"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTER AND SEARCH BAR */}
      <div id="tx-filters" className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by supplier, bill, batch, or notes..."
            className="w-full bg-slate-950 border border-slate-750 rounded-lg py-1.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Type / Item Filter */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          
          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-750 rounded-lg px-2 py-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer border-none py-0"
            >
              <option value="">All Transactions</option>
              <option value="STOCK_IN">🟢 STOCK IN</option>
              <option value="STOCK_OUT">🔴 STOCK OUT</option>
            </select>
          </div>

          {/* Item Filter */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-750 rounded-lg px-2 py-1">
            <select
              value={filterItemId}
              onChange={(e) => setFilterItemId(e.target.value)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer border-none py-0 max-w-[150px]"
            >
              <option value="">All Materials</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TRANSACTION HISTORY LIST */}
      <div id="tx-table-wrapper" className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-sans">
            <thead className="bg-slate-900/60 text-slate-400 font-mono border-b border-slate-700">
              <tr>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider">Date</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider">Type</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider">Item / Material</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Quantity</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Rate</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Total NPR</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider">Logistics / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {filteredTxs.map((tx) => {
                const item = items.find((i) => i.id === tx.itemId);
                return (
                  <tr key={tx.id} className="hover:bg-slate-750/30 transition">
                    <td className="py-3 px-4 font-mono font-medium text-slate-300">
                      {tx.date}
                    </td>
                    <td className="py-3 px-4">
                      {tx.type === "STOCK_IN" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          <ArrowUpRight className="w-3 h-3" /> STOCK IN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-400">
                          <ArrowDownLeft className="w-3 h-3" /> STOCK OUT
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{item?.name || "Deleted Item"}</div>
                      <span className="text-[10px] text-slate-500 font-mono">ID: {tx.itemId.slice(0, 8)}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold font-mono text-white">
                      {tx.quantity.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{item?.unit}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      {formatNPR(tx.rate)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold font-mono text-white">
                      {formatNPR(tx.total)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400 max-w-xs">
                      {tx.type === "STOCK_IN" ? (
                        <div className="space-y-0.5">
                          {tx.supplier && <div className="truncate font-semibold text-slate-300">Supplier: {tx.supplier}</div>}
                          <div className="text-[10px] text-slate-500 font-mono">
                            {tx.billNo && `Bill: ${tx.billNo}`} {tx.vehicleNo && `| Veh: ${tx.vehicleNo}`}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-300">Purpose: {tx.purpose || "Consumption"}</div>
                          {tx.batchId && <div className="text-[10px] text-emerald-400 font-mono">Batch: {tx.batchId}</div>}
                          {tx.notes && <div className="text-[10px] text-slate-500 italic">Notes: {tx.notes}</div>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredTxs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                    <h5 className="font-semibold text-slate-300">No transaction logs recorded yet</h5>
                    <p className="text-xs text-slate-500 mt-0.5">Record incoming purchases or consumptions above.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
