import React, { useState } from "react";
import { Item, Category, Transaction, Production, Permission } from "../types";
import { formatNPR, calculateItemMetrics } from "../utils";
import { 
  FileText, 
  Download, 
  Printer, 
  TrendingDown, 
  ShoppingBag, 
  Flame, 
  BarChart4, 
  CheckSquare, 
  Database,
  Calendar,
  Layers,
  ArrowRight
} from "lucide-react";

interface ReportsProps {
  items: Item[];
  categories: Category[];
  transactions: Transaction[];
  productions: Production[];
  permissions: Permission;
}

type ReportType = "stock" | "consumption" | "production" | "purchase" | "low_stock";

export default function Reports({ items, categories, transactions, productions, permissions }: ReportsProps) {
  const [activeReport, setActiveReport] = useState<ReportType>("stock");
  
  // Filtering state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedCategory, setSelectedCategory] = useState("");

  const handleDownloadCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    let filename = `Report_${activeReport}_${new Date().toISOString().split("T")[0]}.csv`;

    if (activeReport === "stock") {
      csvContent += "Item ID,Item Name,Category,Subcategory,Closing Stock,Unit,Cost Rate (NPR),Total Stock Value (NPR),Status\n";
      items.forEach((item) => {
        const metrics = calculateItemMetrics(item, transactions);
        const cat = categories.find((c) => c.id === item.categoryId)?.name || "Unknown";
        csvContent += `"${item.id}","${item.name}","${cat}","${item.subcategory || ""}","${metrics.closingStock}","${item.unit}","${item.cost}","${metrics.closingStock * item.cost}","${metrics.status}"\n`;
      });
    } else if (activeReport === "consumption") {
      csvContent += "Date,Item Name,Quantity Consumed,Unit,Rate (NPR),Total Cost (NPR),Purpose,Batch ID,Notes\n";
      transactions
        .filter((tx) => tx.type === "STOCK_OUT" && tx.date >= startDate && tx.date <= endDate)
        .forEach((tx) => {
          const item = items.find((i) => i.id === tx.itemId);
          csvContent += `"${tx.date}","${item?.name || "Deleted Item"}","${tx.quantity}","${item?.unit}","${tx.rate}","${tx.total}","${tx.purpose || ""}","${tx.batchId || ""}","${tx.notes || ""}"\n`;
        });
    } else if (activeReport === "production") {
      csvContent += "Run Date,Batch ID,Finished Good Produced,Output Quantity,Unit,Average Cost Rate (NPR),Total Formulation Cost (NPR)\n";
      productions
        .filter((p) => p.date >= startDate && p.date <= endDate)
        .forEach((p) => {
          const item = items.find((i) => i.id === p.finishedGoodsItemId);
          csvContent += `"${p.date}","${p.batchId}","${item?.name || "Deleted item"}","${p.outputQuantity}","${item?.unit}","${p.averageCostPerUnit}","${p.totalCost}"\n`;
        });
    } else if (activeReport === "purchase") {
      csvContent += "Date,Item Name,Supplier,Gate/Bill No,Vehicle No,Quantity Received,Unit,Purchase Rate (NPR),Total Purchase Value (NPR)\n";
      transactions
        .filter((tx) => tx.type === "STOCK_IN" && tx.date >= startDate && tx.date <= endDate)
        .forEach((tx) => {
          const item = items.find((i) => i.id === tx.itemId);
          csvContent += `"${tx.date}","${item?.name || "Deleted Item"}","${tx.supplier || ""}","${tx.billNo || ""}","${tx.vehicleNo || ""}","${tx.quantity}","${item?.unit}","${tx.rate}","${tx.total}"\n`;
        });
    } else if (activeReport === "low_stock") {
      csvContent += "Item Name,Category,Closing Stock,Unit,Safety Stock Level,Reorder Level,EOQ,Status\n";
      items.forEach((item) => {
        const metrics = calculateItemMetrics(item, transactions);
        if (metrics.status !== "Normal") {
          const cat = categories.find((c) => c.id === item.categoryId)?.name || "Unknown";
          csvContent += `"${item.name}","${cat}","${metrics.closingStock}","${item.unit}","${metrics.safetyStock}","${metrics.reorderLevel}","${metrics.eoq}","${metrics.status}"\n`;
        }
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Pre-filter transaction dates
  const dateFilteredIn = transactions.filter((tx) => tx.type === "STOCK_IN" && tx.date >= startDate && tx.date <= endDate);
  const dateFilteredOut = transactions.filter((tx) => tx.type === "STOCK_OUT" && tx.date >= startDate && tx.date <= endDate);
  const dateFilteredProd = productions.filter((p) => p.date >= startDate && p.date <= endDate);

  return (
    <div id="reports-module" className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Executive MIS Reporting</h2>
          <p className="text-xs text-slate-400">Run real-time stock balances, purchase logs, consumption sheets, and low stock warnings formatted for Nepali Rupees (NPR ₹)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadCSV}
            className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-semibold py-2 px-3.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Excel Export
          </button>
          <button
            onClick={handlePrint}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md transition"
          >
            <Printer className="w-4 h-4" />
            Print PDF Report
          </button>
        </div>
      </div>

      {/* Report Switcher & Filter panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 print:hidden">
        
        {/* Report tabs */}
        <div className="space-y-1.5 bg-slate-900/30 border border-slate-800 p-3 rounded-xl lg:col-span-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block px-2 mb-2 font-mono">Select Report Type</span>
          
          <button
            onClick={() => setActiveReport("stock")}
            className={`w-full text-left text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-2 transition cursor-pointer ${
              activeReport === "stock"
                ? "bg-emerald-500 text-slate-950"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Database className="w-4 h-4" />
            Stock Master Summary
          </button>

          <button
            onClick={() => setActiveReport("consumption")}
            className={`w-full text-left text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-2 transition cursor-pointer ${
              activeReport === "consumption"
                ? "bg-emerald-500 text-slate-950"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Flame className="w-4 h-4" />
            Consumption & Issues
          </button>

          <button
            onClick={() => setActiveReport("production")}
            className={`w-full text-left text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-2 transition cursor-pointer ${
              activeReport === "production"
                ? "bg-emerald-500 text-slate-950"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Layers className="w-4 h-4" />
            Production runs
          </button>

          <button
            onClick={() => setActiveReport("purchase")}
            className={`w-full text-left text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-2 transition cursor-pointer ${
              activeReport === "purchase"
                ? "bg-emerald-500 text-slate-950"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Purchase Receipts
          </button>

          <button
            onClick={() => setActiveReport("low_stock")}
            className={`w-full text-left text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-2 transition cursor-pointer ${
              activeReport === "low_stock"
                ? "bg-emerald-500 text-slate-950"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            Low & Critical Stocks
          </button>
        </div>

        {/* Date and filter selectors */}
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Filter Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* REPORT CONTENT VIEW - formatted for elegant print layout */}
      <div id="print-area" className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-sm print:bg-white print:text-slate-950 print:border-none print:shadow-none print:p-0">
        
        {/* Printable Header */}
        <div className="hidden print:block text-center border-b-2 border-slate-900 pb-5 mb-5 font-sans">
          <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-900">Manufacturing Inventory Management System</h1>
          <p className="text-sm font-semibold text-slate-700">MIS EXECUTIVE REPORT: {activeReport.toUpperCase().replace("_", " ")}</p>
          <div className="text-xs text-slate-500 font-mono mt-1">
            Period: {startDate} to {endDate} | Generated: {new Date().toLocaleString()}
          </div>
        </div>

        {/* Dynamic report body */}
        {activeReport === "stock" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3 print:border-slate-300">
              <h3 className="text-sm font-bold text-white print:text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                Live Stock Status Ledger
              </h3>
              <span className="text-[10px] font-mono font-bold text-emerald-400 print:text-slate-700 uppercase bg-slate-900/50 print:bg-slate-100 px-2.5 py-1 rounded">
                Total Stock Value: {formatNPR(items.reduce((sum, item) => sum + (calculateItemMetrics(item, transactions).closingStock * item.cost), 0))}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900/60 text-slate-400 font-mono border-b border-slate-700 print:bg-slate-100 print:text-slate-900 print:border-slate-400">
                    <th className="py-2.5 px-3">Material Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Closing Stock</th>
                    <th className="py-2.5 px-3 text-right">Rate</th>
                    <th className="py-2.5 px-3 text-right">Total Value</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 print:divide-slate-300">
                  {items
                    .filter((i) => selectedCategory === "" || i.categoryId === selectedCategory)
                    .map((item) => {
                      const metrics = calculateItemMetrics(item, transactions);
                      const catName = categories.find((c) => c.id === item.categoryId)?.name || "Unknown";
                      return (
                        <tr key={item.id} className="text-slate-300 print:text-slate-900">
                          <td className="py-2.5 px-3 font-semibold text-white print:text-slate-950">{item.name}</td>
                          <td className="py-2.5 px-3 text-slate-400 print:text-slate-600">{catName}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">{metrics.closingStock.toLocaleString()} {item.unit}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatNPR(item.cost)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-400 print:text-slate-950">{formatNPR(metrics.closingStock * item.cost)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-bold font-mono text-[10px] print:text-[11px] uppercase">
                              {metrics.status === "Critical" ? "🔴 CRITICAL" : metrics.status === "Low" ? "🟡 LOW" : "🟢 NORMAL"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === "consumption" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3 print:border-slate-300">
              <h3 className="text-sm font-bold text-white print:text-slate-900 flex items-center gap-2">
                <Flame className="w-4 h-4 text-emerald-400" />
                Raw Materials Consumption Summary (Stock Out)
              </h3>
              <span className="text-[10px] font-mono font-bold text-red-400 print:text-slate-700 uppercase bg-slate-900/50 print:bg-slate-100 px-2.5 py-1 rounded">
                Total Disbursed Value: {formatNPR(dateFilteredOut.reduce((sum, tx) => sum + tx.total, 0))}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900/60 text-slate-400 font-mono border-b border-slate-700 print:bg-slate-100 print:text-slate-900 print:border-slate-400">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Material Name</th>
                    <th className="py-2.5 px-3 text-right">Quantity Used</th>
                    <th className="py-2.5 px-3 text-right">Rate</th>
                    <th className="py-2.5 px-3 text-right">Total Cost</th>
                    <th className="py-2.5 px-3">Issue Purpose</th>
                    <th className="py-2.5 px-3">Batch ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 print:divide-slate-300">
                  {dateFilteredOut
                    .filter((tx) => {
                      const item = items.find((i) => i.id === tx.itemId);
                      return selectedCategory === "" || (item && item.categoryId === selectedCategory);
                    })
                    .map((tx) => {
                      const itemObj = items.find((i) => i.id === tx.itemId);
                      return (
                        <tr key={tx.id} className="text-slate-300 print:text-slate-900">
                          <td className="py-2.5 px-3 font-mono">{tx.date}</td>
                          <td className="py-2.5 px-3 font-semibold text-white print:text-slate-950">{itemObj?.name || "Deleted Ingredient"}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">{tx.quantity.toLocaleString()} {itemObj?.unit}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatNPR(tx.rate)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-red-400 print:text-slate-950">{formatNPR(tx.total)}</td>
                          <td className="py-2.5 px-3 font-semibold">{tx.purpose || "Production"}</td>
                          <td className="py-2.5 px-3 font-mono text-emerald-400 print:text-slate-900">{tx.batchId || "—"}</td>
                        </tr>
                      );
                    })}

                  {dateFilteredOut.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 italic">No consumption records found for chosen date window.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === "production" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3 print:border-slate-300">
              <h3 className="text-sm font-bold text-white print:text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Factory Production & Formulation Costs Summary
              </h3>
              <span className="text-[10px] font-mono font-bold text-emerald-400 print:text-slate-700 uppercase bg-slate-900/50 print:bg-slate-100 px-2.5 py-1 rounded">
                Cumulative Run Cost: {formatNPR(dateFilteredProd.reduce((sum, p) => sum + p.totalCost, 0))}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900/60 text-slate-400 font-mono border-b border-slate-700 print:bg-slate-100 print:text-slate-900 print:border-slate-400">
                    <th className="py-2.5 px-3">Run Date</th>
                    <th className="py-2.5 px-3">Batch ID</th>
                    <th className="py-2.5 px-3">Finished Goods Item</th>
                    <th className="py-2.5 px-3 text-right">Output Qty</th>
                    <th className="py-2.5 px-3 text-right">Avg Cost / Unit</th>
                    <th className="py-2.5 px-3 text-right">Total Batch Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 print:divide-slate-300">
                  {dateFilteredProd
                    .filter((p) => {
                      const item = items.find((i) => i.id === p.finishedGoodsItemId);
                      return selectedCategory === "" || (item && item.categoryId === selectedCategory);
                    })
                    .map((p) => {
                      const fgObj = items.find((i) => i.id === p.finishedGoodsItemId);
                      return (
                        <tr key={p.id} className="text-slate-300 print:text-slate-900">
                          <td className="py-2.5 px-3 font-mono">{p.date}</td>
                          <td className="py-2.5 px-3 font-semibold font-mono text-emerald-400 print:text-slate-950">{p.batchId}</td>
                          <td className="py-2.5 px-3 font-bold text-white print:text-slate-950">{fgObj?.name || "Deleted Output Item"}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">{p.outputQuantity.toLocaleString()} {fgObj?.unit}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatNPR(p.averageCostPerUnit)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 print:text-slate-950">{formatNPR(p.totalCost)}</td>
                        </tr>
                      );
                    })}

                  {dateFilteredProd.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 italic">No production runs recorded in chosen range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === "purchase" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3 print:border-slate-300">
              <h3 className="text-sm font-bold text-white print:text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                Purchase Receipts & Arrivals Ledger (Stock In)
              </h3>
              <span className="text-[10px] font-mono font-bold text-emerald-400 print:text-slate-700 uppercase bg-slate-900/50 print:bg-slate-100 px-2.5 py-1 rounded">
                Total Purchases: {formatNPR(dateFilteredIn.reduce((sum, tx) => sum + tx.total, 0))}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900/60 text-slate-400 font-mono border-b border-slate-700 print:bg-slate-100 print:text-slate-900 print:border-slate-400">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3">Gate Pass / Bill No</th>
                    <th className="py-2.5 px-3 text-right">Qty Received</th>
                    <th className="py-2.5 px-3 text-right">Purchase Rate</th>
                    <th className="py-2.5 px-3 text-right">Total value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 print:divide-slate-300">
                  {dateFilteredIn
                    .filter((tx) => {
                      const item = items.find((i) => i.id === tx.itemId);
                      return selectedCategory === "" || (item && item.categoryId === selectedCategory);
                    })
                    .map((tx) => {
                      const itemObj = items.find((i) => i.id === tx.itemId);
                      return (
                        <tr key={tx.id} className="text-slate-300 print:text-slate-900">
                          <td className="py-2.5 px-3 font-mono">{tx.date}</td>
                          <td className="py-2.5 px-3 font-semibold text-white print:text-slate-950">{itemObj?.name || "Deleted Item"}</td>
                          <td className="py-2.5 px-3 text-slate-400 print:text-slate-650">{tx.supplier || "—"}</td>
                          <td className="py-2.5 px-3 font-mono">{tx.billNo || "—"}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">{tx.quantity.toLocaleString()} {itemObj?.unit}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatNPR(tx.rate)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 print:text-slate-950">{formatNPR(tx.total)}</td>
                        </tr>
                      );
                    })}

                  {dateFilteredIn.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 italic">No purchase receipts found in chosen range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === "low_stock" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3 print:border-slate-300">
              <h3 className="text-sm font-bold text-white print:text-slate-900 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-emerald-400" />
                Dynamic Low & Critical Stock Level Warnings
              </h3>
              <span className="text-xxs font-mono font-bold text-yellow-400 print:text-slate-700 uppercase bg-slate-900/50 print:bg-slate-100 px-2 py-1 rounded">
                Attention Required Immediately
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900/60 text-slate-400 font-mono border-b border-slate-700 print:bg-slate-100 print:text-slate-900 print:border-slate-400">
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right font-bold text-yellow-400">Closing Stock</th>
                    <th className="py-2.5 px-3 text-right">Safety Level</th>
                    <th className="py-2.5 px-3 text-right">Reorder Point (ROL)</th>
                    <th className="py-2.5 px-3 text-right">Economic Order (EOQ)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 print:divide-slate-300">
                  {items
                    .filter((item) => {
                      const metrics = calculateItemMetrics(item, transactions);
                      const isMatchCat = selectedCategory === "" || item.categoryId === selectedCategory;
                      return isMatchCat && metrics.status !== "Normal";
                    })
                    .map((item) => {
                      const metrics = calculateItemMetrics(item, transactions);
                      const catName = categories.find((c) => c.id === item.categoryId)?.name || "Unknown";
                      return (
                        <tr key={item.id} className="text-slate-300 print:text-slate-900">
                          <td className="py-2.5 px-3 font-semibold text-white print:text-slate-950">{item.name}</td>
                          <td className="py-2.5 px-3 text-slate-400 print:text-slate-650">{catName}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-yellow-400 print:text-slate-950">{metrics.closingStock.toLocaleString()} {item.unit}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{Math.round(metrics.safetyStock).toLocaleString()} {item.unit}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-orange-400">{Math.round(metrics.reorderLevel).toLocaleString()} {item.unit}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-400">{metrics.eoq.toLocaleString()} {item.unit}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-bold text-[10px] uppercase font-mono text-red-500">
                              {metrics.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                  {items.filter((item) => calculateItemMetrics(item, transactions).status !== "Normal").length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 italic">All raw materials and ingredients are at healthy levels (🟢 Normal).</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
