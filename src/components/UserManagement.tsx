import React, { useState } from "react";
import { UserProfile, Role, Permission } from "../types";
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
  ShieldAlert, 
  Users, 
  Plus, 
  Trash2, 
  X, 
  Check, 
  ShieldCheck, 
  Edit3,
  Unlock,
  Sliders
} from "lucide-react";

interface UserManagementProps {
  users: UserProfile[];
  roles: Role[];
  user: any;
  userProfile: any;
  permissions: Permission;
  companyName: string;
  onUpdateCompanyName: (name: string) => Promise<void>;
}

export default function UserManagement({ 
  users, 
  roles, 
  user, 
  userProfile, 
  permissions,
  companyName,
  onUpdateCompanyName
}: UserManagementProps) {
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [isEditingRoleId, setIsEditingRoleId] = useState<string | null>(null);

  // Company Name customization states
  const [newCompanyName, setNewCompanyName] = useState(companyName || "");
  const [savingCompany, setSavingCompany] = useState(false);

  // Keep state in sync with prop updates
  React.useEffect(() => {
    if (companyName) {
      setNewCompanyName(companyName);
    }
  }, [companyName]);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    try {
      setSavingCompany(true);
      await onUpdateCompanyName(newCompanyName.trim());
    } catch (err) {
      // Handled by parent
    } finally {
      setSavingCompany(false);
    }
  };

  // Role Form State
  const [roleName, setRoleName] = useState("");
  
  // Custom permissions matrix checkboxes
  const [pDashboard, setPDashboard] = useState<Permission>({ view: true, create: false, edit: false, delete: false });
  const [pCategories, setPCategories] = useState<Permission>({ view: true, create: false, edit: false, delete: false });
  const [pItems, setPItems] = useState<Permission>({ view: true, create: false, edit: false, delete: false });
  const [pTransactions, setPTransactions] = useState<Permission>({ view: true, create: false, edit: false, delete: false });
  const [pProduction, setPProduction] = useState<Permission>({ view: true, create: false, edit: false, delete: false });
  const [pReports, setPReports] = useState<Permission>({ view: true, create: false, edit: false, delete: false });
  const [pRoles, setPRoles] = useState<Permission>({ view: false, create: false, edit: false, delete: false });

  const handleResetForm = () => {
    setRoleName("");
    setPDashboard({ view: true, create: false, edit: false, delete: false });
    setPCategories({ view: true, create: false, edit: false, delete: false });
    setPItems({ view: true, create: false, edit: false, delete: false });
    setPTransactions({ view: true, create: false, edit: false, delete: false });
    setPProduction({ view: true, create: false, edit: false, delete: false });
    setPReports({ view: true, create: false, edit: false, delete: false });
    setPRoles({ view: false, create: false, edit: false, delete: false });
    setIsEditingRoleId(null);
    setShowRoleForm(false);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.create && !permissions.edit) return;

    if (!roleName.trim()) {
      alert("Role Name is required.");
      return;
    }

    try {
      const payload = {
        name: roleName.trim(),
        permissions: {
          dashboard: pDashboard,
          categories: pCategories,
          items: pItems,
          transactions: pTransactions,
          production: pProduction,
          reports: pReports,
          roles: pRoles
        }
      };

      if (isEditingRoleId) {
        if (!permissions.edit) return;
        await updateDoc(doc(db, "roles", isEditingRoleId), payload);
        await logAudit(
          user.uid,
          user.email,
          "EDIT_ROLE",
          `Updated custom permissions for role ${payload.name}`,
          isEditingRoleId,
          "role"
        );
      } else {
        if (!permissions.create) return;
        const docRef = await addDoc(collection(db, "roles"), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        await logAudit(
          user.uid,
          user.email,
          "CREATE_ROLE",
          `Registered custom role ${payload.name}`,
          docRef.id,
          "role"
        );
      }

      handleResetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditRole = (role: Role) => {
    if (!permissions.edit) return;
    setIsEditingRoleId(role.id);
    setRoleName(role.name);
    setPDashboard(role.permissions.dashboard || pDashboard);
    setPCategories(role.permissions.categories || pCategories);
    setPItems(role.permissions.items || pItems);
    setPTransactions(role.permissions.transactions || pTransactions);
    setPProduction(role.permissions.production || pProduction);
    setPReports(role.permissions.reports || pReports);
    setPRoles(role.permissions.roles || pRoles);
    setShowRoleForm(true);
  };

  const handleDeleteRole = async (role: Role) => {
    if (!permissions.delete) return;
    if (role.id === "super_admin" || role.id === "inventory_manager" || role.id === "production_manager") {
      alert("System default roles are locked and cannot be deleted.");
      return;
    }

    if (confirm(`Delete custom role "${role.name}"? Users assigned to this role will lose write permissions.`)) {
      try {
        await deleteDoc(doc(db, "roles", role.id));
        await logAudit(
          user.uid,
          user.email,
          "DELETE_ROLE",
          `Removed custom role ${role.name}`,
          role.id,
          "role"
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAssignRole = async (userId: string, newRole: string) => {
    if (!permissions.edit) return;
    try {
      await updateDoc(doc(db, "userProfiles", userId), {
        role: newRole
      });
      const affectedUser = users.find((u) => u.id === userId);
      await logAudit(
        user.uid,
        user.email,
        "ASSIGN_USER_ROLE",
        `Assigned role "${newRole}" to user ${affectedUser?.email}`,
        userId,
        "user_profile"
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    if (!permissions.edit) return;
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      await updateDoc(doc(db, "userProfiles", userId), {
        status: newStatus
      });
      const affectedUser = users.find((u) => u.id === userId);
      await logAudit(
        user.uid,
        user.email,
        "TOGGLE_USER_STATUS",
        `Set status of ${affectedUser?.email} to ${newStatus}`,
        userId,
        "user_profile"
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div id="users-module" className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Security & RBAC Controls</h2>
          <p className="text-xs text-slate-400">Design dynamic roles, modify granular module permissions, and manage factory personnel active profiles</p>
        </div>
        {permissions.create && !showRoleForm && (
          <button
            id="create-role-btn"
            onClick={() => setShowRoleForm(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            Build Dynamic Role
          </button>
        )}
      </div>

      {/* COMPANY SETTINGS CARD */}
      <div id="company-profile-settings" className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Company Profile Settings</h3>
        </div>
        <form onSubmit={handleSaveCompany} className="flex flex-col sm:flex-row items-end gap-3 max-w-xl">
          <div className="flex-1 space-y-1 w-full">
            <label className="text-xs font-semibold text-slate-300 block">Set Company / Factory Name</label>
            <input
              type="text"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="e.g. MIS Industry"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={savingCompany || !newCompanyName.trim()}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md transition whitespace-nowrap h-9"
          >
            {savingCompany ? "Saving..." : "Update Name"}
          </button>
        </form>
      </div>

      {/* DYNAMIC ROLE CONFIGURATION FORM */}
      {showRoleForm && (
        <div id="role-builder-form" className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex justify-between items-center pb-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              {isEditingRoleId ? `Configure Custom Role: ${roleName}` : "Build Dynamic Role Permissions Blueprint"}
            </h3>
            <button 
              onClick={handleResetForm} 
              className="text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveRole} className="space-y-6">
            <div className="space-y-1 max-w-sm">
              <label className="text-xs font-medium text-slate-300">Custom Role Designation <span className="text-emerald-400">*</span></label>
              <input
                type="text"
                required
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Shift Inventory Auditor"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Checkbox Permission Matrix */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Granular Module Permissions Grid</span>
              
              <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-950/20">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/60 text-slate-400 font-mono border-b border-slate-750">
                    <tr>
                      <th className="py-2.5 px-4">System Module</th>
                      <th className="py-2.5 px-4 text-center">View (Read)</th>
                      <th className="py-2.5 px-4 text-center">Create (Write)</th>
                      <th className="py-2.5 px-4 text-center">Edit (Modify)</th>
                      <th className="py-2.5 px-4 text-center">Delete (Purge)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    
                    {/* Dashboard */}
                    <tr>
                      <td className="py-2 px-4 font-semibold text-white">1. Dashboard Analytics</td>
                      <td className="text-center"><input type="checkbox" checked={pDashboard.view} onChange={(e) => setPDashboard({...pDashboard, view: e.target.checked})} /></td>
                      <td className="text-center">—</td>
                      <td className="text-center">—</td>
                      <td className="text-center">—</td>
                    </tr>

                    {/* Categories */}
                    <tr>
                      <td className="py-2 px-4 font-semibold text-white">2. Category Architect</td>
                      <td className="text-center"><input type="checkbox" checked={pCategories.view} onChange={(e) => setPCategories({...pCategories, view: e.target.checked})} /></td>
                      <td className="text-center"><input type="checkbox" checked={pCategories.create} onChange={(e) => setPCategories({...pCategories, create: e.target.checked})} /></td>
                      <td className="text-center"><input type="checkbox" checked={pCategories.edit} onChange={(e) => setPCategories({...pCategories, edit: e.target.checked})} /></td>
                      <td className="text-center"><input type="checkbox" checked={pCategories.delete} onChange={(e) => setPCategories({...pCategories, delete: e.target.checked})} /></td>
                    </tr>

                    {/* Items */}
                    <tr>
                      <td className="py-2 px-4 font-semibold text-white">3. Item Master (Specifications)</td>
                      <td className="text-center"><input type="checkbox" checked={pItems.view} onChange={(e) => setPItems({...pItems, view: e.target.checked})} /></td>
                      <td className="text-center"><input type="checkbox" checked={pItems.create} onChange={(e) => setPItems({...pItems, create: e.target.checked})} /></td>
                      <td className="text-center"><input type="checkbox" checked={pItems.edit} onChange={(e) => setPItems({...pItems, edit: e.target.checked})} /></td>
                      <td className="text-center"><input type="checkbox" checked={pItems.delete} onChange={(e) => setPItems({...pItems, delete: e.target.checked})} /></td>
                    </tr>

                    {/* Transactions */}
                    <tr>
                      <td className="py-2 px-4 font-semibold text-white">4. Ledger Transactions (Stock In/Out)</td>
                      <td className="text-center"><input type="checkbox" checked={pTransactions.view} onChange={(e) => setPTransactions({...pTransactions, view: e.target.checked})} /></td>
                      <td className="text-center"><input type="checkbox" checked={pTransactions.create} onChange={(e) => setPTransactions({...pTransactions, create: e.target.checked})} /></td>
                      <td className="text-center"><input type="checkbox" checked={pTransactions.edit} onChange={(e) => setPTransactions({...pTransactions, edit: e.target.checked})} /></td>
                      <td className="text-center"><input type="checkbox" checked={pTransactions.delete} onChange={(e) => setPTransactions({...pTransactions, delete: e.target.checked})} /></td>
                    </tr>

                    {/* Production */}
                    <tr>
                      <td className="py-2 px-4 font-semibold text-white">5. Factory Formulations (BOM & Runs)</td>
                      <td className="text-center"><input type="checkbox" checked={pProduction.view} onChange={(e) => setPProduction({...pProduction, view: e.target.checked})} /></td>
                      <td className="text-center"><input type="checkbox" checked={pProduction.create} onChange={(e) => setPProduction({...pProduction, create: e.target.checked})} /></td>
                      <td className="text-center"><input type="checkbox" checked={pProduction.edit} onChange={(e) => setPProduction({...pProduction, edit: e.target.checked})} /></td>
                      <td className="text-center"><input type="checkbox" checked={pProduction.delete} onChange={(e) => setPProduction({...pProduction, delete: e.target.checked})} /></td>
                    </tr>

                    {/* Reports */}
                    <tr>
                      <td className="py-2 px-4 font-semibold text-white">6. Executive Reports (MIS)</td>
                      <td className="text-center"><input type="checkbox" checked={pReports.view} onChange={(e) => setPReports({...pReports, view: e.target.checked})} /></td>
                      <td className="text-center">—</td>
                      <td className="text-center">—</td>
                      <td className="text-center">—</td>
                    </tr>

                    {/* Security Management */}
                    <tr>
                      <td className="py-2 px-4 font-semibold text-white">7. Security RBAC Admin</td>
                      <td className="text-center"><input type="checkbox" checked={pRoles.view} onChange={(e) => setPRoles({...pRoles, view: e.target.checked})} /></td>
                      <td className="text-center"><input type="checkbox" checked={pRoles.create} onChange={(e) => setPRoles({...pRoles, create: e.target.checked})} /></td>
                      <td className="text-center"><input type="checkbox" checked={pRoles.edit} onChange={(e) => setPRoles({...pRoles, edit: e.target.checked})} /></td>
                      <td className="text-center"><input type="checkbox" checked={pRoles.delete} onChange={(e) => setPRoles({...pRoles, delete: e.target.checked})} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-700">
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
                {isEditingRoleId ? "Save Changes" : "Register Dynamic Role"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid of registered Roles & Users list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Roles List */}
        <div className="lg:col-span-1 bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-700 pb-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Defined Roles Matrix</h3>
          </div>

          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
            {roles.map((r) => (
              <div 
                key={r.id} 
                className="p-3 bg-slate-900/60 border border-slate-750 rounded-lg flex justify-between items-center group hover:border-slate-650 transition"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-200">{r.name}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {r.id.slice(0, 8)}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  {permissions.edit && (
                    <button
                      onClick={() => handleEditRole(r)}
                      className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition"
                      title="Configure"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {permissions.delete && r.id !== "super_admin" && r.id !== "inventory_manager" && r.id !== "production_manager" && (
                    <button
                      onClick={() => handleDeleteRole(r)}
                      className="text-slate-400 hover:text-red-400 p-1 hover:bg-slate-800 rounded transition"
                      title="Purge"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Registered Users List */}
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-700 pb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white font-sans">Active Factory Personnel</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/60 text-slate-400 font-mono border-b border-slate-700">
                <tr>
                  <th className="py-2 px-3">Registered User</th>
                  <th className="py-2 px-3">Email</th>
                  <th className="py-2 px-3">Assigned Role</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-center">System Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {users.map((profile) => (
                  <tr key={profile.id} className="hover:bg-slate-750/30 transition">
                    <td className="py-3 px-3 font-semibold text-white">{profile.displayName || "Google Personnel"}</td>
                    <td className="py-3 px-3 font-mono text-slate-400">{profile.email}</td>
                    <td className="py-3 px-3">
                      {permissions.edit && profile.id !== user.uid ? (
                        <select
                          value={profile.role || "viewer"}
                          onChange={(e) => handleAssignRole(profile.id, e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded py-1 px-2 text-[11px] text-slate-300"
                        >
                          <option value="viewer">Viewer / Guest</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-semibold text-emerald-400 text-xs uppercase font-mono bg-emerald-505/10">
                          {roles.find((r) => r.id === profile.role)?.name || profile.role || "Viewer"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                        profile.status === "active" 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                          : "bg-red-500/10 text-red-400 border-red-500/20"
                      }`}>
                        {profile.status === "active" ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {permissions.edit && profile.id !== user.uid ? (
                        <button
                          onClick={() => handleToggleUserStatus(profile.id, profile.status)}
                          className="text-xs hover:underline cursor-pointer text-slate-400 hover:text-white"
                        >
                          {profile.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      ) : (
                        <span className="text-xxs font-mono text-slate-500">Locked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
