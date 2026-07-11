import React, { useState, useEffect } from "react";
import { Item, Category, Permission, Transaction } from "../types";
import { 
  db, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from "../firebase";
import { logAudit, formatNPR, calculateItemMetrics, parseBulkUpload } from "../utils";
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Filter, 
  SlidersHorizontal,
  FileSpreadsheet,
  Grid3X3,
  X,
  Upload,
  RefreshCw,
  AlertCircle
} from "lucide-react";

interface ItemsProps {
  items: Item[];
  categories: Category[];
  transactions: Transaction[];
  user: any;
  userProfile: any;
  permissions: Permission;
}

export default function Items({ items, categories, transactions, user, userProfile, permissions }: ItemsProps) {
  const [showForm, setShowForm] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "cost" | "stock">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Form fields
  const [categoryId, setCategoryId] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [cost, setCost] = useState(0);
  const [supplier, setSupplier] = useState("");
  const [minStock, setMinStock] = useState(0);
  const [leadTime, setLeadTime] = useState(3);
  
  // Custom field dynamic values
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number>>({});

  // Bulk Upload State
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");

  const activeCategory = categories.find((c) => c.id === categoryId);

  // Set default unit when category changes
  useEffect(() => {
    if (activeCategory) {
      if (activeCategory.unitTypes && activeCategory.unitTypes.length > 0) {
        setUnit(activeCategory.unitTypes[0]);
      } else {
        setUnit("KG");
      }
      setSubcategory("");
      
      // Initialize custom field values
      const initialFields: Record<string, string | number> = {};
      activeCategory.customFields?.forEach((f) => {
        initialFields[f.name] = f.type === "number" ? 0 : "";
      });
      setCustomFieldValues(initialFields);
    }
  }, [categoryId, categories]);

  const handleResetForm = () => {
    setCategoryId("");
    setSubcategory("");
    setName("");
    setUnit("");
    setCost(0);
    setSupplier("");
    setMinStock(0);
    setLeadTime(3);
    setCustomFieldValues({});
    setIsEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.create && !permissions.edit) return;

    try {
      const payload = {
        categoryId,
        subcategory,
        name: name.trim(),
        unit,
        cost: Number(cost),
        supplier: supplier.trim(),
        minStock: Number(minStock),
        leadTime: Number(leadTime),
        customFields: customFieldValues,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (isEditing) {
        if (!permissions.edit) return;
        const itemRef = doc(db, "items", isEditing);
        await updateDoc(itemRef, {
          categoryId: payload.categoryId,
          subcategory: payload.subcategory,
          name: payload.name,
          unit: payload.unit,
          cost: payload.cost,
          supplier: payload.supplier,
          minStock: payload.minStock,
          leadTime: payload.leadTime,
          customFields: payload.customFields,
          updatedAt: new Date().toISOString()
        });
        await logAudit(
          user.uid,
          user.email,
          "EDIT_ITEM",
          `Updated Item ${payload.name} (${categories.find((c) => c.id === categoryId)?.name})`,
          isEditing,
          "item"
        );
      } else {
        if (!permissions.create) return;
        const docRef = await addDoc(collection(db, "items"), payload);
        await logAudit(
          user.uid,
          user.email,
          "CREATE_ITEM",
          `Created Item ${payload.name} inside category ${categories.find((c) => c.id === categoryId)?.name}`,
          docRef.id,
          "item"
        );
      }

      handleResetForm();
    } catch (error) {
      console.error("Error saving item:", error);
    }
  };

  const handleEdit = (item: Item) => {
    if (!permissions.edit) return;
    setIsEditing(item.id);
    setCategoryId(item.categoryId);
    setSubcategory(item.subcategory || "");
    setName(item.name);
    setUnit(item.unit);
    setCost(item.cost);
    setSupplier(item.supplier || "");
    setMinStock(item.minStock || 0);
    setLeadTime(item.leadTime || 3);
    setCustomFieldValues(item.customFields || {});
    setShowForm(true);
  };

  const handleDelete = async (item: Item) => {
    if (!permissions.delete) return;
    if (confirm(`Delete Item "${item.name}" from the system?`)) {
      try {
        await deleteDoc(doc(db, "items", item.id));
        await logAudit(
          user.uid,
          user.email,
          "DELETE_ITEM",
          `Deleted Item ${item.name}`,
          item.id,
          "item"
        );
      } catch (error) {
        console.error("Error deleting item:", error);
      }
    }
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkError("");
    setBulkSuccess("");
    if (!bulkText.trim()) return;

    try {
      const parsedRows = parseBulkUpload(bulkText);
      if (parsedRows.length === 0) {
        setBulkError("Invalid data format. Please make sure you copy headers and at least one item row.");
        return;
      }

      let count = 0;
      for (const row of parsedRows) {
        // Find category match by name or fallback to first category
        const catName = row.category || row.categoryid || "";
        let matchedCat = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
        
        if (!matchedCat && categories.length > 0) {
          matchedCat = categories[0];
        }

        if (!matchedCat) continue;

        const itemName = row.name || row.item || "";
        if (!itemName) continue;

        const itemPayload = {
          categoryId: matchedCat.id,
          subcategory: row.subcategory || "",
          name: itemName,
          unit: row.unit || matchedCat.unitTypes[0] || "KG",
          cost: Number(row.cost || row.rate || 0),
          supplier: row.supplier || "Bulk Import",
          minStock: Number(row.minstock || row.min || 0),
          leadTime: Number(row.leadtime || 3),
          customFields: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, "items"), itemPayload);
        await logAudit(
          user.uid,
          user.email,
          "BULK_IMPORT_ITEM",
          `Uploaded Item ${itemPayload.name} in bulk`,
          docRef.id,
          "item"
        );
        count++;
      }

      setBulkSuccess(`Successfully imported ${count} items!`);
      setBulkText("");
      setTimeout(() => {
        setShowBulkModal(false);
        setBulkSuccess("");
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setBulkError("Bulk processing failed. Ensure columns align exactly.");
    }
  };

  // Build items combined with smart calculated metrics
  const enrichedItems = items.map((item) => {
    const metrics = calculateItemMetrics(item, transactions);
    return {
      ...item,
      categoryName: categories.find((c) => c.id === item.categoryId)?.name || "Unknown Category",
      metrics
    };
  });

  // Filter & Sort
  const filteredItems = enrichedItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.supplier.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategoryFilter === "" || item.categoryId === selectedCategoryFilter;
    const matchesStatus = stockStatusFilter === "" || item.metrics.status === stockStatusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Sort
  filteredItems.sort((a, b) => {
    let fieldA: any = a.name;
    let fieldB: any = b.name;

    if (sortBy === "cost") {
      fieldA = a.cost;
      fieldB = b.cost;
    } else if (sortBy === "stock") {
      fieldA = a.metrics.closingStock;
      fieldB = b.metrics.closingStock;
    }

    if (typeof fieldA === "string") {
      return sortOrder === "asc"
        ? fieldA.localeCompare(fieldB)
        : fieldB.localeCompare(fieldA);
    } else {
      return sortOrder === "asc" ? fieldA - fieldB : fieldB - fieldA;
    }
  });

  return (
    <div id="items-module" className="space-y-6">
      
      {/* Title section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Item Master</h2>
          <p className="text-xs text-slate-400">Add, track, configure raw materials, packaging, enzymes, and formulate ingredients</p>
        </div>
        <div className="flex gap-2">
          {permissions.create && (
            <>
              <button
                id="bulk-upload-btn"
                onClick={() => setShowBulkModal(true)}
                className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Spreadsheet Upload
              </button>
              <button
                id="add-item-btn"
                onClick={() => setShowForm(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md transition"
              >
                <Plus className="w-4 h-4" />
                New Item Entry
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dynamic Item Form */}
      {showForm && (
        <div id="item-form-card" className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex justify-between items-center pb-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-emerald-400" />
              {isEditing ? `Edit Item: ${name}` : "Create New Item Master Entry"}
            </h3>
            <button 
              onClick={handleResetForm} 
              className="text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Category selection */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Category Blueprint <span className="text-emerald-400">*</span></label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white"
                >
                  <option value="">-- Choose Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Subcategory */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Sub-category</label>
                <select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  disabled={!activeCategory || !activeCategory.subcategories || activeCategory.subcategories.length === 0}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white disabled:opacity-50"
                >
                  <option value="">-- Select Sub-category --</option>
                  {activeCategory?.subcategories?.map((sub, idx) => (
                    <option key={idx} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              {/* Item Name */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Item Name <span className="text-emerald-400">*</span></label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Yellow Corn Feed Grade"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Allowed unit */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Measurement Unit <span className="text-emerald-400">*</span></label>
                <select
                  required
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white"
                >
                  {activeCategory?.unitTypes?.map((u, i) => (
                    <option key={i} value={u}>{u}</option>
                  )) || (
                    <>
                      <option value="KG">KG</option>
                      <option value="Bag">Bag</option>
                      <option value="Ton">Ton</option>
                      <option value="Piece">Piece</option>
                    </>
                  )}
                </select>
              </div>

              {/* Cost / Rate */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Unit Cost (NPR ₹) <span className="text-emerald-400">*</span></label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                  placeholder="Rate per unit"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Supplier */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Primary Supplier</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. Purina Agro Industries"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Min Stock */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Safety Min Stock ({unit})</label>
                <input
                  type="number"
                  min="0"
                  value={minStock}
                  onChange={(e) => setMinStock(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Lead Time */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Reorder Lead Time (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={leadTime}
                  onChange={(e) => setLeadTime(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* DYNAMIC FORM SECTION: CUSTOM FIELDS DEFINED BY CATEGORY BLUEPRINT */}
            {activeCategory && activeCategory.customFields && activeCategory.customFields.length > 0 && (
              <div className="bg-slate-900/40 p-4 border border-slate-750 rounded-xl space-y-4">
                <div className="border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Category Configuration Parameters</span>
                  <span className="text-[10px] text-slate-400">Provide values for fields designed specifically for the "{activeCategory.name}" blueprint.</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {activeCategory.customFields.map((field) => (
                    <div key={field.name} className="space-y-1">
                      <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                        {field.name} {field.required && <span className="text-red-400">*</span>}
                      </label>
                      
                      {field.type === "select" ? (
                        <select
                          required={field.required}
                          value={customFieldValues[field.name] || ""}
                          onChange={(e) => setCustomFieldValues({
                            ...customFieldValues,
                            [field.name]: e.target.value
                          })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white"
                        >
                          <option value="">-- Choose Choice --</option>
                          {field.options?.map((opt, oIdx) => (
                            <option key={oIdx} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : "text"}
                          required={field.required}
                          step={field.type === "number" ? "any" : undefined}
                          value={customFieldValues[field.name] !== undefined ? customFieldValues[field.name] : ""}
                          onChange={(e) => setCustomFieldValues({
                            ...customFieldValues,
                            [field.name]: field.type === "number" ? Number(e.target.value) : e.target.value
                          })}
                          placeholder={`Enter ${field.name}`}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:outline-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <button
                type="button"
                onClick={handleResetForm}
                className="border border-slate-700 text-slate-300 hover:bg-slate-750 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition animate-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-5 py-2 rounded-lg text-xs font-bold cursor-pointer transition shadow-md"
              >
                {isEditing ? "Update Item" : "Register Item"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SEARCH AND FILTERS */}
      <div id="items-filter-bar" className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by item name or supplier..."
            className="w-full bg-slate-950 border border-slate-750 rounded-lg py-1.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Category & Status Filter */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          
          {/* Category */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-750 rounded-lg px-2 py-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer border-none py-0"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-750 rounded-lg px-2 py-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer border-none py-0"
            >
              <option value="">All Levels</option>
              <option value="Normal">🟢 Normal</option>
              <option value="Low">🟡 Low Stock</option>
              <option value="Critical">🔴 Critical</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-750 rounded-lg px-2 py-1">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer border-none py-0"
            >
              <option value="name">Name</option>
              <option value="cost">Rate</option>
              <option value="stock">Stock Level</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="text-slate-400 hover:text-white px-1 text-xs"
            >
              {sortOrder === "asc" ? "▲" : "▼"}
            </button>
          </div>
        </div>
      </div>

      {/* ITEMS LIST TABLE */}
      <div id="items-table-wrapper" className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 font-mono border-b border-slate-700">
              <tr>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider">Item Details</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider">Category</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Closing Stock</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">NPR Cost Rate</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Value (NPR)</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-center">Status</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Supplier</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {filteredItems.map((item) => {
                const stockVal = item.metrics.closingStock * item.cost;
                return (
                  <tr key={item.id} className="hover:bg-slate-750/30 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{item.name}</div>
                      {item.subcategory && (
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <span className="bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">{item.subcategory}</span>
                        </div>
                      )}
                      
                      {/* Dynamic Fields Value display */}
                      {item.customFields && Object.keys(item.customFields).length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {Object.entries(item.customFields).map(([k, v]) => (
                            <span key={k} className="text-[10px] bg-slate-900/80 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                              {k}: <span className="text-emerald-400">{v}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-300">
                      {item.categoryName}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold font-mono text-white">
                      {item.metrics.closingStock.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium">
                      {formatNPR(item.cost)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-300">
                      {formatNPR(stockVal)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${item.metrics.colorClass}`}>
                        {item.metrics.status === "Critical" ? "🔴 Critical" : item.metrics.status === "Low" ? "🟡 Low Stock" : "🟢 Normal"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-400 max-w-[150px] truncate" title={item.supplier}>
                      {item.supplier || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex justify-center gap-1.5">
                        {permissions.edit && (
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-slate-400 hover:text-white hover:bg-slate-700 p-1 rounded transition"
                            title="Edit Item Specs"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {permissions.delete && (
                          <button
                            onClick={() => handleDelete(item)}
                            className="text-slate-400 hover:text-red-400 hover:bg-slate-750 p-1 rounded transition"
                            title="Remove Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    <Grid3X3 className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                    <h5 className="font-semibold text-slate-300">No matching inventory items found</h5>
                    <p className="text-xs text-slate-500 mt-0.5">Adjust filters or create items dynamically.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SPREADSHEET BULK MODAL */}
      {showBulkModal && (
        <div id="bulk-upload-modal" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-700">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                Spreadsheet Bulk Upload
              </h3>
              <button 
                onClick={() => setShowBulkModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkUpload} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Instructions:</label>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Copy columns from Microsoft Excel or Google Sheets, including the headers, and paste them below. 
                  Allowed columns are: <code className="text-emerald-400 font-mono font-bold bg-slate-900 px-1 py-0.5 rounded">Name</code>, 
                  <code className="text-emerald-400 font-mono font-bold bg-slate-900 px-1 py-0.5 rounded">Category</code>, 
                  <code className="text-emerald-400 font-mono font-bold bg-slate-900 px-1 py-0.5 rounded">Unit</code>, 
                  <code className="text-emerald-400 font-mono font-bold bg-slate-900 px-1 py-0.5 rounded">Cost</code>, 
                  <code className="text-emerald-400 font-mono font-bold bg-slate-900 px-1 py-0.5 rounded">Supplier</code>, 
                  <code className="text-emerald-400 font-mono font-bold bg-slate-900 px-1 py-0.5 rounded">MinStock</code>, 
                  <code className="text-emerald-400 font-mono font-bold bg-slate-900 px-1 py-0.5 rounded">LeadTime</code>.
                </p>
              </div>

              {bulkError && (
                <div className="p-3 bg-red-900/30 border border-red-500/40 text-red-300 text-xs rounded-lg flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{bulkError}</span>
                </div>
              )}

              {bulkSuccess && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs rounded-lg flex items-center gap-1.5 font-medium">
                  <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
                  <span>{bulkSuccess}</span>
                </div>
              )}

              <div className="space-y-1">
                <textarea
                  required
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="Name&#9;Category&#9;Unit&#9;Cost&#9;Supplier&#9;MinStock&#9;LeadTime&#10;Corn Grains&#9;Raw Materials&#9;KG&#9;42&#9;Agro Supplier&#9;2000&#9;5"
                  rows={8}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="border border-slate-750 text-slate-300 hover:bg-slate-750 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-md"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Process & Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
