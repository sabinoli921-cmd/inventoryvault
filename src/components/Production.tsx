import React, { useState, useEffect } from "react";
import { Item, Category, Permission, Transaction, Production, ProductionInput } from "../types";
import { 
  db, 
  collection, 
  addDoc, 
  writeBatch,
  doc,
  onSnapshot,
  updateDoc
} from "../firebase";
import { logAudit, formatNPR, calculateItemMetrics } from "../utils";
import { 
  Plus, 
  Trash2, 
  Zap, 
  Sparkles, 
  Settings, 
  X, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  FileText
} from "lucide-react";

// Structure for local formulation recipe helper
interface RecipeIngredient {
  itemId: string;
  proportion: number; // e.g. 0.55 for 55% of total formulation or direct quantity ratio
}

interface Formula {
  id?: string;
  name: string;
  finishedGoodsItemId: string;
  baseOutputQty: number; // e.g. 1000 KG
  ingredients: RecipeIngredient[];
}

interface ProductionProps {
  productions: Production[];
  items: Item[];
  categories: Category[];
  transactions: Transaction[];
  user: any;
  userProfile: any;
  permissions: Permission;
}

export default function ProductionModule({ productions, items, categories, transactions, user, userProfile, permissions }: ProductionProps) {
  const [showFormulaForm, setShowFormulaForm] = useState(false);
  const [showProductionForm, setShowProductionForm] = useState(false);

  // In-memory formulas stored locally or in Firestore (we can save formulas in Firestore to make it fully persistent!)
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [formulaLoading, setFormulaLoading] = useState(true);

  // Formula Form state
  const [formulaName, setFormulaName] = useState("");
  const [finishedGoodsItemId, setFinishedGoodsItemId] = useState("");
  const [baseOutputQty, setBaseOutputQty] = useState(1000);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);

  // Individual ingredient row state
  const [tempItemId, setTempItemId] = useState("");
  const [tempProp, setTempProp] = useState(0);

  // Production Run Form state
  const [prodDate, setProdDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedFormulaId, setSelectedFormulaId] = useState("");
  const [outputQuantity, setOutputQuantity] = useState(1000);
  const [batchId, setBatchId] = useState("");
  
  const [insufficientStockList, setInsufficientStockList] = useState<Array<{ name: string; required: number; available: number; unit: string }>>([]);

  // Fetch formulas from Firestore on mount
  useEffect(() => {
    // For simplicity and immediate reliability, let's load / subscribe to recipes in Firestore!
    const unsub = db ? collection(db, "formulas") : null;
    if (unsub) {
      return onSnapshot(unsub, (snap: any) => {
        const loaded: Formula[] = [];
        snap.forEach((doc: any) => {
          loaded.push({ id: doc.id, ...doc.data() });
        });
        setFormulas(loaded);
        setFormulaLoading(false);
      }, (error: any) => {
        console.warn("Formulas snapshot error:", error.message);
        setFormulaLoading(false);
      });
    }
  }, []);

  const handleAddIngredientRow = () => {
    if (!tempItemId || tempProp <= 0) return;
    if (recipeIngredients.some((ri) => ri.itemId === tempItemId)) {
      alert("Ingredient already added to this formula recipe.");
      return;
    }
    setRecipeIngredients([...recipeIngredients, { itemId: tempItemId, proportion: Number(tempProp) }]);
    setTempItemId("");
    setTempProp(0);
  };

  const handleRemoveIngredientRow = (index: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
  };

  const handleCreateFormula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formulaName.trim() || !finishedGoodsItemId || recipeIngredients.length === 0) {
      alert("Please enter a recipe name, select finished goods, and add ingredients.");
      return;
    }

    try {
      const payload = {
        name: formulaName.trim(),
        finishedGoodsItemId,
        baseOutputQty: Number(baseOutputQty),
        ingredients: recipeIngredients,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "formulas"), payload);
      await logAudit(
        user.uid,
        user.email,
        "CREATE_FORMULA",
        `Created Recipe Formula: ${payload.name}`,
        "",
        "formula"
      );

      // reset
      setFormulaName("");
      setFinishedGoodsItemId("");
      setBaseOutputQty(1000);
      setRecipeIngredients([]);
      setShowFormulaForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  const selectedFormula = formulas.find((f) => f.id === selectedFormulaId);

  // Calculate required inputs based on selected formula and output quantity
  const calculatedInputs = React.useMemo(() => {
    if (!selectedFormula) return [];

    const ratio = outputQuantity / selectedFormula.baseOutputQty;
    return selectedFormula.ingredients.map((ing) => {
      const item = items.find((i) => i.id === ing.itemId);
      const reqQty = ing.proportion * ratio;
      const metrics = item ? calculateItemMetrics(item, transactions) : null;
      const currentStock = metrics ? metrics.closingStock : 0;
      
      return {
        itemId: ing.itemId,
        name: item?.name || "Deleted Ingredient",
        unit: item?.unit || "KG",
        rate: item?.cost || 0,
        requiredQty: reqQty,
        availableQty: currentStock,
        totalCost: reqQty * (item?.cost || 0)
      };
    });
  }, [selectedFormula, outputQuantity, items, transactions]);

  // Check stocks when inputs change
  useEffect(() => {
    const insufficient = calculatedInputs
      .filter((input) => input.availableQty < input.requiredQty)
      .map((input) => ({
        name: input.name,
        required: input.requiredQty,
        available: input.availableQty,
        unit: input.unit
      }));
    setInsufficientStockList(insufficient);
  }, [calculatedInputs]);

  // Record Production Batch Run
  const handleRecordProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.create || !selectedFormula) return;

    if (!batchId.trim()) {
      alert("Batch ID is required for factory tracing.");
      return;
    }

    // Validate stocks
    if (insufficientStockList.length > 0) {
      const forceProceed = confirm(
        "Warning: Some ingredients do not have sufficient stock levels in your warehouse. Proceeding will trigger negative stock ledger entries. Do you want to proceed?"
      );
      if (!forceProceed) return;
    }

    try {
      const totalIngredientCost = calculatedInputs.reduce((sum, ing) => sum + ing.totalCost, 0);
      const finishedItem = items.find((i) => i.id === selectedFormula.finishedGoodsItemId);

      const productionPayload = {
        date: prodDate,
        batchId: batchId.trim(),
        finishedGoodsItemId: selectedFormula.finishedGoodsItemId,
        outputQuantity: Number(outputQuantity),
        totalCost: Number(totalIngredientCost),
        averageCostPerUnit: Number(totalIngredientCost / outputQuantity),
        inputs: calculatedInputs.map((ing) => ({
          itemId: ing.itemId,
          quantity: ing.requiredQty,
          rate: ing.rate,
          total: ing.totalCost
        })),
        createdBy: user.uid,
        createdAt: new Date().toISOString()
      };

      // We'll perform batch writes to do everything atomically!
      // 1. Save production log
      const prodRef = await addDoc(collection(db, "productions"), productionPayload);

      // 2. We need to create STOCK OUT transactions for all consumed raw ingredients,
      // and a STOCK IN transaction for the produced finished goods!
      // This is dynamic double-entry bookkeeping!
      for (const ing of calculatedInputs) {
        await addDoc(collection(db, "transactions"), {
          date: prodDate,
          type: "STOCK_OUT",
          itemId: ing.itemId,
          quantity: ing.requiredQty,
          rate: ing.rate,
          total: ing.totalCost,
          purpose: "Production",
          batchId: batchId.trim(),
          createdBy: user.uid,
          createdAt: new Date().toISOString()
        });
      }

      // Add Stock In for final output finished good
      await addDoc(collection(db, "transactions"), {
        date: prodDate,
        type: "STOCK_IN",
        itemId: selectedFormula.finishedGoodsItemId,
        quantity: Number(outputQuantity),
        rate: Number(totalIngredientCost / outputQuantity), // cost rate derived dynamically from input materials cost!
        total: totalIngredientCost,
        supplier: "Internal Manufacturing Run",
        billNo: `PROD-${batchId.trim()}`,
        createdBy: user.uid,
        createdAt: new Date().toISOString()
      });

      // Optionally update finished goods cost rate inside Item Master dynamically!
      const fgRef = doc(db, "items", selectedFormula.finishedGoodsItemId);
      const latestAvgCost = totalIngredientCost / outputQuantity;
      await updateDoc(fgRef, {
        cost: latestAvgCost,
        updatedAt: new Date().toISOString()
      });

      await logAudit(
        user.uid,
        user.email,
        "RECORD_PRODUCTION_RUN",
        `Manufactured ${outputQuantity} ${finishedItem?.unit} of ${finishedItem?.name} in batch ${batchId.trim()}. Total material cost: NPR ${totalIngredientCost}`,
        prodRef.id,
        "production"
      );

      // Reset
      setSelectedFormulaId("");
      setOutputQuantity(1000);
      setBatchId("");
      setShowProductionForm(false);
    } catch (err) {
      console.error(err);
      alert("Error recording production.");
    }
  };

  return (
    <div id="production-module" className="space-y-6 font-sans">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Factory Production</h2>
          <p className="text-xs text-slate-400">Design product formulas, track bill of materials, trigger inventory consumption, and calculate live batch production costs</p>
        </div>
        {permissions.create && (
          <div className="flex gap-2">
            <button
              id="show-formula-form-btn"
              onClick={() => { setShowFormulaForm(true); setShowProductionForm(false); }}
              className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-semibold py-2 px-3.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition"
            >
              <Settings className="w-4 h-4 text-emerald-400" />
              Define Recipe Formula
            </button>
            <button
              id="show-prod-form-btn"
              onClick={() => { setShowProductionForm(true); setShowFormulaForm(false); }}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md transition"
            >
              <Zap className="w-4 h-4" />
              Run Factory Batch
            </button>
          </div>
        )}
      </div>

      {/* 1. DEFINE FORMULA FORM */}
      {showFormulaForm && (
        <div id="formula-form-card" className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex justify-between items-center pb-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Build Dynamic Formulation Recipe
            </h3>
            <button 
              onClick={() => setShowFormulaForm(false)} 
              className="text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleCreateFormula} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Recipe / Formula Name</label>
                <input
                  type="text"
                  required
                  value={formulaName}
                  onChange={(e) => setFormulaName(e.target.value)}
                  placeholder="e.g. Broiler Starter Recipe"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Target Finished Product</label>
                <select
                  required
                  value={finishedGoodsItemId}
                  onChange={(e) => setFinishedGoodsItemId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white"
                >
                  <option value="">-- Choose Output Goods --</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({categories.find((c) => c.id === i.categoryId)?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Base Batch Quantity (Output)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={baseOutputQty}
                  onChange={(e) => setBaseOutputQty(Number(e.target.value))}
                  placeholder="e.g. 1000"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white"
                />
              </div>
            </div>

            {/* Recipe Composition Builder */}
            <div className="bg-slate-900/40 p-4 border border-slate-750 rounded-xl space-y-4">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Material Proportions / Ingredients</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase font-mono">Ingredient Material</label>
                  <select
                    value={tempItemId}
                    onChange={(e) => setTempItemId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded py-1.5 px-2 text-xs text-white"
                  >
                    <option value="">-- Choose Raw Material --</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase font-mono">Qty Required per Base Batch</label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    value={tempProp || ""}
                    onChange={(e) => setTempProp(Number(e.target.value))}
                    placeholder="e.g. 550"
                    className="w-full bg-slate-950 border border-slate-700 rounded py-1.5 px-2 text-xs text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddIngredientRow}
                  className="bg-slate-750 hover:bg-slate-700 border border-slate-700 text-slate-200 py-1.5 rounded text-xs font-semibold cursor-pointer"
                >
                  Insert Ingredient
                </button>
              </div>

              {/* Composition List */}
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {recipeIngredients.map((ing, idx) => {
                  const it = items.find((i) => i.id === ing.itemId);
                  return (
                    <div key={idx} className="flex justify-between items-center bg-slate-950/60 p-2 border border-slate-850 rounded text-xs">
                      <div className="text-slate-300 font-medium">
                        {it?.name || "Deleted Item"} 
                        <span className="text-slate-500 text-[10px] ml-1">({it?.unit})</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-emerald-400 font-bold">
                          {ing.proportion.toLocaleString()} {it?.unit} ({((ing.proportion / baseOutputQty) * 100).toFixed(1)}%)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredientRow(idx)}
                          className="text-slate-500 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {recipeIngredients.length === 0 && (
                  <span className="text-xxs text-slate-500 italic block text-center py-2">Add ingredients to formulate your finished product composition.</span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setShowFormulaForm(false)}
                className="border border-slate-700 text-slate-300 hover:bg-slate-750 px-4 py-2 rounded-lg text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-5 py-2 rounded-lg text-xs font-bold shadow-md transition"
              >
                Register Formula
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. RECORD PRODUCTION BATCH RUN */}
      {showProductionForm && (
        <div id="production-run-card" className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex justify-between items-center pb-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              Trigger Factory Production Batch Run
            </h3>
            <button 
              onClick={() => setShowProductionForm(false)} 
              className="text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {formulas.length === 0 ? (
            <div className="p-4 bg-slate-900/50 rounded-lg text-center text-slate-400 text-xs">
              No formulas registered. Please configure a formula/recipe first.
            </div>
          ) : (
            <form onSubmit={handleRecordProduction} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                {/* Date */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Run Date</label>
                  <input
                    type="date"
                    required
                    value={prodDate}
                    onChange={(e) => setProdDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white"
                  />
                </div>

                {/* Formula Select */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-medium text-slate-300">Select Recipe / Formula</label>
                  <select
                    required
                    value={selectedFormulaId}
                    onChange={(e) => setSelectedFormulaId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white"
                  >
                    <option value="">-- Choose Formulation --</option>
                    {formulas.map((f) => {
                      const fgItem = items.find((i) => i.id === f.finishedGoodsItemId);
                      return (
                        <option key={f.id} value={f.id}>
                          {f.name} (Produces {fgItem?.name})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Batch ID */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Batch ID / Code <span className="text-emerald-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    placeholder="e.g. BATCH-304"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white"
                  />
                </div>

                {/* Output Qty */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Desired Output Quantity</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={outputQuantity}
                    onChange={(e) => setOutputQuantity(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white"
                  />
                </div>

                {/* Target Unit display */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Finished Goods Unit</label>
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={selectedFormula ? (items.find((i) => i.id === selectedFormula.finishedGoodsItemId)?.unit || "—") : "Select Formula"}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-500"
                  />
                </div>
              </div>

              {/* LIVE BILL OF MATERIALS ESTIMATION */}
              {selectedFormula && (
                <div className="bg-slate-900/40 p-4 border border-slate-750 rounded-xl space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <div>
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Live Bill Of Materials (BOM) & Costs Calculation</span>
                      <span className="text-[10px] text-slate-400">Calculates exact ingredient usage and cumulative manufacturing cost dynamically in NPR.</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Estimated Cost:</span>
                      <span className="text-sm font-bold text-emerald-300 font-mono">
                        {formatNPR(calculatedInputs.reduce((sum, ing) => sum + ing.totalCost, 0))}
                      </span>
                    </div>
                  </div>

                  {insufficientStockList.length > 0 && (
                    <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <div>
                        <span className="font-bold">Insufficient Stock: </span> 
                        {insufficientStockList.map((i) => `${i.name} (Need: ${Math.round(i.required)}, Have: ${Math.round(i.available)} ${i.unit})`).join("; ")}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {calculatedInputs.map((ing) => (
                      <div key={ing.itemId} className="grid grid-cols-5 text-xs bg-slate-950/60 p-2 border border-slate-850 rounded items-center">
                        <span className="col-span-2 font-semibold text-slate-200 truncate">{ing.name}</span>
                        <span className="text-slate-400 text-right font-mono">
                          {Math.round(ing.requiredQty * 100) / 100} {ing.unit}
                        </span>
                        <span className="text-slate-500 text-right">
                          @{formatNPR(ing.rate)}
                        </span>
                        <span className="text-emerald-400 font-bold font-mono text-right">
                          {formatNPR(ing.totalCost)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowProductionForm(false)}
                  className="border border-slate-700 text-slate-300 hover:bg-slate-750 px-4 py-2 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-5 py-2 rounded-lg text-xs font-bold shadow-md transition"
                >
                  Confirm & Consume Materials
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* RECENT FACTORY LOGS */}
      <div id="production-logs-wrapper" className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-white">Completed Manufacturing Runs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 font-mono border-b border-slate-700">
              <tr>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider">Date</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider">Batch ID</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider">Manufactured Item</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Output Qty</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Avg Unit Cost</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Total Batch Cost</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-center">BOM Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {productions.map((p) => {
                const fgItem = items.find((i) => i.id === p.finishedGoodsItemId);
                return (
                  <tr key={p.id} className="hover:bg-slate-750/30 transition">
                    <td className="py-3 px-4 font-mono font-medium text-slate-300">{p.date}</td>
                    <td className="py-3 px-4 font-semibold font-mono text-emerald-400">{p.batchId}</td>
                    <td className="py-3 px-4 font-bold text-white">{fgItem?.name || "Deleted Output Good"}</td>
                    <td className="py-3 px-4 text-right font-bold font-mono text-slate-200">
                      {p.outputQuantity.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{fgItem?.unit}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">{formatNPR(p.averageCostPerUnit)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-300">{formatNPR(p.totalCost)}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5 text-xxs text-slate-400 max-w-xs max-h-16 overflow-y-auto font-mono">
                        {p.inputs?.map((inp, idx) => {
                          const itemObj = items.find((itm) => itm.id === inp.itemId);
                          return (
                            <span key={idx}>
                              • {itemObj?.name || "Ingredient"}: {inp.quantity} {itemObj?.unit}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {productions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <Activity className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                    <h5 className="font-semibold text-slate-300">No factory production batches run yet</h5>
                    <p className="text-xs text-slate-500 mt-0.5">Use the "Run Factory Batch" trigger to process recipe compositions.</p>
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
