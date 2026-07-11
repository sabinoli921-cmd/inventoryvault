import React from "react";
import { Item, Category, Transaction, Production } from "../types";
import { formatNPR, calculateItemMetrics } from "../utils";
import { 
  DollarSign, 
  TrendingDown, 
  Activity, 
  Layers, 
  AlertTriangle, 
  ChevronRight, 
  ShieldCheck, 
  Compass,
  ArrowRight,
  TrendingUp,
  AlertOctagon,
  Scale
} from "lucide-react";

interface DashboardProps {
  items: Item[];
  categories: Category[];
  transactions: Transaction[];
  productions: Production[];
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ items, categories, transactions, productions, onNavigate }: DashboardProps) {
  
  // Calculate total inventory value
  const totalInventoryValue = items.reduce((sum, item) => {
    const metrics = calculateItemMetrics(item, transactions);
    return sum + (metrics.closingStock * item.cost);
  }, 0);

  // Low stock warning count
  const lowStockItems = items.filter((item) => {
    const metrics = calculateItemMetrics(item, transactions);
    return metrics.status !== "Normal";
  });

  // Daily Consumption
  const todayStr = new Date().toISOString().split("T")[0];
  const todayTransactions = transactions.filter((tx) => tx.date === todayStr);
  const todayStockOuts = todayTransactions.filter((tx) => tx.type === "STOCK_OUT");
  const todayConsumptionValue = todayStockOuts.reduce((sum, tx) => sum + tx.total, 0);

  // Monthly Production counts
  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const monthlyProductions = productions.filter((p) => p.date.startsWith(currentMonthPrefix));
  const monthlyProductionOutput = monthlyProductions.reduce((sum, p) => sum + p.outputQuantity, 0);

  // Top Used Items
  const itemConsumptionMap: Record<string, { name: string; totalQty: number; totalCost: number; unit: string }> = {};
  transactions
    .filter((tx) => tx.type === "STOCK_OUT")
    .forEach((tx) => {
      const item = items.find((i) => i.id === tx.itemId);
      if (item) {
        if (!itemConsumptionMap[tx.itemId]) {
          itemConsumptionMap[tx.itemId] = {
            name: item.name,
            totalQty: 0,
            totalCost: 0,
            unit: item.unit
          };
        }
        itemConsumptionMap[tx.itemId].totalQty += tx.quantity;
        itemConsumptionMap[tx.itemId].totalCost += tx.total;
      }
    });

  const topUsedItems = Object.values(itemConsumptionMap)
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 4);

  // Group items by category to calculate category split values
  const categorySplit = categories.map((cat) => {
    const catItems = items.filter((i) => i.categoryId === cat.id);
    const value = catItems.reduce((sum, item) => {
      const metrics = calculateItemMetrics(item, transactions);
      return sum + (metrics.closingStock * item.cost);
    }, 0);
    return {
      name: cat.name,
      value
    };
  }).filter((c) => c.value > 0);

  const maxCatValue = Math.max(...categorySplit.map((c) => c.value), 1);

  // Safety Stock / ROL list
  const criticalItems = items
    .map((item) => ({
      ...item,
      metrics: calculateItemMetrics(item, transactions)
    }))
    .filter((item) => item.metrics.status === "Critical")
    .slice(0, 5);

  return (
    <div id="dashboard-module" className="space-y-6 font-sans">
      
      {/* Banner / Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-800/40 border border-slate-700 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider">Secure Manufacturing Ledger</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">Active Operation Dashboard</h2>
          <p className="text-xs text-slate-400">Nepalese Rupee (NPR ₹) standard reporting, real-time formula calculations, and low safety thresholds alarms.</p>
        </div>
        <div className="relative z-10 flex gap-2">
          <button
            onClick={() => onNavigate("transactions")}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1 cursor-pointer transition shadow-md"
          >
            Fast Entry Ledger
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        {/* Abstract shape design */}
        <div className="absolute right-0 bottom-0 w-36 h-36 bg-emerald-500/5 rounded-full blur-2xl"></div>
      </div>

      {/* STAT CARDS ROW */}
      <div id="stats-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Inventory Value */}
        <div id="stat-inventory-val" className="bg-slate-800 border border-slate-700/80 rounded-xl p-4 space-y-3 relative overflow-hidden">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold">Total Stock Valuation</span>
            <div className="w-7 h-7 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold font-mono">₹</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-lg font-black text-white tracking-tight font-mono">
              {formatNPR(totalInventoryValue)}
            </h3>
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              Active ledger value in Kathmandu
            </span>
          </div>
        </div>

        {/* Card 2: Low Stock Alarms */}
        <div id="stat-low-stock" className="bg-slate-800 border border-slate-700/80 rounded-xl p-4 space-y-3 relative overflow-hidden">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold">Low Level Alarms</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              lowStockItems.length > 0 ? "bg-red-500/10 text-red-400" : "bg-slate-700/50 text-slate-400"
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-lg font-black text-white tracking-tight">
              {lowStockItems.length} <span className="text-xs font-normal text-slate-400">materials</span>
            </h3>
            <span className={`text-[10px] flex items-center gap-1 font-semibold ${
              lowStockItems.length > 0 ? "text-red-400" : "text-emerald-400"
            }`}>
              {lowStockItems.length > 0 ? "⚠️ Critical threshold breached" : "✓ All stocks healthy"}
            </span>
          </div>
        </div>

        {/* Card 3: Today's Consumption */}
        <div id="stat-today-consumption" className="bg-slate-800 border border-slate-700/80 rounded-xl p-4 space-y-3 relative overflow-hidden">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold">Today's Consumption</span>
            <div className="w-7 h-7 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-lg font-black text-white tracking-tight font-mono">
              {formatNPR(todayConsumptionValue)}
            </h3>
            <span className="text-[10px] text-slate-400">
              {todayStockOuts.length} issues recorded today
            </span>
          </div>
        </div>

        {/* Card 4: Monthly Production Outputs */}
        <div id="stat-monthly-production" className="bg-slate-800 border border-slate-700/80 rounded-xl p-4 space-y-3 relative overflow-hidden">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold">Monthly Production Runs</span>
            <div className="w-7 h-7 bg-purple-500/10 text-purple-400 rounded-lg flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-lg font-black text-white tracking-tight">
              {monthlyProductionOutput.toLocaleString()} <span className="text-xs font-normal text-slate-400">KG output</span>
            </h3>
            <span className="text-[10px] text-slate-400">
              {monthlyProductions.length} batches completed this month
            </span>
          </div>
        </div>
      </div>

      {/* CHARTS AND ALERTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Category Split & Bespoke Visual charts */}
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-5">
          <div className="border-b border-slate-700 pb-3">
            <h3 className="text-sm font-bold text-white">Stock Valuation by Category</h3>
          </div>

          <div className="space-y-4">
            {categorySplit.map((cat, i) => {
              const percentage = (cat.value / maxCatValue) * 100;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-300">{cat.name}</span>
                    <span className="font-mono text-emerald-400 font-bold">{formatNPR(cat.value)}</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}

            {categorySplit.length === 0 && (
              <div className="text-center text-xs text-slate-500 py-8 italic">
                No active categories or items with stock balances found.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Top materials consumed */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-700 pb-3">
            <h3 className="text-sm font-bold text-white">Top Used Raw Materials (Value)</h3>
          </div>

          <div className="space-y-3.5">
            {topUsedItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-200">{item.name}</span>
                  <div className="text-[10px] text-slate-500">
                    Consumed: {item.totalQty.toLocaleString()} {item.unit}
                  </div>
                </div>
                <span className="font-mono text-red-400 font-bold">
                  {formatNPR(item.totalCost)}
                </span>
              </div>
            ))}

            {topUsedItems.length === 0 && (
              <div className="text-center text-xs text-slate-500 py-8 italic">
                No consumption log history recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CRITICAL STOCK ALARMS & ROL ACTIONS */}
      <div id="reorder-analysis-block" className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
        <div className="border-b border-slate-700 pb-3 flex justify-between items-center">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <AlertOctagon className="w-4.5 h-4.5 text-red-400" />
            Critical Stock Action Board
          </h3>
          <span className="text-[10px] text-slate-400 font-mono">Safety stock limits exceeded</span>
        </div>

        {criticalItems.length > 0 ? (
          <div className="space-y-2">
            {criticalItems.map((item) => (
              <div 
                key={item.id} 
                className="bg-red-950/20 border border-red-500/20 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-red-500/30 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    <h4 className="text-xs font-extrabold text-white">{item.name}</h4>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Closing stock level: <span className="text-red-400 font-bold">{item.metrics.closingStock} {item.unit}</span>. 
                    Reorder point is <span className="font-bold">{Math.round(item.metrics.reorderLevel)} {item.unit}</span>.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 items-center text-xs">
                  <div className="text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 font-mono">
                    EOQ Suggestion: <span className="text-emerald-400 font-bold">{item.metrics.eoq} {item.unit}</span>
                  </div>
                  <button
                    onClick={() => onNavigate("transactions")}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-[11px] flex items-center gap-1 cursor-pointer transition shadow-sm"
                  >
                    Stock In Now
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-slate-900/40 rounded-lg text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
            <span>All inventory safety limits are secure. No critical reorders suggested today.</span>
          </div>
        )}
      </div>
    </div>
  );
}
