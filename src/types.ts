export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: string; // "super_admin" or custom role id / name
  status: "active" | "inactive";
  createdAt: string;
}

export interface Permission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface Role {
  id: string;
  name: string;
  permissions: {
    dashboard: Permission;
    categories: Permission;
    items: Permission;
    transactions: Permission;
    production: Permission;
    reports: Permission;
    roles: Permission;
  };
  createdAt: string;
}

export interface CustomField {
  name: string;
  type: "text" | "number" | "select";
  required: boolean;
  options?: string[]; // for select type
}

export interface Category {
  id: string;
  name: string;
  subcategories: string[];
  unitTypes: string[]; // KG, Bag, Ton, Piece, etc.
  customFields: CustomField[];
  createdAt: string;
}

export interface Item {
  id: string;
  categoryId: string;
  subcategory: string;
  name: string;
  unit: string;
  cost: number; // NPR cost per unit
  supplier: string;
  minStock: number;
  leadTime: number; // in days
  customFields: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: "STOCK_IN" | "STOCK_OUT";
  itemId: string;
  quantity: number;
  rate: number;
  total: number;
  supplier?: string; // For STOCK_IN
  vehicleNo?: string; // For STOCK_IN
  billNo?: string; // For STOCK_IN
  purpose?: "Production" | "Damage" | "Transfer" | "Other"; // For STOCK_OUT
  batchId?: string; // For STOCK_OUT/production
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface ProductionInput {
  itemId: string;
  quantity: number;
  rate: number;
  total: number;
}

export interface Production {
  id: string;
  date: string; // YYYY-MM-DD
  batchId: string;
  finishedGoodsItemId: string; // Out item (e.g. Poultry Feed Grade-A)
  outputQuantity: number;
  totalCost: number;
  averageCostPerUnit: number;
  inputs: ProductionInput[];
  createdBy: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  details: string;
  entityId: string;
  entityType: string;
}
