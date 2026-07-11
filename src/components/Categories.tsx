import React, { useState } from "react";
import { Category, CustomField, Permission } from "../types";
import { 
  db, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from "../firebase";
import { logAudit } from "../utils";
import { 
  Plus, 
  Trash2, 
  Settings, 
  Edit3, 
  Tag, 
  Layers, 
  CornerDownRight,
  ListPlus,
  X,
  FileSpreadsheet
} from "lucide-react";

interface CategoriesProps {
  categories: Category[];
  user: any;
  userProfile: any;
  permissions: Permission;
}

export default function Categories({ categories, user, userProfile, permissions }: CategoriesProps) {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [subInput, setSubInput] = useState("");
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [unitInput, setUnitInput] = useState("");
  const [unitTypes, setUnitTypes] = useState<string[]>(["KG", "Bag"]);
  
  // Custom Field Form State
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState<"text" | "number" | "select">("text");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState("");

  const handleAddSubcategory = () => {
    if (subInput.trim() && !subcategories.includes(subInput.trim())) {
      setSubcategories([...subcategories, subInput.trim()]);
      setSubInput("");
    }
  };

  const handleRemoveSubcategory = (index: number) => {
    setSubcategories(subcategories.filter((_, i) => i !== index));
  };

  const handleAddUnitType = () => {
    const formattedUnit = unitInput.trim().toUpperCase();
    if (formattedUnit && !unitTypes.includes(formattedUnit)) {
      setUnitTypes([...unitTypes, formattedUnit]);
      setUnitInput("");
    }
  };

  const handleRemoveUnitType = (index: number) => {
    setUnitTypes(unitTypes.filter((_, i) => i !== index));
  };

  const handleAddCustomField = () => {
    if (!fieldName.trim()) return;
    
    const newField: CustomField = {
      name: fieldName.trim(),
      type: fieldType,
      required: fieldRequired,
      options: fieldType === "select" && fieldOptions.trim()
        ? fieldOptions.split(",").map((o) => o.trim()).filter(Boolean)
        : undefined
    };

    setCustomFields([...customFields, newField]);
    setFieldName("");
    setFieldType("text");
    setFieldRequired(false);
    setFieldOptions("");
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleResetForm = () => {
    setName("");
    setSubcategories([]);
    setUnitTypes(["KG", "Bag", "Ton", "Piece"]);
    setCustomFields([]);
    setIsEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.create && !permissions.edit) return;

    try {
      const payload = {
        name: name.trim(),
        subcategories,
        unitTypes,
        customFields,
        createdAt: new Date().toISOString()
      };

      if (isEditing) {
        if (!permissions.edit) return;
        const catRef = doc(db, "categories", isEditing);
        await updateDoc(catRef, {
          name: payload.name,
          subcategories: payload.subcategories,
          unitTypes: payload.unitTypes,
          customFields: payload.customFields
        });
        await logAudit(
          user.uid,
          user.email,
          "EDIT_CATEGORY",
          `Updated category ${payload.name} with ${customFields.length} custom fields`,
          isEditing,
          "category"
        );
      } else {
        if (!permissions.create) return;
        const docRef = await addDoc(collection(db, "categories"), payload);
        await logAudit(
          user.uid,
          user.email,
          "CREATE_CATEGORY",
          `Created category ${payload.name} with subcategories: ${subcategories.join(", ")}`,
          docRef.id,
          "category"
        );
      }

      handleResetForm();
    } catch (error) {
      console.error("Error saving category:", error);
    }
  };

  const handleEdit = (category: Category) => {
    if (!permissions.edit) return;
    setIsEditing(category.id);
    setName(category.name);
    setSubcategories(category.subcategories || []);
    setUnitTypes(category.unitTypes || ["KG", "Bag"]);
    setCustomFields(category.customFields || []);
    setShowForm(true);
  };

  const handleDelete = async (category: Category) => {
    if (!permissions.delete) return;
    if (confirm(`Are you sure you want to delete Category "${category.name}"? All associated fields will be removed.`)) {
      try {
        await deleteDoc(doc(db, "categories", category.id));
        await logAudit(
          user.uid,
          user.email,
          "DELETE_CATEGORY",
          `Deleted category ${category.name}`,
          category.id,
          "category"
        );
      } catch (error) {
        console.error("Error deleting category:", error);
      }
    }
  };

  return (
    <div id="categories-module" className="space-y-6">
      
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Category Blueprint</h2>
          <p className="text-xs text-slate-400">Dynamically design raw materials, finished products, vitamins, enzymes, and custom categories</p>
        </div>
        {permissions.create && !showForm && (
          <button
            id="add-category-btn"
            onClick={() => setShowForm(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            Build New Category
          </button>
        )}
      </div>

      {/* Dynamic Builder Form */}
      {showForm && (
        <div id="category-builder-form" className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex justify-between items-center pb-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-400" />
              {isEditing ? "Configure Category Schema" : "Define New Category Blueprint"}
            </h3>
            <button 
              onClick={handleResetForm} 
              className="text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Column: Basic Details & Units */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Category Name <span className="text-emerald-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Raw Materials, Vitamins, Packaging"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Subcategories Block */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300 block">Subcategories / Sub-classes</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={subInput}
                      onChange={(e) => setSubInput(e.target.value)}
                      placeholder="Add subcategory (e.g. Grains, Powders)"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSubcategory())}
                    />
                    <button
                      type="button"
                      onClick={handleAddSubcategory}
                      className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer transition"
                    >
                      Add
                    </button>
                  </div>
                  
                  {subcategories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 bg-slate-950/40 p-2 border border-slate-700/50 rounded-lg">
                      {subcategories.map((sub, index) => (
                        <span 
                          key={index} 
                          className="bg-slate-700 text-slate-200 text-xxs font-semibold pl-2 pr-1.5 py-1 rounded flex items-center gap-1 border border-slate-600/50"
                        >
                          {sub}
                          <button 
                            type="button" 
                            onClick={() => handleRemoveSubcategory(index)}
                            className="text-slate-400 hover:text-red-400 transition"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Units Types Block */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300 block">Allowed Units <span className="text-emerald-400">*</span></label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={unitInput}
                      onChange={(e) => setUnitInput(e.target.value)}
                      placeholder="e.g. KG, BAG, TON, LITRE"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddUnitType())}
                    />
                    <button
                      type="button"
                      onClick={handleAddUnitType}
                      className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer transition"
                    >
                      Add
                    </button>
                  </div>
                  
                  {unitTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 bg-slate-950/40 p-2 border border-slate-700/50 rounded-lg">
                      {unitTypes.map((unit, index) => (
                        <span 
                          key={index} 
                          className="bg-emerald-950/30 text-emerald-300 text-xxs font-mono font-bold pl-2 pr-1.5 py-1 rounded flex items-center gap-1 border border-emerald-800/20"
                        >
                          {unit}
                          <button 
                            type="button" 
                            onClick={() => handleRemoveUnitType(index)}
                            className="text-slate-400 hover:text-red-400 transition"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Custom Field Builder (Dynamic Forms) */}
              <div className="space-y-4 bg-slate-900/30 border border-slate-700/30 p-4 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Dynamic Form Fields Builder</h4>
                  <p className="text-xxs text-slate-400 leading-normal">Configure unique custom input fields (e.g., "Moisture %", "Moisture Limit", "Supplier Batch Code", "Protein Content") so the items form adapt automatically.</p>
                </div>

                <div className="space-y-3 p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Field Label</label>
                      <input
                        type="text"
                        value={fieldName}
                        onChange={(e) => setFieldName(e.target.value)}
                        placeholder="e.g. Moisture Limit %"
                        className="w-full bg-slate-950 border border-slate-700 rounded py-1 px-2 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Data Type</label>
                      <select
                        value={fieldType}
                        onChange={(e) => setFieldType(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-700 rounded py-1 px-2 text-xs text-white"
                      >
                        <option value="text">Text / String</option>
                        <option value="number">Numeric / Decimal</option>
                        <option value="select">Dropdown Choice</option>
                      </select>
                    </div>
                    <div className="space-y-1 flex items-end justify-center pb-1">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={fieldRequired}
                          onChange={(e) => setFieldRequired(e.target.checked)}
                          className="rounded text-emerald-500 focus:ring-0 bg-slate-950 border-slate-700"
                        />
                        Required?
                      </label>
                    </div>
                  </div>

                  {fieldType === "select" && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Dropdown Options (Comma separated)</label>
                      <input
                        type="text"
                        value={fieldOptions}
                        onChange={(e) => setFieldOptions(e.target.value)}
                        placeholder="Premium, Standard, Economy"
                        className="w-full bg-slate-950 border border-slate-700 rounded py-1 px-2 text-xs text-white"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAddCustomField}
                    className="w-full bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <ListPlus className="w-3.5 h-3.5 text-emerald-400" />
                    Register Dynamic Field
                  </button>
                </div>

                {/* Configured Fields List */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Defined Schema Fields:</span>
                  
                  {customFields.length === 0 ? (
                    <p className="text-xxs text-slate-500 italic">No custom fields added yet. Only basic fields (Name, Unit, Cost, Supplier) will be collected.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {customFields.map((f, i) => (
                        <div 
                          key={i} 
                          className="bg-slate-950/60 border border-slate-850 p-2 rounded flex justify-between items-center"
                        >
                          <div>
                            <div className="text-xs font-semibold text-slate-200">
                              {f.name} {f.required && <span className="text-red-400">*</span>}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 capitalize">
                              Type: {f.type} {f.options && `[${f.options.join(", ")}]`}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomField(i)}
                            className="text-slate-500 hover:text-red-400 p-1 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <button
                type="button"
                onClick={handleResetForm}
                className="border border-slate-700 text-slate-300 hover:bg-slate-750 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-5 py-2 rounded-lg text-xs font-bold cursor-pointer transition shadow-md"
              >
                {isEditing ? "Save Configuration" : "Build Dynamic Category"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid of Existing Categories */}
      <div id="categories-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => (
          <div 
            key={category.id} 
            id={`category-card-${category.id}`}
            className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-5 shadow-sm space-y-4 hover:border-slate-600/80 transition group relative"
          >
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition">{category.name}</h4>
                  <span className="text-[10px] font-mono text-slate-500">ID: {category.id.slice(0, 8)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-1">
                {permissions.edit && (
                  <button
                    onClick={() => handleEdit(category)}
                    className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition"
                    title="Edit Scheme"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
                {permissions.delete && (
                  <button
                    onClick={() => handleDelete(category)}
                    className="text-slate-400 hover:text-red-400 p-1 rounded hover:bg-slate-700 transition"
                    title="Delete Category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Subcategories */}
            {category.subcategories && category.subcategories.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3 h-3 text-slate-500" /> Sub-categories:
                </span>
                <div className="flex flex-wrap gap-1">
                  {category.subcategories.map((sub, sIdx) => (
                    <span 
                      key={sIdx} 
                      className="bg-slate-900/60 text-slate-300 text-[10px] px-2 py-0.5 rounded border border-slate-700/40"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Allowed Units */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Measurement Units:
              </span>
              <div className="flex flex-wrap gap-1">
                {(category.unitTypes || ["KG"]).map((unit, uIdx) => (
                  <span 
                    key={uIdx} 
                    className="bg-emerald-950/20 text-emerald-400 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-900/10"
                  >
                    {unit}
                  </span>
                ))}
              </div>
            </div>

            {/* Custom Field Definitions */}
            <div className="space-y-1 border-t border-slate-700/60 pt-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Dynamically Built Fields ({category.customFields?.length || 0}):
              </span>
              {category.customFields && category.customFields.length > 0 ? (
                <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {category.customFields.map((f, fIdx) => (
                    <div 
                      key={fIdx} 
                      className="bg-slate-900/40 border border-slate-800 rounded p-1 text-[10px] text-slate-300 flex flex-col justify-center"
                    >
                      <span className="font-semibold truncate text-slate-200">{f.name}</span>
                      <span className="text-[9px] text-slate-500 capitalize">{f.type} {f.required ? "(Required)" : ""}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xxs text-slate-500 italic block">Only default parameters</span>
              )}
            </div>
          </div>
        ))}

        {categories.length === 0 && (
          <div className="col-span-full bg-slate-800/40 border border-slate-700/50 rounded-xl p-8 text-center text-slate-400">
            <Tag className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <h4 className="font-semibold text-sm text-slate-300">No categories created yet</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Build categories first to set up custom data fields and structural blueprints for your materials.</p>
          </div>
        )}
      </div>
    </div>
  );
}
