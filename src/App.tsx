import React, { useState, useEffect } from "react";
import { 
  auth, 
  db, 
  onAuthStateChanged, 
  signOut,
  collection, 
  onSnapshot,
  setLocalSessionActive,
  isLocalSession,
  doc,
  setDoc
} from "./firebase";
import { UserProfile, Role, Category, Item, Transaction, Production, AuditLog } from "./types";
import { logAudit } from "./utils";

import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Categories from "./components/Categories";
import Items from "./components/Items";
import Transactions from "./components/Transactions";
import ProductionModule from "./components/Production";
import Reports from "./components/Reports";
import UserManagement from "./components/UserManagement";
import AuditLogView from "./components/AuditLogView";

import { 
  Warehouse, 
  LayoutDashboard, 
  Tag, 
  Grid3X3, 
  FileText, 
  Zap, 
  BarChart3, 
  ShieldCheck, 
  History, 
  LogOut,
  User,
  Menu,
  X,
  Settings,
  Search,
  Bell
} from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Company Profile Settings States
  const [companyName, setCompanyName] = useState<string>("MIS Industry");
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [tempCompanyName, setTempCompanyName] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  // Firestore Data States
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Navigation / UI States
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 1. Listen for Authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setLocalSessionActive(false);
      }
      setCurrentUser(user);
      if (!user) {
        setLocalSessionActive(false);
        setCurrentUserProfile(null);
        setAuthLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // 2. Fetch User Profile & Start Real-time listens once authenticated
  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.isLocal) {
      setLocalSessionActive(true);

      const defaultCategories = [
        {
          id: "cat_raw",
          name: "Raw Materials",
          subcategories: ["Maize", "Soya Meal", "Wheat Bran", "Vitamin Premix"],
          unitTypes: ["KG", "Bag", "Ton"],
          customFields: [
            { name: "Moisture %", type: "number", required: true },
            { name: "Protein %", type: "number", required: false }
          ],
          createdAt: new Date().toISOString()
        },
        {
          id: "cat_finished",
          name: "Finished Goods",
          subcategories: ["Poultry Feed Starter", "Poultry Feed Broiler", "Cattle Feed Premium"],
          unitTypes: ["Bag", "Ton"],
          customFields: [
            { name: "Batch Ref", type: "text", required: true }
          ],
          createdAt: new Date().toISOString()
        }
      ];

      const defaultItems = [
        {
          id: "item_maize",
          categoryId: "cat_raw",
          subcategory: "Maize",
          name: "Yellow Maize Premium",
          unit: "KG",
          cost: 42.50,
          supplier: "Valley Farms Ltd",
          minStock: 2000,
          leadTime: 3,
          customFields: { "Moisture %": 12.5, "Protein %": 9 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "item_soya",
          categoryId: "cat_raw",
          subcategory: "Soya Meal",
          name: "High-Protein Soya Meal",
          unit: "KG",
          cost: 85.00,
          supplier: "Himalayan Agro",
          minStock: 1500,
          leadTime: 5,
          customFields: { "Moisture %": 11, "Protein %": 46 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "item_feed_a",
          categoryId: "cat_finished",
          subcategory: "Poultry Feed Starter",
          name: "Poultry Feed Broiler Starter",
          unit: "Bag",
          cost: 2600.00,
          supplier: "Self Produced",
          minStock: 100,
          leadTime: 1,
          customFields: { "Batch Ref": "BATCH-2026-01" },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const defaultTx = [
        {
          id: "tx_1",
          date: new Date().toISOString().split('T')[0],
          type: "STOCK_IN",
          itemId: "item_maize",
          quantity: 10000,
          rate: 42.50,
          total: 425000,
          supplier: "Valley Farms Ltd",
          billNo: "BL-9912",
          createdBy: currentUser.uid,
          createdAt: new Date().toISOString()
        },
        {
          id: "tx_2",
          date: new Date().toISOString().split('T')[0],
          type: "STOCK_IN",
          itemId: "item_soya",
          quantity: 5000,
          rate: 85.00,
          total: 425000,
          supplier: "Himalayan Agro",
          billNo: "BL-9915",
          createdBy: currentUser.uid,
          createdAt: new Date().toISOString()
        },
        {
          id: "tx_3",
          date: new Date().toISOString().split('T')[0],
          type: "STOCK_OUT",
          itemId: "item_maize",
          quantity: 2000,
          rate: 42.50,
          total: 85000,
          purpose: "Production",
          createdBy: currentUser.uid,
          createdAt: new Date().toISOString()
        }
      ];

      const defaultProductions = [
        {
          id: "prod_1",
          date: new Date().toISOString().split('T')[0],
          batchId: "BATCH-2026-01",
          finishedGoodsItemId: "item_feed_a",
          outputQuantity: 40,
          totalCost: 104000,
          averageCostPerUnit: 2600.00,
          inputs: [
            { itemId: "item_maize", quantity: 2000, rate: 42.50, total: 85000 },
            { itemId: "item_soya", quantity: 223.5, rate: 85.00, total: 19000 }
          ],
          createdBy: currentUser.uid,
          createdAt: new Date().toISOString()
        }
      ];

      const defaultRoles = [
        {
          id: "super_admin",
          name: "Super Admin",
          permissions: {
            dashboard: { view: true, create: true, edit: true, delete: true },
            categories: { view: true, create: true, edit: true, delete: true },
            items: { view: true, create: true, edit: true, delete: true },
            transactions: { view: true, create: true, edit: true, delete: true },
            production: { view: true, create: true, edit: true, delete: true },
            reports: { view: true, create: true, edit: true, delete: true },
            roles: { view: true, create: true, edit: true, delete: true }
          },
          createdAt: new Date().toISOString()
        },
        {
          id: "inventory_manager",
          name: "Inventory Manager",
          permissions: {
            dashboard: { view: true, create: true, edit: true, delete: true },
            categories: { view: true, create: true, edit: true, delete: true },
            items: { view: true, create: true, edit: true, delete: true },
            transactions: { view: true, create: true, edit: true, delete: true },
            production: { view: true, create: false, edit: false, delete: false },
            reports: { view: true, create: true, edit: true, delete: true },
            roles: { view: true, create: false, edit: false, delete: false }
          },
          createdAt: new Date().toISOString()
        },
        {
          id: "production_manager",
          name: "Production Manager",
          permissions: {
            dashboard: { view: true, create: true, edit: true, delete: true },
            categories: { view: true, create: false, edit: false, delete: false },
            items: { view: true, create: false, edit: false, delete: false },
            transactions: { view: true, create: true, edit: true, delete: true },
            production: { view: true, create: true, edit: true, delete: true },
            reports: { view: true, create: true, edit: true, delete: true },
            roles: { view: true, create: false, edit: false, delete: false }
          },
          createdAt: new Date().toISOString()
        }
      ];

      const defaultProfiles = [
        {
          id: currentUser.uid,
          email: currentUser.email || "local_admin@mis-industry.com",
          displayName: currentUser.displayName || "Local Sandbox Admin",
          role: currentUser.role || "super_admin",
          status: "active",
          createdAt: new Date().toISOString()
        }
      ];

      const defaultLogs = [
        {
          id: "log_1",
          timestamp: new Date().toISOString(),
          userId: currentUser.uid,
          userEmail: currentUser.email || "local_admin@mis-industry.com",
          action: "INITIALIZE_SANDBOX",
          details: "MIS Inventory Local Sandbox environment configured",
          entityId: "system",
          entityType: "System"
        }
      ];

      const defaultSettings = [
        {
          id: "company_profile",
          companyName: "MIS Industry",
          updatedAt: new Date().toISOString()
        }
      ];

      const setIfEmpty = (colName: string, defaults: any[]) => {
        const stored = localStorage.getItem(`local_db_${colName}`);
        if (!stored || stored === "{}" || stored === "[]") {
          const dict: Record<string, any> = {};
          defaults.forEach(item => {
            dict[item.id] = item;
          });
          localStorage.setItem(`local_db_${colName}`, JSON.stringify(dict));
        }
      };

      setIfEmpty("categories", defaultCategories);
      setIfEmpty("items", defaultItems);
      setIfEmpty("transactions", defaultTx);
      setIfEmpty("productions", defaultProductions);
      setIfEmpty("roles", defaultRoles);
      setIfEmpty("userProfiles", defaultProfiles);
      setIfEmpty("auditLogs", defaultLogs);
      setIfEmpty("settings", defaultSettings);
    }

    // Listen to User Profile of active user
    const unsubProfile = onSnapshot(collection(db, "userProfiles"), (snapshot) => {
      let foundProfile: UserProfile | null = null;
      const profilesList: UserProfile[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<UserProfile, "id">;
        const prof = { id: doc.id, ...data } as UserProfile;
        profilesList.push(prof);
        if (doc.id === currentUser.uid) {
          foundProfile = prof;
        }
      });

      setUserProfiles(profilesList);
      if (foundProfile) {
        setCurrentUserProfile(foundProfile);
      } else {
        // Fallback user profile in case registration was slow
        setCurrentUserProfile({
          id: currentUser.uid,
          email: currentUser.email || "",
          displayName: currentUser.displayName || "Viewer",
          role: currentUser.role || "super_admin", // Default initial user as admin
          status: "active",
          createdAt: new Date().toISOString()
        });
      }
      setAuthLoading(false);
    }, (error) => {
      console.warn("UserProfiles snapshot error:", error.message);
    });

    // Real-time listen to Roles
    const unsubRoles = onSnapshot(collection(db, "roles"), (snapshot) => {
      const loaded: Role[] = [];
      snapshot.forEach((doc) => {
        loaded.push({ id: doc.id, ...doc.data() } as Role);
      });
      setRoles(loaded);
    }, (error) => {
      console.warn("Roles snapshot error:", error.message);
    });

    // Real-time listen to Categories
    const unsubCategories = onSnapshot(collection(db, "categories"), (snapshot) => {
      const loaded: Category[] = [];
      snapshot.forEach((doc) => {
        loaded.push({ id: doc.id, ...doc.data() } as Category);
      });
      setCategories(loaded);
    }, (error) => {
      console.warn("Categories snapshot error:", error.message);
    });

    // Real-time listen to Items
    const unsubItems = onSnapshot(collection(db, "items"), (snapshot) => {
      const loaded: Item[] = [];
      snapshot.forEach((doc) => {
        loaded.push({ id: doc.id, ...doc.data() } as Item);
      });
      setItems(loaded);
    }, (error) => {
      console.warn("Items snapshot error:", error.message);
    });

    // Real-time listen to Transactions
    const unsubTx = onSnapshot(collection(db, "transactions"), (snapshot) => {
      const loaded: Transaction[] = [];
      snapshot.forEach((doc) => {
        loaded.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(loaded);
    }, (error) => {
      console.warn("Transactions snapshot error:", error.message);
    });

    // Real-time listen to Productions
    const unsubProductions = onSnapshot(collection(db, "productions"), (snapshot) => {
      const loaded: Production[] = [];
      snapshot.forEach((doc) => {
        loaded.push({ id: doc.id, ...doc.data() } as Production);
      });
      setProductions(loaded);
    }, (error) => {
      console.warn("Productions snapshot error:", error.message);
    });

    // Real-time listen to Audit Logs
    const unsubLogs = onSnapshot(collection(db, "auditLogs"), (snapshot) => {
      const loaded: AuditLog[] = [];
      snapshot.forEach((doc) => {
        loaded.push({ id: doc.id, ...doc.data() } as AuditLog);
      });
      setAuditLogs(loaded);
    }, (error) => {
      console.warn("AuditLogs snapshot error:", error.message);
    });

    // Real-time listen to Settings
    const unsubSettings = onSnapshot(collection(db, "settings"), (snapshot) => {
      snapshot.forEach((doc) => {
        if (doc.id === "company_profile") {
          const data = doc.data();
          if (data && data.companyName) {
            setCompanyName(data.companyName);
          }
        }
      });
    }, (error) => {
      console.warn("Settings snapshot error:", error.message);
    });

    return () => {
      unsubProfile();
      unsubRoles();
      unsubCategories();
      unsubItems();
      unsubTx();
      unsubProductions();
      unsubLogs();
      unsubSettings();
    };
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      setLocalSessionActive(false);
      // Only call signOut if it's not a local fake user session
      if (currentUser && !currentUser.isLocal) {
        await signOut(auth);
      } else {
        setCurrentUser(null);
        setCurrentUserProfile(null);
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleAuthSuccess = (user: any, profile: any) => {
    setCurrentUser(user);
    setCurrentUserProfile(profile);
  };

  const handleUpdateCompanyName = async (name: string) => {
    if (!name.trim()) return;
    try {
      setSavingCompany(true);
      await setDoc(doc(db, "settings", "company_profile"), {
        companyName: name.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Log to audit log if currentUser is available
      if (currentUser) {
        await logAudit(
          currentUser.uid,
          currentUser.email || "unknown@mis.com",
          "UPDATE_COMPANY_NAME",
          `Updated company name to ${name.trim()}`,
          "company_profile",
          "Settings"
        );
      }
      
      setCompanyName(name.trim());
      setIsCompanyModalOpen(false);
    } catch (err: any) {
      console.warn("Failed to update company name:", err.message || err);
      alert("Failed to save company name: " + (err.message || "Unknown error"));
    } finally {
      setSavingCompany(false);
    }
  };

  // 3. Dynamic Permission calculations based on assigned role
  const getTabPermissions = (module: string) => {
    const fullAccess = { view: true, create: true, edit: true, delete: true };
    const noAccess = { view: false, create: false, edit: false, delete: false };

    if (!currentUserProfile) return noAccess;
    
    // Super Admin gets unrestricted full access
    if (currentUserProfile.role === "super_admin") return fullAccess;

    // Find assigned custom role permissions
    const assignedRoleObj = roles.find((r) => r.id === currentUserProfile.role || r.name === currentUserProfile.role);
    if (!assignedRoleObj) {
      // Default Guest/Viewer permissions
      return {
        view: ["dashboard", "categories", "items", "transactions", "production", "reports"].includes(module),
        create: false,
        edit: false,
        delete: false
      };
    }

    const m = module as keyof typeof assignedRoleObj.permissions;
    return assignedRoleObj.permissions[m] || noAccess;
  };

  const activeTabPermissions = getTabPermissions(activeTab);

  if (authLoading) {
    return (
      <div id="loading-fallback" className="min-h-screen bg-slate-900 flex flex-col items-center justify-center font-sans">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <span className="text-sm font-semibold text-slate-300">Syncing Ledger Connection...</span>
      </div>
    );
  }

  if (!currentUser || !currentUserProfile) {
    return <Login onAuthSuccess={handleAuthSuccess} />;
  }

  // Define sidebar menu items based on dynamic module permissions
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "categories", label: "Category Blueprint", icon: Tag },
    { id: "items", label: "Item Master", icon: Grid3X3 },
    { id: "transactions", label: "Ledger Operations", icon: FileText },
    { id: "production", label: "Factory Production", icon: Zap },
    { id: "reports", label: "Executive Reports", icon: BarChart3 },
    { id: "roles", label: "RBAC Security", icon: ShieldCheck, requiredRoleAdmin: true },
    { id: "audit", label: "Audit Trails", icon: History, requiredRoleAdmin: true }
  ];

  const visibleMenuItems = menuItems.filter((item) => {
    if (item.requiredRoleAdmin) {
      // Only show RBAC & Audit to Super Admin or users with explicit roles permissions
      return currentUserProfile.role === "super_admin" || getTabPermissions("roles").view;
    }
    return getTabPermissions(item.id).view;
  });

  return (
    <div id="app-workspace" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* MOBILE HEADER BAR */}
      <header className="lg:hidden bg-slate-900 border-b border-slate-800 py-3 px-4 flex items-center justify-between sticky top-0 z-40 print:hidden">
        <div 
          className="flex items-center gap-2 cursor-pointer hover:text-blue-400 transition"
          onClick={() => {
            setTempCompanyName(companyName);
            setIsCompanyModalOpen(true);
          }}
          title="Click to edit Company Name"
        >
          <Warehouse className="w-5 h-5 text-blue-500" />
          <span className="font-bold text-white text-sm tracking-tight">{companyName}</span>
          <Settings className="w-3 h-3 text-slate-500 hover:text-blue-400" />
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
          className="text-slate-400 hover:text-white transition"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* DESKTOP SIDEBAR PANEL */}
        <aside 
          className={`w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between fixed inset-y-0 left-0 z-30 transform lg:transform-none lg:static transition-transform duration-200 print:hidden ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-0 lg:translate-x-0"
          } ${mobileMenuOpen ? "block" : "hidden lg:flex"}`}
        >
          <div className="p-5 space-y-6">
            
            {/* Logo with Dynamic Company Name */}
            <div className="hidden lg:flex items-center justify-between border-b border-slate-800 pb-5 group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center">
                  <Warehouse className="w-5 h-5" />
                </div>
                <div className="max-w-[120px] overflow-hidden">
                  <h1 className="text-sm font-black text-white tracking-wider uppercase font-sans truncate" title={companyName}>
                    {companyName}
                  </h1>
                  <span className="text-[10px] text-blue-400 font-bold tracking-widest uppercase font-mono">Operations Unit</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setTempCompanyName(companyName);
                  setIsCompanyModalOpen(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition cursor-pointer"
                title="Edit Company Name"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Navigation links */}
            <nav className="space-y-1">
              {visibleMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-2.5 transition cursor-pointer ${
                      isActive 
                        ? "bg-blue-600 text-white font-bold shadow-md" 
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User profile section at the bottom */}
          <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-950/20">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-white truncate">{currentUserProfile.displayName}</h4>
                <p className="text-[10px] text-slate-500 truncate capitalize">
                  Role: {roles.find((r) => r.id === currentUserProfile.role)?.name || currentUserProfile.role}
                </p>
              </div>
            </div>

            <button
              id="logout-btn"
              onClick={handleLogout}
              className="w-full bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white text-[11px] font-semibold py-1.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition border border-slate-700/50 hover:border-red-600"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out Securely
            </button>
          </div>
        </aside>

        {/* RIGHT CONTAINER WRAPPER WITH TOP NAVBAR */}
        <div className="flex-1 flex flex-col overflow-hidden w-full">
          
          {/* TOP NAVBAR */}
          <header className="bg-white border-b border-slate-200/80 h-16 px-6 flex items-center justify-between sticky top-0 z-20 print:hidden shadow-sm flex-shrink-0">
            {/* Search bar */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 w-64 md:w-80">
              <Search className="w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search items, categories, ledger..." 
                className="bg-transparent border-none text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 p-0 w-full"
              />
            </div>

            {/* Notifications & Active User info */}
            <div className="flex items-center gap-4">
              <button className="relative p-1.5 text-slate-400 hover:text-blue-600 transition hover:bg-slate-50 rounded-lg cursor-pointer">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
              </button>
              
              <div className="h-6 w-[1px] bg-slate-200"></div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-extrabold text-xs">
                  {currentUserProfile.displayName ? currentUserProfile.displayName.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="hidden sm:block text-left leading-none">
                  <p className="text-xs font-bold text-slate-800">{currentUserProfile.displayName}</p>
                  <p className="text-[10px] text-slate-400 capitalize mt-0.5">
                    {roles.find((r) => r.id === currentUserProfile.role)?.name || currentUserProfile.role}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* MAIN WORKSPACE WRAPPER */}
          <main className="flex-1 bg-slate-50 p-4 sm:p-6 md:p-8 overflow-y-auto w-full print:p-0">
            
            {/* Main content viewport */}
            <div className="max-w-7xl mx-auto space-y-6">
            
            {activeTab === "dashboard" && (
              <Dashboard 
                items={items} 
                categories={categories} 
                transactions={transactions} 
                productions={productions} 
                onNavigate={(tab) => setActiveTab(tab)} 
              />
            )}

            {activeTab === "categories" && (
              <Categories 
                categories={categories} 
                user={currentUser} 
                userProfile={currentUserProfile} 
                permissions={activeTabPermissions} 
              />
            )}

            {activeTab === "items" && (
              <Items 
                items={items} 
                categories={categories} 
                transactions={transactions} 
                user={currentUser} 
                userProfile={currentUserProfile} 
                permissions={activeTabPermissions} 
              />
            )}

            {activeTab === "transactions" && (
              <Transactions 
                transactions={transactions} 
                items={items} 
                user={currentUser} 
                userProfile={currentUserProfile} 
                permissions={activeTabPermissions} 
              />
            )}

            {activeTab === "production" && (
              <ProductionModule 
                productions={productions} 
                items={items} 
                categories={categories} 
                transactions={transactions} 
                user={currentUser} 
                userProfile={currentUserProfile} 
                permissions={activeTabPermissions} 
              />
            )}

            {activeTab === "reports" && (
              <Reports 
                items={items} 
                categories={categories} 
                transactions={transactions} 
                productions={productions} 
                permissions={activeTabPermissions} 
              />
            )}

            {activeTab === "roles" && (
              <UserManagement 
                users={userProfiles} 
                roles={roles} 
                user={currentUser} 
                userProfile={currentUserProfile} 
                permissions={activeTabPermissions} 
                companyName={companyName}
                onUpdateCompanyName={handleUpdateCompanyName}
              />
            )}

            {activeTab === "audit" && (
              <AuditLogView logs={auditLogs} />
            )}
          </div>
        </main>
        </div>
      </div>

      {/* Dynamic Company Name Configuration Modal */}
      {isCompanyModalOpen && (
        <div id="company-name-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-750 pb-3">
              <div className="flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Update Company Profile</h3>
              </div>
              <button 
                onClick={() => setIsCompanyModalOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-30 block">Workspace / Company Name</label>
                <input
                  type="text"
                  required
                  value={tempCompanyName}
                  onChange={(e) => setTempCompanyName(e.target.value)}
                  placeholder="e.g. MIS Industry"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Updating the company profile changes the name displayed across the active ledger system, headers, and reports for all factory personnel.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-750">
              <button
                onClick={() => setIsCompanyModalOpen(false)}
                className="border border-slate-700 text-slate-300 hover:bg-slate-750 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateCompanyName(tempCompanyName)}
                disabled={savingCompany}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-slate-950 px-5 py-2 rounded-lg text-xs font-bold cursor-pointer transition shadow-md flex items-center gap-1"
              >
                {savingCompany ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
