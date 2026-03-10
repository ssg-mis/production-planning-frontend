'use client';

import { useState, useEffect, Fragment } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import TableSkeleton from '@/components/table-skeleton';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { 

  getOilIndents, 
  saveOilIndent, 
  moveToOilApproval,
  getProductStock,
  initializeDefaultStocks,
  type OilIndentItem,
  type OilIndentWithParties,
  type PartyProductDetail
} from '@/lib/workflow-storage';

// Extended interface to include weight details
interface ExtendedOilIndentItem extends OilIndentItem {
  packingWeight?: number;
  totalWeightKg?: number;
  remarks?: string;
}

interface AggregatedProduct {
  id: string;
  productName: string;
  packingSize?: string;
  totalOilRequired: number;
  totalWeightKg: number;
  indentQuantity: number;
  parties: ExtendedOilIndentItem[];
  status: string;
}

interface OilTypeGroup {
  type: string;
  totalOilRequired: number; // in MT
  totalWeightKg: number;    // in Kg
  products: AggregatedProduct[];
}

// Helper to format numbers with commas
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

const formatNumber = (num: number | undefined) => {
  if (num === undefined || num === null) return '-';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(num);
};

// Normalize product key for matching (case-insensitive, remove extra spaces)
const normalizeProductKey = (productName: string, packingSize?: string): string => {
  const normalized = `${productName}${packingSize ? ' ' + packingSize : ''}`
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  return normalized;
};

const categorizeOilType = (productName: string): string => {
  const lowerName = productName.toLowerCase();
  
  if (lowerName.includes('rice bran oil') || lowerName.includes('rbo') || lowerName.includes('rice bran')) {
    return 'Rice Bran Oil';
  } else if (lowerName.includes('soybean') || lowerName.includes('soya') || lowerName.includes('sbo')) {
    return 'Soybean Oil';
  } else if (lowerName.includes('palm') || lowerName.includes('palmolein')) {
    return 'Hari Krishna Palm Oil';
  } else if (lowerName.includes('mustard') || lowerName.includes('kachi ghani')) {
    return 'Mustard Oil';
  } else if (lowerName.includes('sunflower')) {
    return 'Sunflower Oil';
  } else if (lowerName.includes('groundnut')) {
    return 'Groundnut Oil';
  } else {
    return 'Other Oils';
  }
};

const getDisplayName = (normalizedKey: string): string => {
  return normalizedKey; // The key itself is "PRODUCT NAME PACKING" which is good for display
};

const OilIndent = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [indents, setIndents] = useState<ExtendedOilIndentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOilTypes, setExpandedOilTypes] = useState<Record<string, boolean>>({});
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [showIndentForm, setShowIndentForm] = useState(false);
  const [showAddDataForm, setShowAddDataForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedParties, setSelectedParties] = useState<string[]>([]);
  const [formDetailsExpanded, setFormDetailsExpanded] = useState(false);
  
  const [formData, setFormData] = useState({
    selectedOil: '',
    indentQuantity: 0,
    totalWeightKg: 0,
    requiredQtyKg: 0,
    remainingQtyKg: 0,
    tankNo: '',
    remarks: '',
  });

  const [addDataForm, setAddDataForm] = useState({
    orderRef: '',
    productName: '',
    packingSize: '',
    packingType: 'Tin',
    partyName: '',
    oilRequired: '',
  });

  // Load initial data from backend API
  useEffect(() => {
    initializeDefaultStocks();
    
    // Default expanded state: Empty (collapsed by default as per user request to "wrap only")
    setExpandedOilTypes({});

    const fetchIndents = async () => {
      setLoading(true);
      try {
        // Fetch Pending Indents
        const pendingResponse = await fetch(`${API_BASE_URL}/oil-indent/pending`);
        if (!pendingResponse.ok) throw new Error('Failed to fetch pending indents');
        const pendingResult = await pendingResponse.json();
        const pendingData = pendingResult.data || pendingResult;
        
        const transformedPending: ExtendedOilIndentItem[] = pendingData.map((item: any, index: number) => {
          const qty = parseFloat(item.quantity || '0');
          const packingWeight = parseFloat(item.packingWeight || '0');
          return {
            id: item.orderNo || `indent-${index}`,
            orderRef: item.orderNo || `SO-${index}`,
            productName: item.productName || 'Unknown Product',
            packingSize: '', 
            packingType: item.transportType === 'self' ? 'Tin' : 'Tin',
            partyName: item.partyName || 'Unknown Party',
            oilRequired: qty,
            packingWeight: packingWeight,
            totalWeightKg: qty * packingWeight,
            selectedOil: '',
            indentQuantity: 0,
            createdAt: item.plannedDate || new Date().toISOString(),
            status: 'Pending',
          };
        });

        // Fetch History/Production Indents
        const historyResponse = await fetch(`${API_BASE_URL}/production-indent`);
        let transformedHistory: ExtendedOilIndentItem[] = [];
        if (historyResponse.ok) {
          const historyResult = await historyResponse.json();
          const historyData = historyResult.data || historyResult;
          transformedHistory = historyData.map((item: any) => ({
            id: item.productionId || item.id,
            orderRef: item.orderId || '-',
            productName: item.productName,
            packingSize: item.packingSize,
            packingType: item.packingType,
            partyName: item.partyName,
            oilRequired: item.indentQuantity || item.oilRequired || 0,
            selectedOil: item.selectedOil,
            indentQuantity: item.indentQuantity || 0,
            createdAt: item.createdAt,
            status: 'Submitted',
            packingWeight: 0,
            totalWeightKg: 0,
            remarks: item.remarks
          }));
        }

        setIndents([...transformedPending, ...transformedHistory]);
      } catch (error) {
        console.error('Error fetching indents:', error);
        // Fallback to local storage if API fails
        const savedIndents = getOilIndents();
        if (savedIndents.length > 0) setIndents(savedIndents);
      } finally {
        setLoading(false);
      }
    };

    fetchIndents();
  }, [activeTab]);

  // Reset form details collapse when product changes or modal opens
  useEffect(() => {
    setFormDetailsExpanded(false);
  }, [selectedProduct, showIndentForm]);

  // Group indents by Oil Type -> Product
  const groupIndentsByOilType = (indentsList: ExtendedOilIndentItem[]): OilTypeGroup[] => {
    const groups: Record<string, OilTypeGroup> = {};

    indentsList.forEach(indent => {
      const oilType = categorizeOilType(indent.productName);
      const productKey = normalizeProductKey(indent.productName, indent.packingSize);

      if (!groups[oilType]) {
        groups[oilType] = {
          type: oilType,
          totalOilRequired: 0,
          totalWeightKg: 0,
          products: []
        };
      }

      // Find or create product aggregate
      let productGroup = groups[oilType].products.find(p => normalizeProductKey(p.productName, p.packingSize) === productKey);
      
      if (!productGroup) {
        productGroup = {
          id: productKey, // Use normalized name as ID for grouping
          productName: indent.productName,
          packingSize: indent.packingSize,
          totalOilRequired: 0,
          totalWeightKg: 0,
          indentQuantity: 0,
          parties: [],
          status: indent.status
        };
        groups[oilType].products.push(productGroup);
      }

      // Add totals
      groups[oilType].totalOilRequired += indent.oilRequired || 0;
      groups[oilType].totalWeightKg += indent.totalWeightKg || 0;
      
      productGroup.totalOilRequired += indent.oilRequired || 0;
      productGroup.totalWeightKg += indent.totalWeightKg || 0;
      productGroup.indentQuantity += indent.indentQuantity || 0;
      productGroup.parties.push(indent);
    });

    return Object.values(groups);
  };

  const toggleOilType = (type: string) => {
    setExpandedOilTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const toggleProduct = (productId: string) => {
    setExpandedProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
      case 'submitted':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddData = () => {
    if (!addDataForm.productName || !addDataForm.partyName || !addDataForm.oilRequired) {
      alert('Please fill in all required fields: Product Name, Party Name, and Oil Required');
      return;
    }

    const newIndent: ExtendedOilIndentItem = {
      id: Date.now().toString(),
      orderRef: addDataForm.orderRef || `DP-${Date.now()}`,
      productName: addDataForm.productName,
      packingSize: addDataForm.packingSize,
      packingType: addDataForm.packingType,
      partyName: addDataForm.partyName,
      oilRequired: Number(addDataForm.oilRequired),
      selectedOil: '',
      indentQuantity: 0,
      createdAt: new Date().toISOString(),
      status: 'Pending',
      packingWeight: 0,
      totalWeightKg: 0
    };

    saveOilIndent(newIndent);
    setIndents(prev => [...prev, newIndent]);
    
    setShowAddDataForm(false);
    setAddDataForm({
      orderRef: '',
      productName: '',
      packingSize: '',
      packingType: 'Tin',
      partyName: '',
      oilRequired: '',
    });
  };

  const pendingIndents = indents.filter((i) => i.status === 'Pending');
  const historyIndents = indents.filter((i) => i.status !== 'Pending');
  
  const displayIndents = activeTab === 'pending' ? pendingIndents : historyIndents;
  const groupedIndents = groupIndentsByOilType(displayIndents);

  // Form Logic (retained from original but adapted)
  const uniqueProducts = Array.from(
    new Set(pendingIndents.map(i => normalizeProductKey(i.productName, i.packingSize)))
  );

  const handleProductSelect = (oilType: string) => {
    setSelectedProduct(oilType);
    
    // Auto-select all parties for this oil type
    const parties = pendingIndents
      .filter(i => categorizeOilType(normalizeProductKey(i.productName, i.packingSize)) === oilType)
      .map(i => i.partyName)
      .filter((p): p is string => !!p);
      
    const uniqueParties = Array.from(new Set(parties));
    setSelectedParties(uniqueParties);
    
    // Calculate total quantity and weight for all selected parties
    const selectedItems = pendingIndents
      .filter(i => categorizeOilType(normalizeProductKey(i.productName, i.packingSize)) === oilType);

    const totalQty = selectedItems.reduce((sum, i) => sum + (i.oilRequired || 0), 0);
    const totalKg = selectedItems.reduce((sum, i) => sum + (i.totalWeightKg || 0), 0);

    // Calculate already-submitted qty for this oil type (from history tab indents)
    const alreadySubmittedKg = indents
      .filter(i =>
        i.status !== 'Pending' &&
        categorizeOilType(normalizeProductKey(i.productName, i.packingSize)) === oilType
      )
      .reduce((sum, i) => sum + (i.indentQuantity || i.oilRequired || 0), 0);

    const remainingKg = Math.max(0, totalKg - alreadySubmittedKg);
    
    setFormData({
      selectedOil: oilType,
      indentQuantity: totalQty,
      totalWeightKg: totalKg,
      requiredQtyKg: totalKg,
      remainingQtyKg: remainingKg,
      tankNo: '',
      remarks: '',
    });
  };

  // Handle party checkbox toggle for form
  const handlePartyToggle = (partyName: string) => {
    let newSelectedParties: string[];
    if (selectedParties.includes(partyName)) {
      newSelectedParties = selectedParties.filter(p => p !== partyName);
    } else {
      newSelectedParties = [...selectedParties, partyName];
    }
    setSelectedParties(newSelectedParties);
    
    const selectedItems = pendingIndents
      .filter(i => 
        categorizeOilType(normalizeProductKey(i.productName, i.packingSize)) === selectedProduct &&
        newSelectedParties.includes(i.partyName || '')
      );
      
    const totalQty = selectedItems.reduce((sum, i) => sum + (i.oilRequired || 0), 0);
    const totalKg = selectedItems.reduce((sum, i) => sum + (i.totalWeightKg || 0), 0);
    
    setFormData(prev => ({ ...prev, indentQuantity: totalQty, totalWeightKg: totalKg, requiredQtyKg: totalKg }));
  };

  const handleSubmitIndent = async () => {
    if (!selectedProduct || selectedParties.length === 0) {
      alert('Please select a product and at least one party');
      return;
    }

    if (!formData.tankNo) {
      alert('Please select a Receive Tank No.');
      return;
    }

    try {
      const selectedIndentsRecords = indents.filter(indent =>
        categorizeOilType(normalizeProductKey(indent.productName, indent.packingSize)) === selectedProduct &&
        selectedParties.includes(indent.partyName || '') &&
        indent.status === 'Pending'
      );

      if (selectedIndentsRecords.length === 0) {
        alert('No pending indents found for the selected criteria');
        return;
      }

      const aggregatedData = {
        orderId: Array.from(new Set(selectedIndentsRecords.map(i => i.orderRef))).filter(Boolean).join(', '),
        productName: Array.from(new Set(selectedIndentsRecords.map(i => i.productName))).filter(Boolean).join(', '),
        packingSize: Array.from(new Set(selectedIndentsRecords.map(i => i.packingSize))).filter(Boolean).join(', ') || null,
        packingType: Array.from(new Set(selectedIndentsRecords.map(i => i.packingType))).filter(Boolean).join(', ') || 'Tin',
        partyName: Array.from(new Set(selectedIndentsRecords.map(i => i.partyName))).filter(Boolean).join(', '),
        oilRequired: selectedIndentsRecords.reduce((sum, i) => sum + (i.oilRequired || 0), 0),
        selectedOil: formData.selectedOil,
        indentQuantity: formData.requiredQtyKg,
        tankNo: formData.tankNo,
        totalWeightKg: formData.totalWeightKg,
        requiredQtyKg: formData.requiredQtyKg,
        remarks: formData.remarks
      };

      const response = await fetch(`${API_BASE_URL}/production-indent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aggregatedData),
      });

      if (!response.ok) throw new Error(`Failed to submit aggregated indent`);
      
      const result = await response.json();
      const productionId = result.data.production_id || result.data.productionId || 'Created';
      
      alert(`✅ Production indent created successfully!\nProduction ID: ${productionId}\nQuantity: ${formData.requiredQtyKg} Kg`);

      // Close form and reset, then re-fetch fresh data from server
      // (do NOT optimistically remove items — the source orders still exist as Pending)
      setShowIndentForm(false);
      setSelectedProduct('');
      setSelectedParties([]);
      setFormData({ selectedOil: '', indentQuantity: 0, totalWeightKg: 0, requiredQtyKg: 0, remainingQtyKg: 0, tankNo: '', remarks: '' });

      // Re-fetch so the remaining qty is recalculated correctly
      const pendingRes = await fetch(`${API_BASE_URL}/oil-indent/pending`);
      const historyRes = await fetch(`${API_BASE_URL}/production-indent`);
      if (pendingRes.ok && historyRes.ok) {
        const pendingResult = await pendingRes.json();
        const historyResult = await historyRes.json();
        const pendingData = (pendingResult.data || pendingResult) as any[];
        const historyData = (historyResult.data || historyResult) as any[];

        const transformedPending: ExtendedOilIndentItem[] = pendingData.map((item: any, index: number) => {
          const qty = parseFloat(item.quantity || '0');
          const packingWeight = parseFloat(item.packingWeight || '0');
          return {
            id: item.orderNo || `indent-${index}`,
            orderRef: item.orderNo || `SO-${index}`,
            productName: item.productName || 'Unknown Product',
            packingSize: '',
            packingType: item.transportType === 'self' ? 'Tin' : 'Tin',
            partyName: item.partyName || 'Unknown Party',
            oilRequired: qty,
            packingWeight,
            totalWeightKg: qty * packingWeight,
            selectedOil: '',
            indentQuantity: 0,
            createdAt: item.plannedDate || new Date().toISOString(),
            status: 'Pending',
          };
        });

        const transformedHistory: ExtendedOilIndentItem[] = historyData.map((item: any) => ({
          id: item.productionId || item.id,
          orderRef: item.orderId || '-',
          productName: item.productName,
          packingSize: item.packingSize,
          packingType: item.packingType,
          partyName: item.partyName,
          oilRequired: item.indentQuantity || item.oilRequired || 0,
          selectedOil: item.selectedOil,
          indentQuantity: item.indentQuantity || 0,
          createdAt: item.createdAt,
          status: 'Approved' as const,
          packingWeight: 0,
          totalWeightKg: 0,
          remarks: item.remarks
        }));

        setIndents([...transformedPending, ...transformedHistory]);
      }
    } catch (error) {
      console.error('Error submitting production indent:', error);
      alert(`❌ Error submitting production indent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };


  return (
    <div className="p-6 bg-background">
      <StageHeader title="Oil Indent" description="Submit oil indents for required products" />

      {/* Tabs and Action Buttons */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          {/* Tabs */}
          <button onClick={() => setActiveTab('pending')} className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'pending' ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground border border-border'}`}>Pending</button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'history' ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground border border-border'}`}>History</button>
        </div>
      </div>

      {/* Main Content: Grouped List */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground w-8"></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Product Name / Oil Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Total Qty (Kg)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Available Stock</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Shortage (Kg)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Action</th>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton cols={7} rows={5} />
            ) : (
              <tbody className="divide-y divide-border">
                {groupedIndents.map((group, groupIdx) => {
                  const isGroupExpanded = expandedOilTypes[group.type] || false;
                  
                  return (
                    <Fragment key={groupIdx}>
                      {/* Level 1: Oil Type Header */}
                      <tr 
                        className="bg-card/50 hover:bg-card cursor-pointer transition-colors"
                        onClick={() => toggleOilType(group.type)}
                      >
                        <td className="px-4 py-3 text-left text-sm">
                          {isGroupExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </td>
                        <td className="px-4 py-3 text-base text-foreground font-bold text-primary">
                          {group.type} <span className="text-sm font-normal text-muted-foreground ml-2">({group.products.length} Products)</span>
                        </td>
                        <td className="px-4 py-3 text-base text-foreground font-bold">{formatNumber(group.totalWeightKg)}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">-</td>
                        <td className={`px-4 py-3 text-base font-bold ${group.totalWeightKg > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatNumber(group.totalWeightKg)}</td>
                        <td className="px-4 py-3 text-sm">
                          {group.products.some(p => p.indentQuantity < p.totalWeightKg)
                            ? <Badge variant="outline" className="text-yellow-600 border-yellow-400">Pending</Badge>
                            : <Badge variant="outline" className="text-green-600 border-green-400">Submitted</Badge>
                          }
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {activeTab === 'pending' && (
                            <Button 
                              size="sm" 
                              className="h-8 py-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProductSelect(group.type);
                                setShowIndentForm(true);
                              }}
                            >
                              Process
                            </Button>
                          )}
                        </td>
                      </tr>

                      {/* Level 2: Product Rows */}
                      {isGroupExpanded && group.products.map((product, prodIdx) => {
                        const isProductExpanded = expandedProducts[product.id] || false;
                        const availableStock = getProductStock(normalizeProductKey(product.productName, product.packingSize));
                        const shortage = Math.max(0, product.totalOilRequired - availableStock);

                        return (
                          <Fragment key={prodIdx}>
                            <tr 
                              className="bg-background hover:bg-card/30 cursor-pointer transition-colors border-l-4 border-l-primary/20"
                              onClick={() => toggleProduct(product.id)}
                            >
                              <td className="px-4 py-3 text-left text-sm pl-8">
                                 {isProductExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                              </td>
                              <td className="px-4 py-3 text-sm text-foreground font-medium pl-4">
                                {/* Show simplified name if possible, or full name */}
                                {product.productName.replace(/Rice Bran Oil|Soybean Oil|Palm Oil|Hari Krishna Palm Oil|Mustard Oil|Sunflower Oil|Groundnut Oil|HK|RBO|SBO/gi, '').trim()} {product.packingSize}
                              </td>
                              <td className="px-4 py-3 text-sm text-foreground font-semibold">{formatNumber(product.totalWeightKg)}</td>
                              <td className="px-4 py-3 text-sm text-foreground">{activeTab === 'pending' ? availableStock : '-'}</td>
                              <td className={`px-4 py-3 text-sm font-semibold ${product.totalWeightKg > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {activeTab === 'pending' ? formatNumber(product.totalWeightKg) : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm"><Badge className={getStatusColor(product.status)}>{product.status}</Badge></td>
                              <td className="px-4 py-3 text-sm">
                                {/* Process button removed from Level 2 as per user request */}
                              </td>
                            </tr>

                            {/* Level 3: Order Details */}
                            {isProductExpanded && (
                              <tr className="bg-card/10">
                                <td colSpan={7} className="px-4 py-2 pl-12">
                                  <div className="rounded-md border border-border overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead className="bg-card/50">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Timestamp</th>
                                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Order ID</th>
                                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Order Qty</th>
                                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Total Weight (Kg)</th>
                                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Packing Type</th>
                                          {activeTab === 'history' && <th className="px-3 py-2 text-left font-medium text-muted-foreground">Remarks</th>}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border/50 bg-background">
                                        {product.parties.map((order, orderIdx) => (
                                          <tr key={orderIdx}>
                                            <td className="px-3 py-2 text-xs text-muted-foreground">
                                              {order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </td>
                                            <td className="px-3 py-2">{order.orderRef}</td>
                                            <td className="px-3 py-2 font-mono font-bold text-primary">{order.oilRequired}</td>
                                            <td className="px-3 py-2 font-bold">{formatNumber(order.totalWeightKg)}</td>
                                            <td className="px-3 py-2">{order.packingType}</td>
                                            {activeTab === 'history' && <td className="px-3 py-2 text-muted-foreground italic text-xs max-w-50 truncate" title={order.remarks}>{order.remarks || '-'}</td>}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
                
                {groupedIndents.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No {activeTab} indents found.</td></tr>
                )}
              </tbody>
            )}
          </table>
        </div>
      </Card>
      
      {/* Retain Modals for Add Data and Oil Indent Form (same as before but simplified for brevity in this replacement) */}
      {showAddDataForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
             <h2 className="text-lg font-bold mb-4">Add New Data Entry</h2>
             {/* Simple form implementation for adding data manually */}
             <div className="space-y-4">
                 <input className="w-full p-2 border rounded" placeholder="Order Reference" value={addDataForm.orderRef} onChange={e => setAddDataForm({...addDataForm, orderRef: e.target.value})} />
                 <input className="w-full p-2 border rounded" placeholder="Product Name" value={addDataForm.productName} onChange={e => setAddDataForm({...addDataForm, productName: e.target.value})} />
                 <input className="w-full p-2 border rounded" placeholder="Party Name" value={addDataForm.partyName} onChange={e => setAddDataForm({...addDataForm, partyName: e.target.value})} />
                 <input className="w-full p-2 border rounded" type="number" placeholder="Oil Required" value={addDataForm.oilRequired} onChange={e => setAddDataForm({...addDataForm, oilRequired: e.target.value})} />
                 <div className="flex justify-end gap-2">
                     <Button variant="outline" onClick={() => setShowAddDataForm(false)}>Cancel</Button>
                     <Button onClick={handleAddData}>Add</Button>
                 </div>
             </div>
          </Card>
        </div>
      )}

      {showIndentForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 bg-background border-border shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b border-border pb-2">
              <h2 className="text-xl font-bold text-foreground">Create Oil Indent</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowIndentForm(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="space-y-6">
              {/* Context Header */}
              <div className="bg-muted/30 p-4 rounded-lg border border-border">
                <h3 className="text-lg font-bold text-primary">{formData.selectedOil}</h3>
                <p className="text-xs text-muted-foreground">Select parties and confirm quantities for the indent.</p>
              </div>





              {/* Party Selection with Checkboxes */}
              {selectedProduct && (
                <>
                  <div className="mb-6">
                    <div className="flex justify-between items-end mb-3">
                      <label className="block text-sm font-medium text-foreground">
                        Select Parties for {selectedProduct}
                      </label>
                      <div className="flex gap-4 items-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormDetailsExpanded(!formDetailsExpanded)}
                          className="p-1 h-auto"
                        >
                          {formDetailsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="mb-4 p-4 bg-muted/30 rounded-lg border border-border">
                      <p className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Item to be packed</p>
                      <div className="text-lg font-bold text-primary">
                        {Array.from(new Set(pendingIndents
                          .filter(i => categorizeOilType(normalizeProductKey(i.productName, i.packingSize)) === selectedProduct)
                          .map(i => {
                            let oilClass = '';
                            const lowerName = i.productName.toLowerCase();
                            if (lowerName.includes('palm') || lowerName.includes('palmolein') || lowerName.includes('hk')) oilClass = 'HK';
                            else if (lowerName.includes('soybean') || lowerName.includes('soya') || lowerName.includes('sbo')) oilClass = 'Soya';
                            else if (lowerName.includes('rice bran oil') || lowerName.includes('rbo') || lowerName.includes('rice bran')) oilClass = 'RBO';
                            else if (lowerName.includes('mustard') || lowerName.includes('kachi ghani')) oilClass = 'Mustard';
                            else if (lowerName.includes('sunflower')) oilClass = 'Sunflower';
                            else if (lowerName.includes('groundnut')) oilClass = 'Groundnut';
                            else oilClass = i.productName;
                            
                            return oilClass;
                          })
                        )).join(', ')}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="p-4 bg-muted/30 rounded-lg border border-border flex flex-col justify-center">
                        <span className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Total Indent Qty</span>
                        <div className="text-xl font-bold text-primary">
                          {formatNumber(formData.totalWeightKg)} Kg
                        </div>
                      </div>
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-300 flex flex-col justify-center">
                        <span className="text-sm font-semibold mb-2 text-yellow-700 dark:text-yellow-400 uppercase tracking-wider">Remaining Indent Qty</span>
                        <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                          {formatNumber(Math.max(0, formData.remainingQtyKg - formData.requiredQtyKg))} Kg
                        </div>
                      </div>
                      <div className="p-4 bg-muted/30 rounded-lg border border-border flex flex-col justify-center">
                        <span className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Total Required Qty</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            className="bg-background border border-border rounded-md px-3 py-2 text-xl font-bold text-primary w-[130px] outline-none focus:ring-2 focus:ring-primary/50"
                            value={formData.requiredQtyKg === 0 ? "" : formData.requiredQtyKg}
                            onChange={(e) => {
                              let val = e.target.value === "" ? 0 : Number(e.target.value);
                              if (val > formData.remainingQtyKg) {
                                val = formData.remainingQtyKg;
                              }
                              setFormData({...formData, requiredQtyKg: val});
                            }}
                            onFocus={(e) => {
                              // Select text on focus for easier editing
                              e.target.select();
                            }}
                            max={formData.remainingQtyKg}
                          />
                          <span className="text-lg font-bold text-primary">Kg</span>
                        </div>
                      </div>
                    </div>
                    
                    {formDetailsExpanded && selectedProduct && (
                      <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="border border-border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                          <table className="w-full relative">
                            <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Timestamp</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Select</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Packing Size</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Order Qty</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Total Wt (Kg)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-card">
                              {(() => {
                                // Filter all indents that match the selected Oil Type
                                const relevantIndents = pendingIndents.filter(i => 
                                    categorizeOilType(normalizeProductKey(i.productName, i.packingSize)) === selectedProduct
                                );
                                
                                if (relevantIndents.length === 0) {
                                    return <tr><td colSpan={4} className="p-4 text-center">No orders found (this shouldn't happen)</td></tr>;
                                }

                                return relevantIndents.map((indent, idx) => {
                                     // We need to use the `indents` state (which has editable values) but matched by ID or reference
                                     // Since `indents` state contains *all* indents properly initialized
                                     // Let's find the matching editable indent from the state
                                     const editableIndent = indents.find(i => i.id === indent.id) || indent;
                                     
                                     const packingWeight = (editableIndent as ExtendedOilIndentItem)?.packingWeight || 0;
                                     const totalWeightKg = editableIndent.oilRequired * packingWeight;

                                     return (
                                    <tr key={editableIndent.id} className="hover:bg-muted/50 transition-colors">
                                      <td className="px-4 py-3 text-xs text-muted-foreground">
                                        {editableIndent.createdAt ? new Date(editableIndent.createdAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                      </td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="checkbox"
                                          checked={selectedParties.includes(editableIndent.partyName || '')}
                                          onChange={() => handlePartyToggle(editableIndent.partyName || '')}
                                          className="w-4 h-4 rounded border-primary focus:ring-primary text-primary"
                                        />
                                      </td>
                                      <td className="px-4 py-3 text-xs text-muted-foreground font-medium">
                                          {editableIndent.packingSize || editableIndent.productName.replace(/Rice Bran Oil|Soybean Oil|Palm Oil|Hari Krishna Palm Oil|Mustard Oil|Sunflower Oil|Groundnut Oil|HK|RBO|SBO/gi, '').trim()}
                                      </td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="number"
                                          value={editableIndent.oilRequired}
                                          onChange={(e) => {
                                            const newQty = Number(e.target.value);
                                            const updatedIndents = indents.map(i => {
                                                if (i.id === editableIndent.id) {
                                                    return { 
                                                        ...i, 
                                                        oilRequired: newQty,
                                                        totalWeightKg: newQty * (i.packingWeight || 0)
                                                    };
                                                }
                                                return i;
                                            });
                                            setIndents(updatedIndents);
                                            
                                            // Recalculate total if this party is selected
                                            if (selectedParties.includes(editableIndent.partyName || '')) {
                                               const totalQty = updatedIndents
                                                .filter(i => selectedParties.includes(i.partyName || ''))
                                                .reduce((sum, i) => sum + i.oilRequired, 0);
                                               const totalKg = updatedIndents
                                                .filter(i => selectedParties.includes(i.partyName || ''))
                                                .reduce((sum, i) => sum + (i.totalWeightKg || 0), 0);
                                               setFormData(prev => ({ ...prev, indentQuantity: totalQty, totalWeightKg: totalKg, requiredQtyKg: totalKg }));
                                            }
                                          }}
                                          className="w-24 px-2 py-1 border border-border rounded bg-background text-foreground text-sm font-semibold focus:ring-2 focus:ring-primary/50 outline-none"
                                          min="0"
                                        />
                                      </td>
                                      <td className="px-4 py-3 text-sm font-medium text-foreground">{formatNumber(totalWeightKg)}</td>
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                        </div>
                        {pendingIndents.filter(i => categorizeOilType(normalizeProductKey(i.productName, i.packingSize)) === selectedProduct).length === 0 && (
                          <p className="text-sm text-muted-foreground mt-4 text-center italic">No orders found for this oil type</p>
                        )}
                      </div>
                    )}
                  </div>


                  <div className="mb-6">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Receive Tank No. <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.tankNo}
                      onChange={(e) => setFormData({ ...formData, tankNo: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
                    >
                      <option value="">-- Select Tank --</option>
                      <option value="1">Tank 1</option>
                      <option value="2">Tank 2</option>
                      <option value="3">Tank 3</option>
                    </select>
                  </div>
                  
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Remarks
                    </label>
                    <textarea
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      placeholder="Add any internal remarks here..."
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/50 outline-none h-20 resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      onClick={() => setShowIndentForm(false)}
                      className="border-border hover:bg-muted"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSubmitIndent}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[120px]"
                    >
                      Submit Indent
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default OilIndent;
