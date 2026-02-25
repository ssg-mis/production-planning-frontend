// Dispatch Order for Order Dispatch Planning
export interface DispatchOrder {
  id: string;
  indentNo?: string;
  dispatchPlanRef?: string;
  customerName?: string;
  productName: string;
  packingSize?: string; // e.g., "15 kg", "13 kg", "1 ltr"
  plannedQty?: number;
  totalQuantity?: number; // For aggregated display
  tankSize?: string; // e.g., "5 MT each"
  totalLots?: number; // Calculated based on tank size
  packingType?: string;
  dispatchDate?: string;
  deliveryDate?: string;
  priority?: string;
  status: string;
  createdAt: string;
  orderNo?: string;
}

// Party Product Detail for Oil Indent
export interface PartyProductDetail {
  partyName: string;
  productName: string;
  packingSize: string;
  quantity: number;
  packingType: string;
  orderRef?: string;
}

// Product Stock Interface
export interface ProductStock {
  productKey: string; // Normalized product name + packing size
  availableStock: number;
  lastUpdated: string;
}

// Oil Indent Workflow
export interface OilIndentItem {
  id: string;
  orderRef: string;
  productName: string;
  oilRequired: number;
  selectedOil: string;
  indentQuantity: number;
  createdAt: string;
  status: "Pending" | "Approved" | "Confirmed" | "Received" | "Dispatched";
  partyName?: string; // Added for party tracking
  packingSize?: string; // Added for product variant tracking
  packingType?: string; // Added for packing type tracking
  availableStock?: number; // Available stock for this product
  shortage?: number; // Calculated shortage
  tankNo?: string; // Tank Number selected during indent
}

// Oil Indent with Parties (for aggregation view)
export interface OilIndentWithParties extends Omit<OilIndentItem, "partyName"> {
  parties: PartyProductDetail[];
  selectedParties?: string[]; // For checkbox selection
}

// Oil Indent Approval
export interface OilApprovalItem extends OilIndentItem {
  approvalDate?: string;
}

// Lab Confirmation
export interface LabConfirmationItem extends OilIndentItem {
  labDate?: string;
  sampleResult?: string;
  confirmed?: boolean;
  labReportGivenBy?: string; // Added field
}

// Dispatch Planning
export interface DispatchPlanItem {
  id: string;
  orderRef?: string;
  productName: string;
  packingSize?: string;
  partyName?: string;
  packingType?: string;
  totalQty: number;
  lots: Array<{
    lotId: string;
    size: number;
    additives?: string;
  }>;
  additiveDetails?: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
  status: "Pending" | "Planned" | "Received";
}

// Oil Receipt
export interface OilReceiptItem extends OilIndentItem {
  receivedDate?: string;
  receivedQty?: number;
  receivedBy?: string;
  additiveDetails?: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
}

// Raw Material Workflow
export interface RawMaterialIndentItem {
  id: string;
  productName: string;
  packingSize?: string;
  orderRef?: string;
  partyName?: string;
  packingType?: string;
  plannedQty: number;
  bom: Array<{
    item: string;
    qtyRequired: number;
    qtyAllocated: number;
  }>;
  createdAt: string;
  status:
    | "Pending"
    | "Allocated"
    | "Issued"
    | "Received"
    | "BalanceReceived"
    | "Stocked";
}

// Raw Material Issue
export interface RawMaterialIssueItem {
  id: string;
  productName: string;
  packingSize?: string;
  orderRef?: string;
  partyName?: string;
  packingType?: string;
  bomItem: string;
  plannedQty: number;
  issuedQty: number;
  status: "Pending" | "Issued";
}

export interface RawMaterialReceiptItem {
  id: string;
  productName: string;
  packingSize?: string;
  orderRef?: string;
  partyName?: string;
  packingType?: string;
  bomItem: string;
  plannedQty: number;
  issuedQty: number;
  receivedQty: number;
  status: "Pending" | "Received";
  createdAt?: string;
}

// Production Entry
export interface ProductionEntryItem {
  id: string;
  productName: string;
  packingSize?: string;
  orderRef?: string;
  partyName?: string;
  packingType?: string;
  plannedQty: number;
  actualQty: number;
  status: "Pending" | "Completed";
  bomConsumption: Array<{
    material: string;
    planned: number;
    actual: number;
    diff: number;
    returned: number;
    damaged: number;
    damageReason: string;
  }>;
}

// Balance Material Receipt
export interface BalanceMaterialReceiptItem {
  id: string;
  productName: string;
  packingSize?: string;
  orderRef?: string;
  partyName?: string;
  packingType?: string;
  bomItem: string;
  varianceQty: number;
  receivedQty: number;
  status: "Pending" | "Received";
  createdAt?: string;
}

// Stock In
export interface StockInItem {
  id: string;
  productName: string;
  packingSize?: string;
  orderRef?: string;
  partyName?: string;
  packingType?: string;
  finishedQty: number;
  acceptedQty: number;
  status: "Pending" | "Accepted";
}

// Storage Keys
const KEYS = {
  DISPATCH_ORDERS: 'dispatch_orders',
  OIL_INDENTS: 'oil_indents',
  OIL_APPROVALS: 'oil_approvals',
  LAB_CONFIRMATIONS: 'lab_confirmations',
  DISPATCH_PLANS: 'dispatch_plans',
  OIL_RECEIPTS: 'oil_receipts',
  RAW_MATERIAL_INDENTS: 'raw_material_indents',
  RAW_MATERIAL_ISSUES: 'raw_material_issues',
  RAW_MATERIAL_RECEIPTS: 'raw_material_receipts',
  PRODUCTION_ENTRIES: 'production_entries',
  BALANCE_MATERIAL_RECEIPTS: 'balance_material_receipts',
  STOCK_IN: 'stock_in',
  PRODUCT_STOCK: 'product_stock',
};

// Oil Indent Functions
export function getOilIndents(): OilIndentItem[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.OIL_INDENTS);
  return data ? JSON.parse(data) : [];
}

export function saveOilIndent(item: OilIndentItem): void {
  if (typeof window === "undefined") return;
  const items = getOilIndents();
  const existingIndex = items.findIndex(i => i.id === item.id);
  
  if (existingIndex >= 0) {
    // Update existing item
    items[existingIndex] = item;
  } else {
    // Add new item
    items.push(item);
  }
  
  localStorage.setItem(KEYS.OIL_INDENTS, JSON.stringify(items));
}

export function getOilApprovals(): OilApprovalItem[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.OIL_APPROVALS);
  return data ? JSON.parse(data) : [];
}

export function moveToOilApproval(item: OilIndentItem): void {
  if (typeof window === "undefined") return;
  const approvals = getOilApprovals();
  approvals.push({ ...item, status: "Approved" });
  localStorage.setItem(KEYS.OIL_APPROVALS, JSON.stringify(approvals));

  // Remove from pending
  const indents = getOilIndents().filter((i) => i.id !== item.id);
  localStorage.setItem(KEYS.OIL_INDENTS, JSON.stringify(indents));
}

export function getLabConfirmations(): LabConfirmationItem[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.LAB_CONFIRMATIONS);
  return data ? JSON.parse(data) : [];
}

export function moveToLabConfirmation(item: OilApprovalItem): void {
  if (typeof window === "undefined") return;
  const labs = getLabConfirmations();
  
  // Check if item already exists to prevent duplicates
  const existingIndex = labs.findIndex(l => l.id === item.id);
  if (existingIndex >= 0) {
    // Item already exists, update it instead of adding duplicate
    labs[existingIndex] = { ...item, status: "Confirmed" };
  } else {
    // Add new item
    labs.push({ ...item, status: "Confirmed" });
  }
  
  localStorage.setItem(KEYS.LAB_CONFIRMATIONS, JSON.stringify(labs));

  const approvals = getOilApprovals().filter((i) => i.id !== item.id);
  localStorage.setItem(KEYS.OIL_APPROVALS, JSON.stringify(approvals));
}

export function getDispatchPlans(): DispatchPlanItem[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.DISPATCH_PLANS);
  return data ? JSON.parse(data) : [];
}

export function moveToDispatchPlanning(item: LabConfirmationItem): void {
  if (typeof window === "undefined") return;
  const plans = getDispatchPlans();
  
  // Check if item already exists to prevent duplicates
  const existingIndex = plans.findIndex(p => p.id === item.id);
  const dispatchPlan: DispatchPlanItem = {
    id: item.id,
    orderRef: item.orderRef,
    productName: item.productName,
    packingSize: item.packingSize,
    partyName: item.partyName,
    packingType: item.packingType,
    totalQty: item.indentQuantity,
    lots: generateLots(item.productName, item.indentQuantity),
    additiveDetails: [], // Initialize empty additives
    status: "Planned",
  };
  
  if (existingIndex >= 0) {
    // Item already exists, update it instead of adding duplicate
    plans[existingIndex] = dispatchPlan;
  } else {
    // Add new item
    plans.push(dispatchPlan);
  }
  
  localStorage.setItem(KEYS.DISPATCH_PLANS, JSON.stringify(plans));

  const labs = getLabConfirmations().filter((i) => i.id !== item.id);
  localStorage.setItem(KEYS.LAB_CONFIRMATIONS, JSON.stringify(labs));
}

export function getOilReceipts(): OilReceiptItem[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.OIL_RECEIPTS);
  return data ? JSON.parse(data) : [];
}

export function moveToOilReceipt(item: DispatchPlanItem): void {
  if (typeof window === "undefined") return;
  const receipts = getOilReceipts();
  
  // Check if item already exists to prevent duplicates
  const existingIndex = receipts.findIndex(r => r.id === item.id);
  
  const receipt: OilReceiptItem = {
    id: item.id,
    orderRef: item.orderRef || item.id,
    productName: item.productName,
    packingSize: item.packingSize,
    partyName: item.partyName,
    packingType: item.packingType,
    oilRequired: item.totalQty,
    selectedOil: `${item.productName}${item.packingSize ? ' ' + item.packingSize : ''}`,
    indentQuantity: item.totalQty,
    createdAt: new Date().toISOString(),
    status: "Pending",
    receivedDate: undefined,
    additiveDetails: item.additiveDetails || [],
  };
  
  if (existingIndex >= 0) {
    // Item already exists, update it instead of adding duplicate
    receipts[existingIndex] = receipt;
  } else {
    // Add new item
    receipts.push(receipt);
  }
  
  localStorage.setItem(KEYS.OIL_RECEIPTS, JSON.stringify(receipts));

  const plans = getDispatchPlans().filter((i) => i.id !== item.id);
  localStorage.setItem(KEYS.DISPATCH_PLANS, JSON.stringify(plans));
}

// Move from Oil Receipt to Raw Material Indent
export function moveToRawMaterialIndent(item: OilReceiptItem): void {
  if (typeof window === "undefined") return;
  const indents = getRawMaterialIndents();
  
  // Check if item already exists to prevent duplicates
  const existingIndex = indents.findIndex(i => i.id === item.id);
  
  // Create a raw material indent based on the receipt
  const rawMaterialIndent: RawMaterialIndentItem = {
    id: item.id,
    productName: item.productName,
    packingSize: item.packingSize,
    orderRef: item.orderRef,
    partyName: item.partyName,
    packingType: item.packingType,
    plannedQty: item.indentQuantity || 0,
    bom: [
      { item: "Tin", qtyRequired: item.indentQuantity || 0, qtyAllocated: 0 },
      { item: "Strap", qtyRequired: item.indentQuantity || 0, qtyAllocated: 0 },
      { item: "Cap", qtyRequired: item.indentQuantity || 0, qtyAllocated: 0 },
    ],
    createdAt: new Date().toISOString(),
    status: "Pending",
  };
  
  if (existingIndex >= 0) {
    // Item already exists, update it instead of adding duplicate
    indents[existingIndex] = rawMaterialIndent;
  } else {
    // Add new item
    indents.push(rawMaterialIndent);
  }
  
  localStorage.setItem(KEYS.RAW_MATERIAL_INDENTS, JSON.stringify(indents));
  
  // Remove from oil receipts
  const receipts = getOilReceipts().filter((r) => r.id !== item.id);
  localStorage.setItem(KEYS.OIL_RECEIPTS, JSON.stringify(receipts));
}

// Raw Material Functions
export function getRawMaterialIndents(): RawMaterialIndentItem[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.RAW_MATERIAL_INDENTS);
  return data ? JSON.parse(data) : [];
}

export function saveRawMaterialIndent(item: RawMaterialIndentItem): void {
  if (typeof window === "undefined") return;
  const items = getRawMaterialIndents();
  items.push(item);
  localStorage.setItem(KEYS.RAW_MATERIAL_INDENTS, JSON.stringify(items));
}

export function moveToRawMaterialIssue(item: RawMaterialIndentItem): void {
  if (typeof window === "undefined") return;
  const indents = getRawMaterialIndents().filter((i) => i.id !== item.id);
  localStorage.setItem(KEYS.RAW_MATERIAL_INDENTS, JSON.stringify(indents));

  // Add to issued list
  const issues = getRawMaterialIssues();
  item.bom.forEach((bomItem) => {
    issues.push({
      id: `${item.id}-${bomItem.item}`,
      productName: item.productName,
      packingSize: item.packingSize,
      orderRef: item.orderRef,
      partyName: item.partyName,
      packingType: item.packingType,
      bomItem: bomItem.item,
      plannedQty: bomItem.qtyRequired,
      issuedQty: 0,
      status: "Pending",
    });
  });
  localStorage.setItem(KEYS.RAW_MATERIAL_ISSUES, JSON.stringify(issues));
}

export function getRawMaterialIssues(): RawMaterialIssueItem[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.RAW_MATERIAL_ISSUES);
  return data ? JSON.parse(data) : [];
}

export function getRawMaterialReceipts(): RawMaterialIssueItem[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.RAW_MATERIAL_RECEIPTS);
  return data ? JSON.parse(data) : [];
}

export function moveToRawMaterialReceipt(item: RawMaterialIssueItem): void {
  if (typeof window === "undefined") return;
  
  const receipts = getRawMaterialReceipts();
  
  // Check if item already exists to prevent duplicates
  const existingIndex = receipts.findIndex(r => r.id === item.id);
  
  const receipt: RawMaterialReceiptItem = {
    ...item,
    plannedQty: item.plannedQty || 0, // Keep plannedQty
    status: "Pending", // Set to Pending so it shows in Raw Material Receipt pending tab
    receivedQty: 0
  };
  
  if (existingIndex >= 0) {
    // Item already exists, update it instead of adding duplicate
    receipts[existingIndex] = receipt;
  } else {
    // Add new item
    receipts.push(receipt);
  }
  
  localStorage.setItem(KEYS.RAW_MATERIAL_RECEIPTS, JSON.stringify(receipts));

  const issues = getRawMaterialIssues().filter((i) => i.id !== item.id);
  localStorage.setItem(KEYS.RAW_MATERIAL_ISSUES, JSON.stringify(issues));
}

export function getProductionEntries(): ProductionEntryItem[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.PRODUCTION_ENTRIES);
  return data ? JSON.parse(data) : [];
}

export function moveToProductionEntry(item: RawMaterialReceiptItem): void {
  if (typeof window === "undefined") return;
  const receipts = getRawMaterialReceipts().filter((i) => i.id !== item.id);
  localStorage.setItem(KEYS.RAW_MATERIAL_RECEIPTS, JSON.stringify(receipts));

  // Create production entry if not exists
  const productions = getProductionEntries();
  const existingProd = productions.find(
    (p) => p.productName === item.productName && p.status === "Pending",
  );

  if (!existingProd) {
    productions.push({
      id: `prod-${Date.now()}`,
      productName: item.productName,
      packingSize: item.packingSize,
      orderRef: item.orderRef,
      partyName: item.partyName,
      packingType: item.packingType,
      plannedQty: 2500,
      actualQty: 0,
      status: "Pending",
      bomConsumption: [
        {
          material: "Rope",
          planned: 12.50,
          actual: 12.50,
          diff: 0,
          returned: 0,
          damaged: 0,
          damageReason: "",
        },
        {
          material: "Cartoon",
          planned: 1125.00,
          actual: 1125.00,
          diff: 0,
          returned: 0,
          damaged: 0,
          damageReason: "",
        },
        {
          material: "Tin",
          planned: 1250.00,
          actual: 1250.00,
          diff: 0,
          returned: 0,
          damaged: 0,
          damageReason: "",
        },
        {
          material: "Sticker",
          planned: 2500.00,
          actual: 2500.00,
          diff: 0,
          returned: 0,
          damaged: 0,
          damageReason: "",
        },
      ],
    });
    localStorage.setItem(KEYS.PRODUCTION_ENTRIES, JSON.stringify(productions));
  }
}

// Stock In functions
export function getStockIn(): StockInItem[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.STOCK_IN);
  return data ? JSON.parse(data) : [];
}

export function moveToStockIn(item: ProductionEntryItem): void {
  if (typeof window === "undefined") return;
  
  const stockItems = getStockIn();
  
  // Check if item already exists to prevent duplicates
  const existingIndex = stockItems.findIndex(s => s.id === item.id);
  
  const stockItem: StockInItem = {
    id: item.id,
    productName: item.productName,
    packingSize: item.packingSize,
    orderRef: item.orderRef,
    partyName: item.partyName,
    packingType: item.packingType,
    finishedQty: item.actualQty,
    acceptedQty: 0,
    status: "Pending"
  };
  
  if (existingIndex >= 0) {
    // Item already exists, update it instead of adding duplicate
    stockItems[existingIndex] = stockItem;
  } else {
    // Add new item
    stockItems.push(stockItem);
  }
  
  localStorage.setItem(KEYS.STOCK_IN, JSON.stringify(stockItems));

  // Check for variance/returned materials and create balance receipts
  if (item.bomConsumption) {
    item.bomConsumption.forEach(bom => {
      const varianceQty = bom.diff > 0 ? bom.diff : (bom.returned + bom.damaged);
      if (varianceQty > 0) {
        const balanceItem: BalanceMaterialReceiptItem = {
          id: `${item.id}-${bom.material}-${Date.now()}`,
          productName: item.productName,
          packingSize: item.packingSize,
          orderRef: item.orderRef,
          partyName: item.partyName,
          packingType: item.packingType,
          bomItem: bom.material,
          varianceQty: varianceQty,
          receivedQty: 0,
          status: "Pending",
          createdAt: new Date().toISOString()
        };
        addToBalanceReceipts(balanceItem);
      }
    });
  }

  // Remove from production entries
  const productions = getProductionEntries().filter((p) => p.id !== item.id);
  localStorage.setItem(KEYS.PRODUCTION_ENTRIES, JSON.stringify(productions));
}

// Accept stock items - move from Pending to Accepted
export function acceptStockItems(productKeys: string[]): void {
  if (typeof window === "undefined") return;
  const stockItems = getStockIn();
  
  // Update status of all items matching the product keys
  const updatedItems = stockItems.map(item => {
    const itemKey = `${item.productName}${item.packingSize ? ' ' + item.packingSize : ''}`
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
    
    // If this item's product key is in the list to accept
    if (productKeys.some(key => key === itemKey)) {
      return {
        ...item,
        status: "Accepted" as const,
        acceptedQty: item.finishedQty // Set accepted quantity to finished quantity
      };
    }
    return item;
  });
  
  localStorage.setItem(KEYS.STOCK_IN, JSON.stringify(updatedItems));
}



// Helper function
function generateLots(
  productName: string,
  totalQty: number,
): DispatchPlanItem["lots"] {
  const lotSize = 5;
  const numLots = Math.ceil(totalQty / lotSize);
  const lots = [];

  for (let i = 0; i < numLots; i++) {
    const size = i === numLots - 1 ? totalQty - i * lotSize : lotSize;
    const additives = productName.includes("Rice")
      ? "Vitamin 10 gm/ton"
      : "Antifoaming";
    lots.push({
      lotId: `LOT-${i + 1}`,
      size,
      additives,
    });
  }

  return lots;
}

// Dispatch Order Functions
export function getDispatchOrders(): DispatchOrder[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(KEYS.DISPATCH_ORDERS);
  return data ? JSON.parse(data) : [];
}

export function saveDispatchOrder(order: DispatchOrder): void {
  if (typeof window === 'undefined') return;
  const orders = getDispatchOrders();
  orders.push(order);
  localStorage.setItem(KEYS.DISPATCH_ORDERS, JSON.stringify(orders));
}

export function updateDispatchOrder(order: DispatchOrder): void {
  if (typeof window === 'undefined') return;
  const orders = getDispatchOrders();
  const index = orders.findIndex(o => o.id === order.id);
  if (index !== -1) {
    orders[index] = order;
    localStorage.setItem(KEYS.DISPATCH_ORDERS, JSON.stringify(orders));
  }
}

export function deleteDispatchOrder(orderId: string): void {
  if (typeof window === 'undefined') return;
  const orders = getDispatchOrders().filter(o => o.id !== orderId);
  localStorage.setItem(KEYS.DISPATCH_ORDERS, JSON.stringify(orders));
}

// Aggregation helper for Oil Indents by product
export function aggregateOilIndentsByProduct(indents: OilIndentItem[]): OilIndentWithParties[] {
  const aggregated: { [key: string]: OilIndentWithParties } = {};

  indents.forEach(indent => {
    const productKey = `${indent.productName}${indent.packingSize ? ' ' + indent.packingSize : ''}`;
    
    if (!aggregated[productKey]) {
      aggregated[productKey] = {
        id: indent.id, // Use first ID as representative
        orderRef: indent.orderRef,
        productName: indent.productName,
        packingSize: indent.packingSize,
        oilRequired: 0,
        selectedOil: indent.selectedOil,
        indentQuantity: 0,
        createdAt: indent.createdAt,
        status: indent.status,
        parties: [],
        selectedParties: []
      };
    }

    aggregated[productKey].oilRequired += indent.oilRequired;
    aggregated[productKey].indentQuantity += indent.indentQuantity;

    if (indent.partyName) {
      aggregated[productKey].parties.push({
        partyName: indent.partyName,
        productName: indent.productName,
        packingSize: indent.packingSize || '',
        quantity: indent.oilRequired,
        packingType: indent.packingType || ''
      });
      if (!aggregated[productKey].selectedParties?.includes(indent.partyName)) {
        aggregated[productKey].selectedParties?.push(indent.partyName);
      }
    }
  });

  return Object.values(aggregated);
}

// Get Oil Indents grouped by product with party details
export function getAggregatedOilIndents(): OilIndentWithParties[] {
  const indents = getOilIndents();
  return aggregateOilIndentsByProduct(indents);
}

// Product Stock Management Functions

// Get all product stocks
export function getProductStocks(): ProductStock[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.PRODUCT_STOCK);
  return data ? JSON.parse(data) : [];
}

// Get stock for a specific product
export function getProductStock(productKey: string): number {
  const stocks = getProductStocks();
  const stock = stocks.find(s => s.productKey.toUpperCase() === productKey.toUpperCase());
  return stock ? stock.availableStock : 0;
}

// Update stock for a product
export function updateProductStock(productKey: string, newStock: number): void {
  if (typeof window === "undefined") return;
  const stocks = getProductStocks();
  const existingIndex = stocks.findIndex(s => s.productKey.toUpperCase() === productKey.toUpperCase());
  
  if (existingIndex >= 0) {
    stocks[existingIndex] = {
      productKey,
      availableStock: newStock,
      lastUpdated: new Date().toISOString()
    };
  } else {
    stocks.push({
      productKey,
      availableStock: newStock,
      lastUpdated: new Date().toISOString()
    });
  }
  
  localStorage.setItem(KEYS.PRODUCT_STOCK, JSON.stringify(stocks));
}

// Initialize default product stocks
export function initializeDefaultStocks(): void {
  if (typeof window === "undefined") return;
  
  const existingStocks = getProductStocks();
  if (existingStocks.length > 0) return; // Only initialize once
  
  const defaultStocks: ProductStock[] = [
    { productKey: 'HK RICE 15 KG', availableStock: 5000, lastUpdated: new Date().toISOString() },
    { productKey: 'HK RICE 13 KG', availableStock: 3000, lastUpdated: new Date().toISOString() },
    { productKey: 'HK RICE 1 LTR', availableStock: 2000, lastUpdated: new Date().toISOString() },
    { productKey: 'HK RICE 5 KG', availableStock: 1500, lastUpdated: new Date().toISOString() },
    { productKey: 'HK SOYA 15 KG', availableStock: 4000, lastUpdated: new Date().toISOString() },
    { productKey: 'HK SOYA 10 KG', availableStock: 2500, lastUpdated: new Date().toISOString() },
    { productKey: 'HK SUNFLOWER 1 LTR', availableStock: 3500, lastUpdated: new Date().toISOString() },
    { productKey: 'HK GROUNDNUT 15 KG', availableStock: 3000, lastUpdated: new Date().toISOString() },
  ];
  
  localStorage.setItem(KEYS.PRODUCT_STOCK, JSON.stringify(defaultStocks));
}

// Balance Material Receipt functions
export function getBalanceReceipts(): BalanceMaterialReceiptItem[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.BALANCE_MATERIAL_RECEIPTS);
  return data ? JSON.parse(data) : [];
}

export function addToBalanceReceipts(item: BalanceMaterialReceiptItem): void {
  if (typeof window === "undefined") return;
  const items = getBalanceReceipts();
  items.push(item);
  localStorage.setItem(KEYS.BALANCE_MATERIAL_RECEIPTS, JSON.stringify(items));
}
