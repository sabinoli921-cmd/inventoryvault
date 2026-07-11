import { db, collection, addDoc } from "./firebase";
import { Item, Transaction, AuditLog } from "./types";

/**
 * Format a numeric value in Nepali Rupees (NPR ₹)
 */
export function formatNPR(value: number): string {
  const formatter = new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  // Replace standard NPR notation with customized NPR ₹ as requested by the user
  const formatted = formatter.format(value);
  return formatted.replace("NPR", "NPR ₹");
}

/**
 * Log an action to the Firestore audit logs collection
 */
export async function logAudit(
  userId: string,
  userEmail: string,
  action: string,
  details: string,
  entityId: string,
  entityType: string
) {
  try {
    const auditLog = {
      timestamp: new Date().toISOString(),
      userId,
      userEmail,
      action,
      details,
      entityId,
      entityType
    };
    await addDoc(collection(db, "auditLogs"), auditLog);
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

/**
 * Smart Inventory Logic:
 * Calculates all inventory ratios for an item
 */
export interface SmartInventoryMetrics {
  closingStock: number;
  averageDailyConsumption: number;
  leadTime: number;
  safetyStock: number;
  reorderLevel: number;
  eoq: number;
  maxStock: number;
  status: "Normal" | "Low" | "Critical";
  colorClass: string;
}

export function calculateItemMetrics(
  item: Item,
  transactions: Transaction[]
): SmartInventoryMetrics {
  // Filter transactions for this specific item
  const itemTx = transactions.filter((tx) => tx.itemId === item.id);
  
  // Sort by date descending
  itemTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 1. Calculate Closing Stock: Opening Stock is assumed 0 initially or we track cumulatively
  // Closing Stock = Stock In - Stock Out
  let stockInTotal = 0;
  let stockOutTotal = 0;
  
  itemTx.forEach((tx) => {
    if (tx.type === "STOCK_IN") {
      stockInTotal += tx.quantity;
    } else if (tx.type === "STOCK_OUT") {
      stockOutTotal += tx.quantity;
    }
  });

  const closingStock = stockInTotal - stockOutTotal;

  // 2. Average Daily Consumption (ADC)
  // Look at last 30 days or calculate based on first transaction date to now
  const stockOuts = itemTx.filter((tx) => tx.type === "STOCK_OUT");
  let averageDailyConsumption = 0;

  if (stockOuts.length > 0) {
    // Let's compute based on the active span of consumption (minimum 1 day, max 30)
    const dates = stockOuts.map((tx) => new Date(tx.date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const msDiff = maxDate - minDate;
    const daysDiff = Math.max(1, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
    
    const totalConsumed = stockOuts.reduce((acc, tx) => acc + tx.quantity, 0);
    
    // Default to at least a 7-day span if single transaction to avoid extreme spikes,
    // or use direct days span. Let's make it a smart window.
    if (daysDiff <= 1) {
      averageDailyConsumption = totalConsumed / 7; // Average over week fallback
    } else {
      averageDailyConsumption = totalConsumed / daysDiff;
    }
  }

  // Fallback to average item specifications or 1.5% of minStock if no outs
  if (averageDailyConsumption === 0) {
    averageDailyConsumption = item.minStock > 0 ? item.minStock / 30 : 5; // reasonable default
  }

  // 3. Lead Time
  const leadTime = item.leadTime || 3; // default 3 days if not defined

  // 4. Safety Stock
  // Safety Stock = Average Daily Consumption * Safety Days (let's say 4 days of safety)
  const safetyStock = averageDailyConsumption * 4;

  // 5. Reorder Level (ROL)
  // ROL = (Average Daily Consumption * Lead Time) + Safety Stock
  const reorderLevel = (averageDailyConsumption * leadTime) + safetyStock;

  // 6. Economic Order Quantity (EOQ)
  // EOQ = sqrt( (2 * AnnualDemand * OrderCost) / HoldingCost )
  // Annual Demand (D) = ADC * 365
  // Ordering Cost (S) = Let's use NPR 1500 as average setup cost
  // Holding Cost (H) = Let's say 12% of the item cost per unit per year (minimum NPR 5)
  const annualDemand = averageDailyConsumption * 365;
  const orderingCost = 1500; 
  const holdingCost = Math.max(5, item.cost * 0.12);
  const eoq = Math.round(Math.sqrt((2 * annualDemand * orderingCost) / holdingCost));

  // 7. Maximum Stock Level
  // Max Stock = ROL + EOQ - (Min Daily Consumption * Lead Time)
  // Let's approximate min daily consumption as 0.5 * ADC
  const maxStock = reorderLevel + eoq - (0.5 * averageDailyConsumption * leadTime);

  // Status Check: Normal, Low, Critical
  let status: "Normal" | "Low" | "Critical" = "Normal";
  let colorClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

  if (closingStock <= safetyStock) {
    status = "Critical";
    colorClass = "text-red-400 bg-red-500/10 border-red-500/20";
  } else if (closingStock <= reorderLevel) {
    status = "Low";
    colorClass = "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
  }

  return {
    closingStock,
    averageDailyConsumption,
    leadTime,
    safetyStock,
    reorderLevel,
    eoq,
    maxStock,
    status,
    colorClass
  };
}

/**
 * Bulk CSV parser
 * Supports parsing standard tab/comma delimited text pasted from spreadsheets
 */
export function parseBulkUpload(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Determine delimiter (tab for Excel, comma for standard CSV)
  const header = lines[0];
  const isTab = header.includes("\t");
  const delimiter = isTab ? "\t" : ",";

  const headers = header.split(delimiter).map((h) => h.trim().toLowerCase());

  const results: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim());
    if (cols.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((h, index) => {
        row[h] = cols[index];
      });
      results.push(row);
    }
  }

  return results;
}
