import { useState, useEffect } from "react";
import "./App.css";

// Interface definitions
interface InventoryItem {
  id: string;
  sku: string;
  quantity: number;
}

interface OnboardingItem {
  sku: string;
  quantity: number;
  unitCostCents: number;
}

interface KitComponent {
  id: string;
  variantId: string;
  quantity: number;
}

interface KitFormula {
  id: string;
  sku: string;
  name: string;
  components: KitComponent[];
}

interface KitComponentInput {
  variantId: string;
  quantity: number;
}

interface BarcodeAssignment {
  id?: string;
  variantId: string;
  barcodeValue: string;
  symbology: string;
  source: string;
  isPrimary: boolean;
  assignedAt?: string;
}

interface SerialTransition {
  from: string;
  to: string;
  reason: string;
  actor: string;
  referenceId: string | null;
  occurredAt: string;
}

interface SerialItem {
  id: string;
  serialNumber: string;
  sku: string;
  variantId?: string;
  status: string;
  locationId: string;
  tenantId: string;
  registeredAt: string;
  history: SerialTransition[];
}

interface JournalLine {
  id: string;
  account: {
    code: string;
    name: string;
    category: string;
  };
  amountCents: number;
  type: "debit" | "credit";
  memo: string;
}

interface JournalEntry {
  id: string;
  tenantId: string;
  date: string;
  description: string;
  referenceId: string | null;
  method: string;
  lines: JournalLine[];
}

interface ValuationOutput {
  variantId: string;
  quantity: number;
  totalCostCents: number;
  unitCostCents: number;
  methodUsed: string;
}

const API_BASE = "http://localhost:5000/api";

// Inline SVG Icon components for premium presentation
const Icons = {
  Dashboard: () => (
    <svg className="tab-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  Onboarding: () => (
    <svg className="tab-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  Barcode: () => (
    <svg className="tab-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 5v14M6 5v14M10 5v14M14 5v14M17 5v14M21 5v14M3 9h18M3 15h18" />
    </svg>
  ),
  Serial: () => (
    <svg className="tab-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  Kit: () => (
    <svg className="tab-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </svg>
  ),
  Bookkeeping: () => (
    <svg className="tab-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
  Outbox: () => (
    <svg className="tab-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M7 8h10M7 12h10M8 20h8" />
    </svg>
  ),
  Forecasting: () => (
    <svg className="tab-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
    </svg>
  ),
  Scanner: () => (
    <svg className="tab-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h4v4H4zm12 0h4v4h-4zM4 16h4v4H4zm12 0h4v4h-4zM9 9h6v6H9z" />
    </svg>
  ),
  Database: ({ active }: { active: boolean }) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={active ? "#34d399" : "#f87171"} strokeWidth="2.5" className={active ? "pulse-icon" : ""}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  ),
  Shipping: () => (
    <svg className="tab-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  )
};

function App() {
  const [activeTab, setActiveTab] = useState<"overview" | "onboarding" | "barcodes" | "serials" | "kits" | "bookkeeping" | "outbox" | "forecasting" | "scanner" | "shipping">("overview");

  // Core metrics & state from DB
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [barcodeList, setBarcodeList] = useState<BarcodeAssignment[]>([]);
  const [serialList, setSerialList] = useState<SerialItem[]>([]);
  const [kitList, setKitList] = useState<KitFormula[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  
  const [dbStatus, setDbStatus] = useState({ connected: false, latency: 0, loading: true });
  
  // Onboarding Form State
  const [locationId, setLocationId] = useState("Main Store");
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);
  const [onboardingItems, setOnboardingItems] = useState<OnboardingItem[]>([
    { sku: "IPHONE-15", quantity: 10, unitCostCents: 80000 },
    { sku: "MACBOOK-AIR", quantity: 5, unitCostCents: 120000 },
  ]);
  const [onboardingMsg, setOnboardingMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Barcode State
  const [barcodeInput, setBarcodeInput] = useState<BarcodeAssignment>({
    variantId: "IPHONE-15",
    barcodeValue: "012345678905",
    symbology: "upc_a",
    source: "internal",
    isPrimary: true,
  });
  const [scanValue, setScanValue] = useState("");
  const [scanContext, setScanContext] = useState("pos");
  const [scanOutput, setScanOutput] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [barcodeMsg, setBarcodeMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [barcodeSearch, setBarcodeSearch] = useState("");

  // Serial State
  const [serialQuery, setSerialQuery] = useState("");
  const [serialHistory, setSerialHistory] = useState<SerialItem | null>(null);
  const [newSerialNum, setNewSerialNum] = useState("SN-MACBOOK-999");
  const [serialVariant, setSerialVariant] = useState("MACBOOK-AIR");
  const [serialLocation, setSerialLocation] = useState("Main Store");
  const [serialActor, setSerialActor] = useState("admin-1");
  const [serialRefId, setSerialRefId] = useState("PO-202");
  const [serialMsg, setSerialMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isRegisteringSerial, setIsRegisteringSerial] = useState(false);
  const [isSerialLifecycleAction, setIsSerialLifecycleAction] = useState<"receive" | "sell" | "return" | "restock" | null>(null);
  const [serialSearch, setSerialSearch] = useState("");

  // Kit State
  const [kitSku, setKitSku] = useState("KIT-OFFICE-KIT");
  const [kitName, setKitName] = useState("Executive Tech Bundle");
  const [kitComponents, setKitComponents] = useState<KitComponentInput[]>([
    { variantId: "IPHONE-15", quantity: 1 },
    { variantId: "MACBOOK-AIR", quantity: 1 }
  ]);
  const [sellKitSku, setSellKitSku] = useState("");
  const [sellKitQty, setSellKitQty] = useState(1);
  const [kitMsg, setKitMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Bookkeeping & Valuation State
  const [valSku, setValSku] = useState("IPHONE-15");
  const [valQty, setValQty] = useState(5);
  const [valMethod, setValMethod] = useState("fifo");
  const [valOutput, setValOutput] = useState<ValuationOutput | null>(null);
  
  // Custom interactive chart comparisons
  const [comparisonData, setComparisonData] = useState<{ fifo: number; wac: number; loading: boolean } | null>(null);
  const [bookkeepingMsg, setBookkeepingMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Tenant Config State
  const [tenantId, setTenantId] = useState("DEFAULT");
  const [tenantAccountingMethod, setTenantAccountingMethod] = useState("accrual");
  const [tenantCostingMethod, setTenantCostingMethod] = useState("fifo");
  const [tenantCurrencyCode, setTenantCurrencyCode] = useState("USD");
  const [tenantFiscalYearStart, setTenantFiscalYearStart] = useState("01-01");
  const [tenantMsg, setTenantMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Global Fetch & Metrics
  const fetchAllData = async () => {
    const start = performance.now();
    try {
      const [invData, barcodeData, serialData, kitData, ledgerData] = await Promise.all([
        fetch(`${API_BASE}/inventory`).then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`${API_BASE}/barcodes`).then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`${API_BASE}/serials`).then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`${API_BASE}/kits`).then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`${API_BASE}/accounting/ledger?tenantId=${tenantId}`).then(res => res.ok ? res.json() : []).catch(() => [])
      ]);

      setInventoryList(invData);
      setBarcodeList(barcodeData);
      setSerialList(serialData);

      setKitList(kitData);
      if (kitData.length > 0 && !sellKitSku) {
        setSellKitSku(kitData[0].sku);
      }

      setJournalEntries(ledgerData);

      const end = performance.now();
      setDbStatus({
        connected: true,
        latency: Math.round(end - start),
        loading: false
      });
    } catch (e) {
      console.error("Database connection failure", e);
      setDbStatus({ connected: false, latency: 0, loading: false });
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 15000); // refresh metrics
    return () => clearInterval(interval);
  }, [tenantId]);

  const fetchTenantConfig = async (tId: string) => {
    try {
      const res = await fetch(`${API_BASE}/accounting/tenant-config/${tId}`);
      if (res.ok) {
        const data = await res.json();
        setTenantAccountingMethod(data.accountingMethod);
        setTenantCostingMethod(data.costingMethod);
        setTenantCurrencyCode(data.currencyCode);
        setTenantFiscalYearStart(data.fiscalYearStart);
        if (data.costingMethod === "weighted_average_cost") {
          setValMethod("wac");
        } else {
          setValMethod("fifo");
        }
      }
    } catch (e) {
      console.error("Failed to load tenant config", e);
    }
  };

  useEffect(() => {
    fetchTenantConfig(tenantId);
  }, [tenantId]);

  // Sync validation when SKU changes or quantity changes to show comparison chart
  useEffect(() => {
    if (valSku && valQty > 0) {
      triggerValuationComparison(valSku, valQty);
    }
  }, [valSku, valQty, tenantId]);

  const triggerValuationComparison = async (sku: string, qty: number) => {
    setComparisonData((prev) => ({ ...(prev || { fifo: 0, wac: 0 }), loading: true }));
    try {
      const [fifoRes, wacRes] = await Promise.all([
        fetch(`${API_BASE}/accounting/valuation/${sku}?quantity=${qty}&method=fifo&tenantId=${tenantId}`),
        fetch(`${API_BASE}/accounting/valuation/${sku}?quantity=${qty}&method=wac&tenantId=${tenantId}`)
      ]);
      
      const [fifoVal, wacVal] = await Promise.all([
        fifoRes.ok ? fifoRes.json() : null,
        wacRes.ok ? wacRes.json() : null
      ]);

      setComparisonData({
        fifo: fifoVal ? fifoVal.totalCostCents / 100 : 0,
        wac: wacVal ? wacVal.totalCostCents / 100 : 0,
        loading: false
      });
    } catch (err) {
      setComparisonData({ fifo: 0, wac: 0, loading: false });
    }
  };

  // Actions
  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardingMsg(null);
    try {
      const res = await fetch(`${API_BASE}/onboarding/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          asOfDate,
          items: onboardingItems.filter(i => i.sku.trim() !== ""),
          actorId: "dashboard-onboarder",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setOnboardingMsg({ type: "success", text: "Inventory Setup Successful! Opening cost layers registered." });
        setOnboardingItems([{ sku: "", quantity: 0, unitCostCents: 0 }]);
        fetchAllData();
      } else {
        setOnboardingMsg({ type: "error", text: data.error || "Failed to submit opening balances." });
      }
    } catch (err) {
      setOnboardingMsg({ type: "error", text: "API Connection issue." });
    }
  };

  const handleQuickRestock = async (sku: string, qty = 10) => {
    try {
      const res = await fetch(`${API_BASE}/inventory/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, amount: qty }),
      });
      if (res.ok) {
        // Post balancing journal entry automatically so bookkeeping updates too!
        await fetch(`${API_BASE}/accounting/stock-received`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            variantId: sku,
            totalCostCents: qty * 10000, // assuming mock cost layers
            purchaseOrderId: `RE-STOCK-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.floor(Math.random() * 1000000)}`,
            supplierName: "Emergency Wholesaler",
            tenantId: tenantId,
            accountingMethod: tenantAccountingMethod,
            costingMethod: tenantCostingMethod
          })
        });
        fetchAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssignBarcode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBarcodeMsg(null);
    try {
      const res = await fetch(`${API_BASE}/barcodes/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(barcodeInput),
      });
      const data = await res.json();
      if (res.ok) {
        setBarcodeMsg({ type: "success", text: `Successfully mapped barcode '${barcodeInput.barcodeValue}' to SKU '${barcodeInput.variantId}'.` });
        fetchAllData();
      } else {
        setBarcodeMsg({ type: "error", text: data.error || "Failed to assign barcode." });
      }
    } catch (err) {
      setBarcodeMsg({ type: "error", text: "API Connection issue." });
    }
  };

  const handleGenerateBarcode = async () => {
    setBarcodeMsg(null);
    try {
      const res = await fetch(`${API_BASE}/barcodes/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: barcodeInput.variantId }),
      });
      const data = await res.json();
      if (res.ok) {
        setBarcodeInput({ ...barcodeInput, barcodeValue: data.barcodeValue });
        setBarcodeMsg({ type: "success", text: `Generated unique barcode: ${data.barcodeValue}` });
      } else {
        setBarcodeMsg({ type: "error", text: data.error || "Failed to generate." });
      }
    } catch (err) {
      setBarcodeMsg({ type: "error", text: "API Connection issue." });
    }
  };

  const handleBarcodeScan = async () => {
    setScanOutput(null);
    if (!scanValue) return;
    setIsScanning(true);
    try {
      const res = await fetch(`${API_BASE}/barcodes/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawScan: scanValue, context: scanContext }),
      });
      const data = await res.json();
      if (res.ok) {
        // If scan context is pos, run stock sold journal entry in the background to emulate POS
        if (scanContext === "pos") {
          await fetch(`${API_BASE}/accounting/stock-sold`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              variantId: data.variantId,
              quantity: 1,
              salePriceCents: 120000,
              saleId: `POS-SALE-${crypto.randomUUID()}`,
              tenantId: tenantId,
              accountingMethod: tenantAccountingMethod,
              costingMethod: tenantCostingMethod
            })
          });
        }
        setScanOutput(JSON.stringify(data, null, 2));
        fetchAllData();
      } else {
        setScanOutput(JSON.stringify({ error: data.error || "Route not found or inactive scan target." }, null, 2));
      }
    } catch (err) {
      setScanOutput(JSON.stringify({ error: "Express backend API connection failed." }, null, 2));
    } finally {
      setIsScanning(false);
    }
  };

  const handleRegisterSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    setSerialMsg(null);
    setIsRegisteringSerial(true);
    try {
      const res = await fetch(`${API_BASE}/serials/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serialNumber: newSerialNum,
          variantId: serialVariant,
          tenantId: tenantId,
          locationId: serialLocation,
          actorId: serialActor,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSerialMsg({ type: "success", text: `Registered SN: ${newSerialNum} successfully.` });
        setSerialQuery(newSerialNum);
        handleFetchSerialHistory(newSerialNum);
        fetchAllData();
      } else {
        setSerialMsg({ type: "error", text: data.error || "Failed registration." });
      }
    } catch (err) {
      setSerialMsg({ type: "error", text: "API connection error." });
    } finally {
      setIsRegisteringSerial(false);
    }
  };

  const handleSerialLifecycleAction = async (action: "receive" | "sell" | "return" | "restock") => {
    setSerialMsg(null);
    if (!serialQuery) {
      setSerialMsg({ type: "error", text: "Please query or enter a Serial Number first." });
      return;
    }
    setIsSerialLifecycleAction(action);
    try {
      const payload: any = {
        serialNumber: serialQuery,
        tenantId: tenantId,
        actorId: serialActor,
      };
      if (action === "receive") {
        payload.locationId = serialLocation;
        payload.purchaseOrderId = serialRefId;
      } else if (action === "sell") {
        payload.saleId = serialRefId;
      } else {
        payload.returnId = serialRefId;
      }

      const res = await fetch(`${API_BASE}/serials/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setSerialMsg({ type: "success", text: `State transition to ${action.toUpperCase()} processed.` });
        handleFetchSerialHistory(serialQuery);
        fetchAllData();
      } else {
        setSerialMsg({ type: "error", text: data.error || "Invalid state transition blocked by domain guards." });
      }
    } catch (err) {
      setSerialMsg({ type: "error", text: "API connection failure." });
    } finally {
      setIsSerialLifecycleAction(null);
    }
  };

  const handleFetchSerialHistory = async (sn: string) => {
    setSerialHistory(null);
    if (!sn) return;
    try {
      const res = await fetch(`${API_BASE}/serials/${sn}/history`);
      const data = await res.json();
      if (res.ok) {
        setSerialHistory(data);
        setSerialQuery(sn);
      } else {
        setSerialMsg({ type: "error", text: data.error || "Serial not found." });
      }
    } catch (err) {
      setSerialMsg({ type: "error", text: "API connection failure." });
    }
  };

  const handleCreateKit = async (e: React.FormEvent) => {
    e.preventDefault();
    setKitMsg(null);
    try {
      const res = await fetch(`${API_BASE}/kits/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: kitSku,
          name: kitName,
          components: kitComponents.filter(c => c.variantId !== ""),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setKitMsg({ type: "success", text: `Compiled kit formula '${kitSku}' and persisted in database.` });
        setSellKitSku(kitSku);
        fetchAllData();
      } else {
        setKitMsg({ type: "error", text: data.error || "Failed kit compilation." });
      }
    } catch (err) {
      setKitMsg({ type: "error", text: "Connection issues." });
    }
  };

  const handleDispatchKitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setKitMsg(null);
    if (!sellKitSku) {
      setKitMsg({ type: "error", text: "No kit selected." });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/kits/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kitSku: sellKitSku,
          quantity: sellKitQty,
          saleId: "KIT-SALE-" + crypto.randomUUID(),
          actorId: "cashier-2",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setKitMsg({ type: "success", text: `Atomically decremented components inventory for ${sellKitQty}x '${sellKitSku}'!` });
        fetchAllData();
      } else {
        setKitMsg({ type: "error", text: data.error || "Insufficient inventory for composite kit sale." });
      }
    } catch (err) {
      setKitMsg({ type: "error", text: "Connection error." });
    }
  };

  const handleCalculateValuation = async (e: React.FormEvent) => {
    e.preventDefault();
    setValOutput(null);
    setBookkeepingMsg(null);
    try {
      const res = await fetch(`${API_BASE}/accounting/valuation/${valSku}?quantity=${valQty}&method=${valMethod}&tenantId=${tenantId}`);
      const data = await res.json();
      if (res.ok) {
        setValOutput(data);
      } else {
        setBookkeepingMsg({ type: "error", text: data.error || "Calculation failed." });
      }
    } catch (err) {
      setBookkeepingMsg({ type: "error", text: "Valuation API issue." });
    }
  };

  // UI calculations
  const totalStockCount = inventoryList.reduce((acc, curr) => acc + curr.quantity, 0);
  const lowStockItems = inventoryList.filter(item => item.quantity <= 2);

  // Search filter implementations
  const filteredBarcodes = barcodeList.filter(b => 
    b.variantId.toLowerCase().includes(barcodeSearch.toLowerCase()) || 
    b.barcodeValue.includes(barcodeSearch)
  );

  const filteredSerials = serialList.filter(s => 
    s.serialNumber.toLowerCase().includes(serialSearch.toLowerCase()) || 
    s.sku.toLowerCase().includes(serialSearch.toLowerCase())
  );

  return (
    <div className="dashboard-container">
      {/* HUD Bar - System status */}
      <div className="hud-bar">
        <div className="hud-metric">
          <Icons.Database active={dbStatus.connected} />
          <span>SQLite Database: </span>
          <strong className={dbStatus.connected ? "color-success" : "color-error"}>
            {dbStatus.connected ? "ACTIVE" : "OFFLINE"}
          </strong>
        </div>
        {dbStatus.connected && (
          <>
            <div className="hud-metric">
              <span>API Ping: </span>
              <strong>{dbStatus.latency}ms</strong>
            </div>
            <div className="hud-metric">
              <span>Tenant: </span>
              <input
                type="text"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value.toUpperCase())}
                style={{
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "4px",
                  color: "var(--accent-color-light)",
                  fontWeight: "bold",
                  fontSize: "0.85rem",
                  width: "90px",
                  padding: "1px 4px",
                  textAlign: "center"
                }}
              />
            </div>
            <div className="hud-metric">
              <span>Persistence Drivers: </span>
              <strong>Prisma 7</strong>
            </div>
            <button className="btn-refresh" onClick={fetchAllData} title="Force Sync API Metrics" aria-label="Force Sync API Metrics">
              🔄 Sync
            </button>
          </>
        )}
      </div>

      {/* Main Header */}
      <header className="dashboard-header">
        <div className="brand-section">
          <h1>DDD INVENTORY PORTAL</h1>
          <p>Event-Driven Inventory Engine & Double-Entry Accounting Hub</p>
        </div>
        <nav className="nav-tabs" role="tablist" aria-label="Main Navigation">
          <button role="tab" aria-selected={activeTab === "overview"} aria-label="Switch to Overview tab" className={`tab-btn ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
            <Icons.Dashboard />
            <span>Overview</span>
          </button>
          <button role="tab" aria-selected={activeTab === "onboarding"} aria-label="Switch to Onboarding tab" className={`tab-btn ${activeTab === "onboarding" ? "active" : ""}`} onClick={() => setActiveTab("onboarding")}>
            <Icons.Onboarding />
            <span>Onboarding</span>
          </button>
          <button role="tab" aria-selected={activeTab === "barcodes"} aria-label="Switch to Barcodes tab" className={`tab-btn ${activeTab === "barcodes" ? "active" : ""}`} onClick={() => setActiveTab("barcodes")}>
            <Icons.Barcode />
            <span>Barcodes</span>
          </button>
          <button role="tab" aria-selected={activeTab === "serials"} aria-label="Switch to Serials tab" className={`tab-btn ${activeTab === "serials" ? "active" : ""}`} onClick={() => setActiveTab("serials")}>
            <Icons.Serial />
            <span>Serials</span>
          </button>
          <button role="tab" aria-selected={activeTab === "kits"} aria-label="Switch to Kitting tab" className={`tab-btn ${activeTab === "kits" ? "active" : ""}`} onClick={() => setActiveTab("kits")}>
            <Icons.Kit />
            <span>Kitting</span>
          </button>
          <button role="tab" aria-selected={activeTab === "bookkeeping"} aria-label="Switch to Ledger tab" className={`tab-btn ${activeTab === "bookkeeping" ? "active" : ""}`} onClick={() => setActiveTab("bookkeeping")}>
            <Icons.Bookkeeping />
            <span>Ledger</span>
          </button>
          <button role="tab" aria-selected={activeTab === "outbox"} aria-label="Switch to Outbox tab" className={`tab-btn ${activeTab === "outbox" ? "active" : ""}`} onClick={() => setActiveTab("outbox")}>
            <Icons.Outbox />
            <span>Outbox</span>
          </button>
          <button role="tab" aria-selected={activeTab === "forecasting"} aria-label="Switch to Forecasting tab" className={`tab-btn ${activeTab === "forecasting" ? "active" : ""}`} onClick={() => setActiveTab("forecasting")}>
            <Icons.Forecasting />
            <span>Forecasting</span>
          </button>
          <button role="tab" aria-selected={activeTab === "scanner"} aria-label="Switch to Mobile Scanner tab" className={`tab-btn ${activeTab === "scanner" ? "active" : ""}`} onClick={() => setActiveTab("scanner")}>
            <Icons.Scanner />
            <span>Mobile Scanner</span>
          </button>
          <button role="tab" aria-selected={activeTab === "shipping"} aria-label="Switch to Shipping & Logistics tab" className={`tab-btn ${activeTab === "shipping" ? "active" : ""}`} onClick={() => setActiveTab("shipping")}>
            <Icons.Shipping />
            <span>Shipping & Logistics</span>
          </button>
        </nav>
      </header>

      {/* Metrics Banner */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">System SKUs</div>
          <div className="stat-value">{inventoryList.length || "Loading..."}</div>
          <div className="stat-desc">Unique Catalog Variants</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Units Available</div>
          <div className="stat-value">{dbStatus.loading ? "..." : totalStockCount}</div>
          <div className="stat-desc highlight">On-hand Warehouse Stock</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Assigned Barcodes</div>
          <div className="stat-value">{barcodeList.length}</div>
          <div className="stat-desc">GS1/Internal Bindings</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">General Ledger</div>
          <div className="stat-value">{journalEntries.length}</div>
          <div className="stat-desc">Audit Journal Entries</div>
        </div>
      </section>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="panel-grid-1-2">
          {/* Action Center & Warnings */}
          <div className="space-y-4">
            <div className="workspace-panel bg-panel-alert">
              <h2 className="title-warning">Inventory Alerts</h2>
              {lowStockItems.length > 0 ? (
                <div className="alert-list" role="status" aria-live="polite">
                  {lowStockItems.map((item, idx) => (
                    <div key={idx} className={`alert-card ${item.quantity === 0 ? "alert-depleted" : "alert-warning"}`}>
                      <div className="alert-header-info">
                        <strong>{item.sku}</strong>
                        <span className="badge badge-error">
                          {item.quantity === 0 ? "DEPLETED" : `${item.quantity} units left`}
                        </span>
                      </div>
                      <p className="alert-desc-text">
                        {item.quantity === 0
                          ? "Stock is completely out. Shopify webhook and POS transactions are currently blocked."
                          : "Stock is low. Consider restocking before composite kit allocations fail."}
                      </p>
                      <button className="btn btn-primary btn-xs" aria-label={"Quick Restock 15 Units for " + item.sku} onClick={() => handleQuickRestock(item.sku, 15)}>
                        📥 Quick Restock 15 Units
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="alert-success-placeholder" role="status" aria-live="polite">
                  <div className="checkmark-circle">✓</div>
                  <p>All catalog levels healthy. No low stock invariants breached.</p>
                </div>
              )}
            </div>

            <div className="workspace-panel">
              <h2>Quick Stock Actions</h2>
              <div className="quick-actions-panel">
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "15px" }}>
                  Adjust shelf quantities directly on the database repository (equivalent to a warehouse receiving count).
                </p>
                <div className="form-group" style={{ marginBottom: "15px" }}>
                  <label htmlFor="quick-restock-sku">SKU Variant</label>
                  <select
                    id="quick-restock-sku"
                    className="form-control"
                    value={valSku}
                    onChange={(e) => setValSku(e.target.value)}
                  >
                    {inventoryList.map(item => (
                      <option key={item.id} value={item.sku}>{item.sku} ({item.quantity} available)</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <button className="btn btn-secondary" onClick={() => handleQuickRestock(valSku, 10)} disabled={!valSku} aria-disabled={!valSku} title={!valSku ? "Select a SKU first" : "Receive 10 units"} aria-label={!valSku ? "Select a SKU first" : "Receive 10 units"}>
                    + Receive 10 Units
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={!valSku || (inventoryList.find(i => i.sku === valSku)?.quantity || 0) <= 0}
                    aria-disabled={!valSku || (inventoryList.find(i => i.sku === valSku)?.quantity || 0) <= 0}
                    title={!valSku ? "Select a SKU first" : (inventoryList.find(i => i.sku === valSku)?.quantity || 0) <= 0 ? "Insufficient stock" : "Dispatch 1 unit"}
                    aria-label={!valSku ? "Select a SKU first" : (inventoryList.find(i => i.sku === valSku)?.quantity || 0) <= 0 ? "Insufficient stock" : "Dispatch 1 unit"}
                    onClick={async () => {
                      const res = await fetch(`${API_BASE}/inventory/dispatch`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sku: valSku, amount: 1 }),
                      });
                      if (res.ok) {
                        // post stock sold bookkeeping line
                        await fetch(`${API_BASE}/accounting/stock-sold`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            variantId: valSku,
                            quantity: 1,
                            salePriceCents: 10000,
                            saleId: `MANUAL-${crypto.randomUUID()}`,
                            tenantId: tenantId,
                            accountingMethod: tenantAccountingMethod,
                            costingMethod: tenantCostingMethod
                          })
                        });
                        fetchAllData();
                      }
                    }}
                  >
                    - Dispatch 1 Unit
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Active Inventory Grid */}
          <div className="workspace-panel">
            <h2>Active Inventory Levels</h2>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Variant SKU</th>
                    <th>Warehouse Stock</th>
                    <th>Unit of Measure</th>
                    <th>Status Badge</th>
                    <th>Restock Option</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryList.length > 0 ? (
                    inventoryList.map((inv, idx) => (
                      <tr key={idx} className={inv.quantity === 0 ? "row-depleted" : ""}>
                        <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{inv.sku}</td>
                        <td>
                          <span style={{ fontSize: "1.1rem", fontWeight: "bold" }}>{inv.quantity}</span>
                        </td>
                        <td>EA (Each)</td>
                        <td>
                          <span className={`badge ${inv.quantity === 0 ? "badge-error" : inv.quantity <= 2 ? "badge-warning" : "badge-success"}`}>
                            {inv.quantity === 0 ? "Depleted" : inv.quantity <= 2 ? "Low Stock" : "Healthy"}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-secondary btn-xs" aria-label={"Restock 10 units for " + inv.sku} style={{ padding: "6px 12px" }} onClick={() => handleQuickRestock(inv.sku, 10)}>
                            Restock +10
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                        No inventory matches. Go to Onboarding to populate stock levels.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Onboarding */}
      {activeTab === "onboarding" && (
        <div className="workspace-panel">
          <h2>Opening Stock Balances Setup</h2>
          <p style={{ marginBottom: "25px", color: "var(--text-muted)" }}>
            Post initial opening balances. This creates variant database models and posts matching opening debit/credit entries to the bookkeeping general ledger.
          </p>

          <form onSubmit={handleOnboardingSubmit}>
            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="location-id">Location ID</label>
                <input id="location-id" className="form-control" type="text" value={locationId} onChange={(e) => setLocationId(e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="as-of-date">Opening Costing Date</label>
                <input id="as-of-date" className="form-control" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} required />
              </div>
            </div>

            <h3 style={{ color: "var(--text-primary)", fontSize: "1.1rem", margin: "20px 0 10px" }}>Variant Ledger Items</h3>
            <div className="table-container" style={{ marginBottom: "25px" }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Variant SKU</th>
                    <th>Opening Stock Qty</th>
                    <th>Unit Cost (Cents)</th>
                    <th style={{ width: "80px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {onboardingItems.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          className="form-control"
                          aria-label={"SKU for onboarding row " + (index + 1)}
                          type="text"
                          placeholder="e.g. SKU-NAME"
                          value={item.sku}
                          onChange={(e) => {
                            const updated = [...onboardingItems];
                            updated[index].sku = e.target.value;
                            setOnboardingItems(updated);
                          }}
                          required
                        />
                      </td>
                      <td>
                        <input
                          className="form-control"
                          aria-label={"Quantity for onboarding row " + (index + 1)}
                          type="number"
                          placeholder="e.g. 50"
                          value={item.quantity || ""}
                          onChange={(e) => {
                            const updated = [...onboardingItems];
                            updated[index].quantity = parseInt(e.target.value) || 0;
                            setOnboardingItems(updated);
                          }}
                          required
                          min="1"
                        />
                      </td>
                      <td>
                        <input
                          className="form-control"
                          aria-label={"Unit Cost for onboarding row " + (index + 1)}
                          type="number"
                          placeholder="e.g. 25000 ($250.00)"
                          value={item.unitCostCents || ""}
                          onChange={(e) => {
                            const updated = [...onboardingItems];
                            updated[index].unitCostCents = parseInt(e.target.value) || 0;
                            setOnboardingItems(updated);
                          }}
                          required
                          min="1"
                        />
                      </td>
                      <td>
                        {onboardingItems.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-danger btn-xs"
                            aria-label={item.sku ? "Remove onboarding row for " + item.sku : "Remove onboarding row " + (index + 1)}
                            onClick={() => setOnboardingItems(onboardingItems.filter((_, i) => i !== index))}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setOnboardingItems([...onboardingItems, { sku: "", quantity: 0, unitCostCents: 0 }])}
              >
                + Add Row
              </button>
              <button type="submit" className="btn btn-primary">
                Initialize Opening Balances & Save layers
              </button>
            </div>
          </form>

          {onboardingMsg && <div className={`feedback-msg ${onboardingMsg.type}`} role="status" aria-live="polite">{onboardingMsg.text}</div>}
        </div>
      )}

      {/* Tab: Barcodes */}
      {activeTab === "barcodes" && (
        <div className="panel-grid-1-2">
          {/* Assignment Panel */}
          <div className="workspace-panel">
            <h2>Assign Symbology Mapping</h2>
            <form onSubmit={handleAssignBarcode}>
              <div className="form-group" style={{ marginBottom: "15px" }}>
                <label htmlFor="barcode-variant-sku">Variant SKU</label>
                <select
                  id="barcode-variant-sku"
                  className="form-control"
                  value={barcodeInput.variantId}
                  onChange={(e) => setBarcodeInput({ ...barcodeInput, variantId: e.target.value })}
                  required
                >
                  {inventoryList.map(item => (
                    <option key={item.id} value={item.sku}>{item.sku}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: "15px" }}>
                <label htmlFor="barcode-symbology">Symbology Standard</label>
                <select
                  id="barcode-symbology"
                  className="form-control"
                  value={barcodeInput.symbology}
                  onChange={(e) => setBarcodeInput({ ...barcodeInput, symbology: e.target.value })}
                >
                  <option value="upc_a">UPC-A (12-Digit Retail)</option>
                  <option value="ean_13">EAN-13 (International)</option>
                  <option value="code_128">Code 128 (Alphanumeric)</option>
                  <option value="qr">QR Code (Matrix)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: "15px" }}>
                <label htmlFor="barcode-id-value">Barcode ID Value</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    id="barcode-id-value"
                    className="form-control"
                    style={{ flex: 1 }}
                    type="text"
                    value={barcodeInput.barcodeValue}
                    onChange={(e) => setBarcodeInput({ ...barcodeInput, barcodeValue: e.target.value })}
                    required
                  />
                  <button type="button" className="btn btn-secondary" style={{ padding: "0 15px" }} onClick={handleGenerateBarcode}>
                    Gen Code-128
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label htmlFor="barcode-source">GS1 Registration Origin</label>
                <select
                  id="barcode-source"
                  className="form-control"
                  value={barcodeInput.source}
                  onChange={(e) => setBarcodeInput({ ...barcodeInput, source: e.target.value })}
                >
                  <option value="supplier">Supplier Barcode</option>
                  <option value="internal">Internal Warehouse Barcode</option>
                  <option value="gs1">GS1 Standard</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <input
                  type="checkbox"
                  id="isPrimary"
                  checked={barcodeInput.isPrimary}
                  onChange={(e) => setBarcodeInput({ ...barcodeInput, isPrimary: e.target.checked })}
                />
                <label htmlFor="isPrimary" style={{ textTransform: "none", cursor: "pointer", userSelect: "none" }}>
                  Set as primary scanning reference for SKU
                </label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                Assign & Register Barcode
              </button>
            </form>

            {barcodeMsg && <div className={`feedback-msg ${barcodeMsg.type}`} role="status" aria-live="polite">{barcodeMsg.text}</div>}
          </div>

          {/* Catalog Registry & Simulator */}
          <div className="space-y-4">
            {/* Searchable lists */}
            <div className="workspace-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2>Symbology Directory</h2>
                <input
                  type="text"
                  placeholder="Filter by SKU or barcode..."
                  className="form-control"
                  style={{ width: "220px", padding: "6px 12px" }}
                  value={barcodeSearch}
                  onChange={(e) => setBarcodeSearch(e.target.value)}
                />
              </div>
              <div className="table-container" style={{ maxHeight: "200px", overflowY: "auto" }}>
                <table className="custom-table" style={{ fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Barcode Reference</th>
                      <th>Standard</th>
                      <th>Primary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBarcodes.length > 0 ? (
                      filteredBarcodes.map((b, idx) => (
                        <tr
                          key={idx}
                          className="clickable-row"
                          role="button"
                          tabIndex={0}
                          aria-label={`Select barcode ${b.barcodeValue}`}
                          onClick={() => {
                            setScanValue(b.barcodeValue);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setScanValue(b.barcodeValue);
                            }
                          }}
                          title="Click to populate simulator scan input"
                        >
                          <td style={{ fontWeight: 600 }}>{b.variantId}</td>
                          <td>
                            <code className="barcode-font">{b.barcodeValue}</code>
                          </td>
                          <td>{b.symbology.toUpperCase()}</td>
                          <td>{b.isPrimary ? <span className="color-success">★ Yes</span> : "No"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          No barcodes mapped. Assign one to test scanner.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Simulator scan */}
            <div className="workspace-panel">
              <h2>Scanner Event Dispatcher Simulation</h2>
              <p style={{ color: "var(--text-muted)", marginBottom: "15px", fontSize: "0.85rem" }}>
                Physically trigger a barcode reader scan event. The system routes the variant ID to the matching event workflow.
              </p>

              <div className="form-grid-2" style={{ marginBottom: "15px" }}>
                <div className="form-group">
                  <label htmlFor="barcode-string">Barcode String</label>
                  <input
                    id="barcode-string"
                    className="form-control"
                    type="text"
                    placeholder="Enter or select barcode from table"
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="scan-dispatch-target">Scan Dispatch Target</label>
                  <select id="scan-dispatch-target" className="form-control" value={scanContext} onChange={(e) => setScanContext(e.target.value)}>
                    <option value="pos">Point of Sale (POS Sales)</option>
                    <option value="receiving">Goods Inflow Receiving</option>
                    <option value="cycle_count">Inventory Reconciliation</option>
                  </select>
                </div>
              </div>

              <button className="btn btn-primary" style={{ width: "100%", marginBottom: "15px" }} onClick={handleBarcodeScan} disabled={isScanning} aria-busy={isScanning} title={isScanning ? "Processing scan..." : "Trigger Scanner Ingestion Event"} aria-label={isScanning ? "Processing scan..." : "Trigger Scanner Ingestion Event"}>
                {isScanning ? <><span role="img" aria-hidden="true">⏳</span> Processing...</> : "Trigger Scanner Ingestion Event"}
              </button>

              {scanOutput && (
                <div style={{ background: "rgba(10, 15, 30, 0.8)", padding: "15px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                  <h4 style={{ color: "var(--text-primary)", margin: "0 0 10px 0", fontSize: "0.85rem" }}>Ingestion Diagnostic Logs</h4>
                  <pre
                    style={{
                      margin: 0,
                      fontFamily: "var(--mono-font)",
                      fontSize: "0.75rem",
                      color: "var(--text-primary)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {scanOutput}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Serials */}
      {activeTab === "serials" && (
        <div className="panel-grid-1-2">
          {/* Lifecycles control */}
          <div className="workspace-panel">
            <h2>Pre-Register Serial Units</h2>
            <form onSubmit={handleRegisterSerial} style={{ marginBottom: "25px" }}>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="new-serial-num">Unique Serial Code</label>
                <input id="new-serial-num" className="form-control" type="text" value={newSerialNum} onChange={(e) => setNewSerialNum(e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="serial-variant-mapping">SKU Variant Mapping</label>
                <select id="serial-variant-mapping" className="form-control" value={serialVariant} onChange={(e) => setSerialVariant(e.target.value)} required>
                  {inventoryList.map(item => (
                    <option key={item.id} value={item.sku}>{item.sku}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: "15px" }}>
                <label htmlFor="serial-location">Opening Location</label>
                <input id="serial-location" className="form-control" type="text" value={serialLocation} onChange={(e) => setSerialLocation(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={isRegisteringSerial} aria-busy={isRegisteringSerial} title={isRegisteringSerial ? "Registering serial item..." : "Pre-Register Serial Item"} aria-label={isRegisteringSerial ? "Registering serial item..." : "Pre-Register Serial Item"}>
                {isRegisteringSerial ? <><span role="img" aria-hidden="true">⏳</span> Registering...</> : "Pre-Register Serial Item"}
              </button>
            </form>

            <h2>Lifecycle Transitions SIM</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "15px" }}>
              Transitions the serial number state and verifies invariants (e.g. Cannot sell serial that is already SOLD or pending).
            </p>
            <div className="form-grid-2" style={{ marginBottom: "15px" }}>
              <div className="form-group">
                <label htmlFor="serial-actor">Authorized Actor</label>
                <input id="serial-actor" className="form-control" type="text" value={serialActor} onChange={(e) => setSerialActor(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="serial-ref-id">Ref Invoice / PO ID</label>
                <input id="serial-ref-id" className="form-control" type="text" value={serialRefId} onChange={(e) => setSerialRefId(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button className="btn btn-secondary" onClick={() => handleSerialLifecycleAction("receive")} disabled={isSerialLifecycleAction !== null} aria-busy={isSerialLifecycleAction === "receive"} title="Pending -> InStock" aria-label="Receive pending serial stock">
                {isSerialLifecycleAction === "receive" ? "Processing..." : "Receive Stock"}
              </button>
              <button className="btn btn-secondary" onClick={() => handleSerialLifecycleAction("sell")} disabled={isSerialLifecycleAction !== null} aria-busy={isSerialLifecycleAction === "sell"} title="InStock -> Sold" aria-label="Sell instock serial">
                {isSerialLifecycleAction === "sell" ? "Processing..." : "POS Sell"}
              </button>
              <button className="btn btn-secondary" onClick={() => handleSerialLifecycleAction("return")} disabled={isSerialLifecycleAction !== null} aria-busy={isSerialLifecycleAction === "return"} title="Sold -> Returned" aria-label="Return sold serial">
                {isSerialLifecycleAction === "return" ? "Processing..." : "Customer Return"}
              </button>
              <button className="btn btn-secondary" onClick={() => handleSerialLifecycleAction("restock")} disabled={isSerialLifecycleAction !== null} aria-busy={isSerialLifecycleAction === "restock"} title="Returned -> InStock" aria-label="Restock returned serial">
                {isSerialLifecycleAction === "restock" ? "Processing..." : "Restock Shelf"}
              </button>
            </div>

            {serialMsg && <div className={`feedback-msg ${serialMsg.type}`} role="status" aria-live="polite">{serialMsg.text}</div>}
          </div>

          {/* Directory & audit timeline */}
          <div className="space-y-4">
            {/* Serial List Directory */}
            <div className="workspace-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2>Serial Registry</h2>
                <input
                  type="text"
                  placeholder="Filter serials..."
                  className="form-control"
                  style={{ width: "200px", padding: "6px 12px" }}
                  value={serialSearch}
                  onChange={(e) => setSerialSearch(e.target.value)}
                />
              </div>
              <div className="table-container" style={{ maxHeight: "180px", overflowY: "auto" }}>
                <table className="custom-table" style={{ fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th>Serial Code</th>
                      <th>Mapped SKU</th>
                      <th>Current State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSerials.length > 0 ? (
                      filteredSerials.map((s, idx) => (
                        <tr
                          key={idx}
                          className="clickable-row"
                          role="button"
                          tabIndex={0}
                          aria-label={`Select serial ${s.serialNumber}`}
                          onClick={() => {
                            handleFetchSerialHistory(s.serialNumber);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleFetchSerialHistory(s.serialNumber);
                            }
                          }}
                          style={serialQuery === s.serialNumber ? { background: "rgba(255, 255, 255, 0.05)" } : {}}
                        >
                          <td style={{ fontWeight: "bold" }}>{s.serialNumber}</td>
                          <td>{s.sku}</td>
                          <td>
                            <span className={`badge ${s.status === "in_stock" ? "badge-success" : s.status === "sold" ? "badge-error" : "badge-warning"}`}>
                              {s.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          No serialized inventory records registered.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Timeline component */}
            <div className="workspace-panel">
              <h2>Serial Invariant Audit Flow</h2>
              {serialHistory ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                    <div>
                      <strong style={{ fontSize: "1.1rem" }}>{serialHistory.serialNumber}</strong>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Catalog variant SKU: {serialHistory.variantId || serialHistory.sku}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className="badge badge-info">{serialHistory.status}</span>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{serialHistory.locationId}</div>
                    </div>
                  </div>

                  <div className="timeline">
                    {serialHistory.history.length > 0 ? (
                      serialHistory.history.map((transition, idx) => (
                        <div key={idx} className={`timeline-item ${transition.to}`}>
                          <div className="timeline-content">
                            <div className="timeline-title">
                              <span>{transition.from.toUpperCase()} ➔ {transition.to.toUpperCase()}</span>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                {new Date(transition.occurredAt).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="timeline-meta">
                              <strong>Ref Event:</strong> {transition.referenceId || "None"} | <strong>Authorized by:</strong> {transition.actor}
                              {transition.reason && <div><strong>Reason/Memo:</strong> {transition.reason}</div>}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: "center", padding: "10px", color: "var(--text-muted)" }}>
                        No lifecycle transition events recorded. Pre-registered state only.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "25px", color: "var(--text-muted)" }}>
                  Select a serial item from the registry list to load and trace its transition audit flow.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Kits */}
      {activeTab === "kits" && (
        <div className="panel-grid-1-2">
          {/* Kit formula composer */}
          <div className="workspace-panel">
            <h2>Compile Bundle Recipe</h2>
            <form onSubmit={handleCreateKit}>
              <div className="form-group" style={{ marginBottom: "15px" }}>
                <label htmlFor="kit-sku">Composite Kit SKU Code</label>
                <input id="kit-sku" className="form-control" type="text" placeholder="e.g. BUNDLE-IPHONE-PRO" value={kitSku} onChange={(e) => setKitSku(e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: "15px" }}>
                <label htmlFor="kit-name">Bundle Marketing Name</label>
                <input id="kit-name" className="form-control" type="text" placeholder="iPhone Tech Pack" value={kitName} onChange={(e) => setKitName(e.target.value)} required />
              </div>

              <h3 style={{ color: "var(--text-primary)", fontSize: "1rem", margin: "20px 0 10px" }}>Formula Components</h3>
              {kitComponents.map((comp, index) => (
                <div key={index} style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                  <select
                    className="form-control"
                    aria-label={"Component SKU for kit row " + (index + 1)}
                    style={{ flex: 2 }}
                    value={comp.variantId}
                    onChange={(e) => {
                      const updated = [...kitComponents];
                      updated[index].variantId = e.target.value;
                      setKitComponents(updated);
                    }}
                    required
                  >
                    <option value="">-- Select SKU --</option>
                    {inventoryList.map(item => (
                      <option key={item.id} value={item.sku}>{item.sku}</option>
                    ))}
                  </select>
                  <input
                    className="form-control"
                    aria-label={"Quantity for kit row " + (index + 1)}
                    style={{ flex: 1 }}
                    type="number"
                    placeholder="Qty"
                    value={comp.quantity || ""}
                    onChange={(e) => {
                      const updated = [...kitComponents];
                      updated[index].quantity = parseInt(e.target.value) || 0;
                      setKitComponents(updated);
                    }}
                    required
                    min="1"
                  />
                  {kitComponents.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-xs"
                      aria-label={comp.variantId ? "Remove component row for " + comp.variantId : "Remove component row " + (index + 1)}
                      onClick={() => setKitComponents(kitComponents.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setKitComponents([...kitComponents, { variantId: "", quantity: 1 }])}>
                  + Add Component
                </button>
                <button type="submit" className="btn btn-primary">
                  Compile Formula
                </button>
              </div>
            </form>

            {kitMsg && <div className={`feedback-msg ${kitMsg.type}`} role="status" aria-live="polite">{kitMsg.text}</div>}
          </div>

          {/* Active formulas & Dispatcher POS sales */}
          <div className="space-y-4">
            <div className="workspace-panel">
              <h2>Registered Kit Formulas</h2>
              <div className="table-container" style={{ maxHeight: "200px" }}>
                <table className="custom-table" style={{ fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th>Kit SKU</th>
                      <th>Composite Name</th>
                      <th>Deduction Components</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kitList.length > 0 ? (
                      kitList.map((kit, idx) => (
                        <tr
                          key={idx}
                          className="clickable-row"
                          role="button"
                          tabIndex={0}
                          aria-label={`Select kit ${kit.sku}`}
                          onClick={() => {
                            setSellKitSku(kit.sku);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSellKitSku(kit.sku);
                            }
                          }}
                          style={sellKitSku === kit.sku ? { background: "rgba(255, 255, 255, 0.05)" } : {}}
                        >
                          <td style={{ fontWeight: "bold" }}>{kit.sku}</td>
                          <td>{kit.name}</td>
                          <td>
                            <div className="components-tags">
                              {kit.components.map((c, cIdx) => (
                                <span key={cIdx} className="comp-tag">
                                  {c.quantity}x {c.variantId}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          No custom compiled kits in database registry.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="workspace-panel">
              <h2>Atomic Kit POS Dispatcher</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "15px" }}>
                Deducting kit bundles runs an atomic two-pass stock evaluation validation. If *any* component fails stock check, the entire bundle transaction rolls back.
              </p>

              <form onSubmit={handleDispatchKitSale}>
                <div className="form-grid-2" style={{ marginBottom: "15px" }}>
                  <div className="form-group">
                    <label htmlFor="kit-sku-code">Kit SKU Code</label>
                    <select
                      id="kit-sku-code"
                      className="form-control"
                      value={sellKitSku}
                      onChange={(e) => setSellKitSku(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Kit --</option>
                      {kitList.map(k => (
                        <option key={k.id} value={k.sku}>{k.sku} - {k.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="sell-kit-qty">Quantity to Sell</label>
                    <input
                      id="sell-kit-qty"
                      className="form-control"
                      type="number"
                      value={sellKitQty}
                      onChange={(e) => setSellKitQty(parseInt(e.target.value) || 0)}
                      required
                      min="1"
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                  Deduct Components Atomically (POS checkout)
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Bookkeeping */}
      {activeTab === "bookkeeping" && (
        <div className="panel-grid-1-2">
          {/* Valuation side */}
          <div className="space-y-4">
            <div className="workspace-panel">
              <h2>Tenant Config Scoping</h2>
              <div className="form-group" style={{ marginBottom: "15px" }}>
                <label htmlFor="tenant-id">Active Tenant Context ID</label>
                <input
                  id="tenant-id"
                  className="form-control"
                  type="text"
                  placeholder="e.g. DEFAULT, TENANT_A"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value.toUpperCase())}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="tenant-accounting-method">Accounting Standard</label>
                <select
                  id="tenant-accounting-method"
                  className="form-control"
                  value={tenantAccountingMethod}
                  onChange={(e) => {
                    setTenantAccountingMethod(e.target.value);
                    if (e.target.value === "cash") {
                      setTenantCostingMethod("weighted_average_cost");
                    }
                  }}
                >
                  <option value="accrual">Accrual Accounting (Balance Sheet Match)</option>
                  <option value="cash">Cash Basis Accounting (Immediate Expense)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="tenant-costing-method">Costing Layer Method</label>
                <select
                  id="tenant-costing-method"
                  className="form-control"
                  value={tenantCostingMethod}
                  onChange={(e) => setTenantCostingMethod(e.target.value)}
                  disabled={tenantAccountingMethod === "cash"}
                  title={tenantAccountingMethod === "cash" ? "Costing methods do not apply to Cash Basis accounting" : undefined}
                >
                  <option value="fifo">FIFO (First In, First Out)</option>
                  <option value="lifo">LIFO (Last In, First Out)</option>
                  <option value="weighted_average_cost">Weighted Average Cost (WAC)</option>
                  <option value="specific_identification">Specific Identification</option>
                </select>
              </div>

              <div className="form-grid-2" style={{ marginBottom: "15px" }}>
                <div className="form-group">
                  <label htmlFor="tenant-currency-code">Currency ISO</label>
                  <input
                    id="tenant-currency-code"
                    className="form-control"
                    type="text"
                    value={tenantCurrencyCode}
                    onChange={(e) => setTenantCurrencyCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="tenant-fiscal-year">Fiscal Year Start</label>
                  <input
                    id="tenant-fiscal-year"
                    className="form-control"
                    type="text"
                    placeholder="MM-DD"
                    value={tenantFiscalYearStart}
                    onChange={(e) => setTenantFiscalYearStart(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "100%" }}
                onClick={async () => {
                  setTenantMsg(null);
                  try {
                    const res = await fetch(`${API_BASE}/accounting/tenant-config`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        tenantId,
                        accountingMethod: tenantAccountingMethod,
                        costingMethod: tenantCostingMethod,
                        currencyCode: tenantCurrencyCode,
                        fiscalYearStart: tenantFiscalYearStart
                      })
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setTenantMsg({ type: "success", text: "Settings saved to database config!" });
                      triggerValuationComparison(valSku, valQty);
                    } else {
                      setTenantMsg({ type: "error", text: data.error || "Failed to save settings." });
                    }
                  } catch (e) {
                    setTenantMsg({ type: "error", text: "Connection error." });
                  }
                }}
              >
                Sync Tenant Scoping Settings
              </button>

              {tenantMsg && (
                <div className={`feedback-msg ${tenantMsg.type}`} role="status" aria-live="polite" style={{ marginTop: "12px" }}>
                  {tenantMsg.text}
                </div>
              )}
            </div>

            <div className="workspace-panel">
              <h2>FIFO vs. WAC Cost Layers</h2>
            <form onSubmit={handleCalculateValuation} style={{ marginBottom: "25px" }}>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="bookkeeping-variant-sku">Variant SKU</label>
                <select id="bookkeeping-variant-sku" className="form-control" value={valSku} onChange={(e) => setValSku(e.target.value)} required>
                  {inventoryList.map(item => (
                    <option key={item.id} value={item.sku}>{item.sku}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="val-qty">Quantity to Consume</label>
                <input id="val-qty" className="form-control" type="number" value={valQty} onChange={(e) => setValQty(parseInt(e.target.value) || 0)} required min="1" />
              </div>
              <div className="form-group" style={{ marginBottom: "15px" }}>
                <label htmlFor="bookkeeping-valuation-method">Valuation Method</label>
                <select id="bookkeeping-valuation-method" className="form-control" value={valMethod} onChange={(e) => setValMethod(e.target.value)}>
                  <option value="fifo">FIFO (Consume Oldest Batches)</option>
                  <option value="wac">WAC (Weighted Average Pool Cost)</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                Compute Cost Allocation
              </button>
            </form>

            {valOutput && (
              <div style={{ background: "rgba(10,15,30,0.8)", padding: "18px", borderRadius: "10px", border: "1px solid var(--border-color)", marginBottom: "20px" }}>
                <h4 style={{ color: "var(--text-primary)", margin: "0 0 10px 0", fontSize: "0.9rem" }}>Cost Allocation Results</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.9rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Quantity Calculated:</span>
                    <strong>{valOutput.quantity} units</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Total Cost (COGS):</span>
                    <strong style={{ color: "var(--accent-color-light)", fontSize: "1.1rem" }}>
                      ${(valOutput.totalCostCents / 100).toFixed(2)}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Unit Cost Average:</span>
                    <strong>${(valOutput.unitCostCents / 100).toFixed(2)} / unit</strong>
                  </div>
                </div>
              </div>
            )}

            {/* SVG Visualizer Chart */}
            <div className="chart-wrapper">
              <h3 style={{ fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)", marginBottom: "15px" }}>
                Margin & Valuation Variance Comparison
              </h3>
              {comparisonData && !comparisonData.loading ? (
                <div style={{ textAlign: "center" }}>
                  {/* Inline SVG Chart */}
                  <svg width="100%" height="160" viewBox="0 0 320 160" style={{ background: "rgba(15,23,42,0.3)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    {/* Gridlines */}
                    <line x1="30" y1="20" x2="300" y2="20" stroke="rgba(255,255,255,0.03)" />
                    <line x1="30" y1="70" x2="300" y2="70" stroke="rgba(255,255,255,0.03)" />
                    <line x1="30" y1="120" x2="300" y2="120" stroke="rgba(255,255,255,0.03)" />

                    {/* FIFO Bar */}
                    <rect x="70" y={120 - Math.min(90, (comparisonData.fifo / 500) * 80)} width="45" height={Math.min(90, (comparisonData.fifo / 500) * 80)} rx="4" fill="url(#fifoGrad)" />
                    <text x="92.5" y="140" fill="var(--text-muted)" fontSize="9" textAnchor="middle">FIFO</text>
                    <text x="92.5" y={115 - Math.min(90, (comparisonData.fifo / 500) * 80)} fill="var(--text-primary)" fontSize="9" fontWeight="bold" textAnchor="middle">
                      ${comparisonData.fifo.toFixed(2)}
                    </text>

                    {/* WAC Bar */}
                    <rect x="195" y={120 - Math.min(90, (comparisonData.wac / 500) * 80)} width="45" height={Math.min(90, (comparisonData.wac / 500) * 80)} rx="4" fill="url(#wacGrad)" />
                    <text x="217.5" y="140" fill="var(--text-muted)" fontSize="9" textAnchor="middle">WAC</text>
                    <text x="217.5" y={115 - Math.min(90, (comparisonData.wac / 500) * 80)} fill="var(--text-primary)" fontSize="9" fontWeight="bold" textAnchor="middle">
                      ${comparisonData.wac.toFixed(2)}
                    </text>

                    {/* Definitions */}
                    <defs>
                      <linearGradient id="fifoGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(263, 90%, 65%)" />
                        <stop offset="100%" stopColor="hsl(315, 85%, 58%)" />
                      </linearGradient>
                      <linearGradient id="wacGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(142, 70%, 45%)" />
                        <stop offset="100%" stopColor="hsl(142, 60%, 30%)" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "10px", textAlign: "left", padding: "0 10px" }}>
                    * FIFO costing consumes older physical stock batches first. WAC spreads cost layers over a pooled weighted average. Note variance in cost allocation based on inventory flow logic.
                  </p>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  Calculating comparison metrics...
                </div>
              )}
            </div>
            
            {bookkeepingMsg && <div className={`feedback-msg ${bookkeepingMsg.type}`} role="status" aria-live="polite">{bookkeepingMsg.text}</div>}
          </div>
          </div>

          {/* General Ledger */}
          <div className="workspace-panel">
            <h2>Financial General Ledger</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "15px" }}>
              Balanced journal entry lines automatically logged for inventory events. Accrual rules check debit and credit equivalence before commit.
            </p>

            <div className="table-container" style={{ maxHeight: "420px" }}>
              <table className="custom-table" style={{ fontSize: "0.85rem" }}>
                <thead>
                  <tr>
                    <th>Entry & Date</th>
                    <th>Account</th>
                    <th>Debit (Dr)</th>
                    <th>Credit (Cr)</th>
                    <th>Memo</th>
                  </tr>
                </thead>
                <tbody>
                  {journalEntries.length > 0 ? (
                    journalEntries.map((entry, eIdx) =>
                      entry.lines.map((line, lIdx) => (
                        <tr key={`${eIdx}-${lIdx}`} style={lIdx === 0 ? { borderTop: "2px solid rgba(255,255,255,0.06)" } : {}}>
                          <td>
                            {lIdx === 0 ? (
                              <div>
                                <strong style={{ color: "var(--text-primary)" }}>{entry.description}</strong>
                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                  {new Date(entry.date).toLocaleDateString()}
                                </div>
                              </div>
                            ) : ""}
                          </td>
                          <td>
                            <div style={line.type === "credit" ? { paddingLeft: "15px" } : {}}>
                              <span style={{ fontWeight: 600 }}>{line.account.code}</span> - {line.account.name}
                              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "capitalize" }}>
                                {line.account.category} Account
                              </div>
                            </div>
                          </td>
                          <td style={{ color: line.type === "debit" ? "var(--success-color)" : "inherit", fontWeight: line.type === "debit" ? 600 : "normal" }}>
                            {line.type === "debit" ? `$${(line.amountCents / 100).toFixed(2)}` : "-"}
                          </td>
                          <td style={{ color: line.type === "credit" ? "var(--accent-color-light)" : "inherit", fontWeight: line.type === "credit" ? 600 : "normal" }}>
                            {line.type === "credit" ? `$${(line.amountCents / 100).toFixed(2)}` : "-"}
                          </td>
                          <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{line.memo}</td>
                        </tr>
                      ))
                    )
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                        No ledger records registered in database schema. Post opening stock balances.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "outbox" && (
        <OutboxTab />
      )}

      {activeTab === "forecasting" && (
        <ForecastingTab inventoryList={inventoryList} />
      )}

      {activeTab === "scanner" && (
        <MobileScannerTab 
          inventoryList={inventoryList} 
          barcodeList={barcodeList}
          onRefreshData={fetchAllData}
          tenantId={tenantId}
        />
      )}

      {activeTab === "shipping" && (
        <ShippingTab 
          inventoryList={inventoryList} 
          onRefreshData={fetchAllData}
          tenantId={tenantId}
          locationId={locationId}
        />
      )}
    </div>
  );
}

interface DemandPlanningReportItem {
  sku: string;
  locationId: string;
  currentStock: number;
  averageDailySales7d: number;
  averageDailySales30d: number;
  averageDailySales90d: number;
  daysOfCover: number;
  runOutDate: string | null;
  reorderPoint: number;
  reorderQuantity: number;
  safetyStock: number;
  forecastedDemand30d: number;
  confidenceLevel: number;
  actionRequired: boolean;
  recommendedOrderQuantity: number;
}

function ForecastingTab({ inventoryList }: { inventoryList: any[] }) {
  const [locationId, setLocationId] = useState("default");
  const [report, setReport] = useState<DemandPlanningReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manual forecast form state
  const [selectedSku, setSelectedSku] = useState("");
  const [forecastDays, setForecastDays] = useState(30);
  const [trendMultiplier, setTrendMultiplier] = useState(1.0);
  const [forecastResult, setForecastResult] = useState<any | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/forecasting/report?locationId=${locationId}`);
      if (!res.ok) throw new Error("Failed to fetch demand planning report");
      const data = await res.json();
      setReport(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [locationId]);

  // Set default SKU when inventory list loads
  useEffect(() => {
    if (inventoryList.length > 0 && !selectedSku) {
      setSelectedSku(inventoryList[0].sku || "");
    }
  }, [inventoryList]);

  const handleGenerateForecast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSku) {
      setForecastError("Please select a SKU");
      return;
    }
    try {
      setForecastLoading(true);
      setForecastError(null);
      setForecastResult(null);

      const res = await fetch("/api/forecasting/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: selectedSku,
          locationId,
          forecastDays,
          trendMultiplier
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate forecast");
      }

      const data = await res.json();
      setForecastResult(data.forecast);
      // Refresh the report to reflect the new forecast
      fetchReport();
    } catch (err: any) {
      console.error(err);
      setForecastError(err.message || "Failed to generate forecast");
    } finally {
      setForecastLoading(false);
    }
  };

  const actionRequiredCount = report.filter(item => item.actionRequired).length;
  const totalSkuCount = report.length;
  const averageVelocity30d = report.reduce((acc, item) => acc + item.averageDailySales30d, 0);

  return (
    <div className="tab-content">
      <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2>Inventory Forecasting & Demand Planning</h2>
          <p>Analyze sales velocity, compute safety stock coverage, project run-out dates, and manage purchasing recommendations.</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <label htmlFor="forecast-location" style={{ fontSize: "0.9rem", fontWeight: 600 }}>Location:</label>
          <select 
            id="forecast-location"
            value={locationId} 
            onChange={(e) => setLocationId(e.target.value)}
            style={{
              background: "rgba(22, 28, 45, 0.7)",
              border: "1px solid var(--border-color)",
              color: "var(--text-primary)",
              padding: "6px 12px",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            <option value="default">Default Location</option>
            <option value="Main Store">Main Store</option>
            <option value="warehouse-south">Warehouse South</option>
            <option value="store-east">Store East</option>
          </select>

          <button className="btn btn-secondary" onClick={loading ? undefined : fetchReport} aria-disabled={loading} aria-busy={loading} style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }} title={loading ? "Refreshing report..." : "Refresh the report data"} aria-label={loading ? "Refreshing report..." : "Refresh the report data"}>

            {loading ? "⏳ Refreshing..." : "Refresh Report"}
          </button>
        </div>
      </div>

      {error && (

        <div role="status" aria-live="polite" style={{ padding: "12px", background: "rgba(220, 53, 69, 0.1)", border: "1px solid rgba(220, 53, 69, 0.2)", borderRadius: "6px", color: "#ea868f", marginBottom: "20px" }}>

          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid" style={{ marginBottom: "30px", marginTop: "10px" }}>
        <div className="stat-card" style={{ borderLeft: "4px solid var(--accent-color)" }}>
          <div className="stat-title">Tracked SKUs</div>
          <div className="stat-value" style={{ color: "var(--accent-color-light)" }}>
            {loading ? "..." : totalSkuCount}
          </div>
          <div className="stat-desc">Active items at this location</div>
        </div>
        <div className="stat-card" style={{ borderLeft: `4px solid ${actionRequiredCount > 0 ? "var(--error-color)" : "var(--success-color)"}` }}>
          <div className="stat-title">Restock Recommendations</div>
          <div className="stat-value" style={{ color: actionRequiredCount > 0 ? "#ea868f" : "var(--success-color)" }}>
            {loading ? "..." : actionRequiredCount}
          </div>
          <div className="stat-desc">{actionRequiredCount > 0 ? "SKUs below reorder point" : "All items within safety levels"}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: "4px solid var(--info-color)" }}>
          <div className="stat-title">Combined 30d Velocity</div>
          <div className="stat-value" style={{ color: "hsl(199, 89%, 60%)" }}>
            {loading ? "..." : averageVelocity30d.toFixed(2)}
          </div>
          <div className="stat-desc">Average daily units dispatched</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", alignItems: "start" }}>
        {/* Main Planning Report Card */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="card-header" style={{ padding: "16px 20px" }}>
            <h3>Demand Planning Report</h3>
          </div>
          <div className="card-body" style={{ padding: "0" }}>
            <div className="table-responsive" style={{ margin: 0, border: "none" }}>
              <table className="data-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Stock</th>
                    <th>Vel. (7d/30d/90d)</th>
                    <th>Days Cover</th>
                    <th>Run-out Date</th>
                    <th>Safety Stock</th>
                    <th>Reorder Pt (Qty)</th>
                    <th>30d Demand Est.</th>
                    <th>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                        Loading demand planning data...
                      </td>
                    </tr>
                  ) : report.length > 0 ? (
                    report.map((item) => {
                      const runOutClass = item.daysOfCover === Infinity ? "badge-healthy" : item.daysOfCover < 15 ? "badge-error" : item.daysOfCover < 30 ? "badge-warning" : "badge-healthy";
                      const isLowStock = item.actionRequired;
                      
                      return (
                        <tr key={item.sku}>
                          <td style={{ fontWeight: 600 }}>
                            <span 
                              role="button"
                              tabIndex={0}
                              style={{ cursor: "pointer", color: "var(--accent-color-light)", textDecoration: "underline" }}
                              onClick={() => setSelectedSku(item.sku)}
                              aria-label={`Select ${item.sku} for forecasting`}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedSku(item.sku); } }}
                              title="Click to select for forecasting"
                            >
                              {item.sku}
                            </span>
                          </td>
                          <td style={{ textAlign: "center", fontWeight: "bold" }}>
                            {item.currentStock}
                          </td>
                          <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                            {item.averageDailySales7d.toFixed(1)} / {item.averageDailySales30d.toFixed(1)} / {item.averageDailySales90d.toFixed(1)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className={`badge ${runOutClass}`}>
                              {item.daysOfCover === Infinity ? "∞ Days" : `${item.daysOfCover} d`}
                            </span>
                          </td>
                          <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            {item.runOutDate ? new Date(item.runOutDate).toLocaleDateString() : "N/A"}
                          </td>
                          <td style={{ textAlign: "center" }}>{item.safetyStock}</td>
                          <td style={{ textAlign: "center", fontSize: "0.9rem" }}>
                            {item.reorderPoint} <span style={{ color: "var(--text-muted)" }}>({item.reorderQuantity})</span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {item.forecastedDemand30d} 
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                              Conf: {(item.confidenceLevel * 100).toFixed(0)}%
                            </div>
                          </td>
                          <td>
                            {isLowStock ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span className="badge badge-error" style={{ fontSize: "0.75rem", padding: "2px 6px" }}>Reorder Req.</span>
                                <span style={{ fontSize: "0.8rem", color: "#ea868f", fontWeight: 600 }}>Order: {item.recommendedOrderQuantity} units</span>
                              </div>
                            ) : (
                              <span className="badge badge-healthy" style={{ fontSize: "0.75rem", padding: "2px 6px" }}>Healthy</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                        No inventory items found. Add items or submit onboarding stock first.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Manual Forecasting Console Card */}
        <div className="card">
          <div className="card-header">
            <h3>Manual Demand Forecast</h3>
          </div>
          <div className="card-body">
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "15px" }}>
              Project future demand for a specific SKU. Manual forecasts overwrite fallback calculations based on historical daily sales.
            </p>
            <form onSubmit={handleGenerateForecast} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="forecast-select-sku" style={{ fontSize: "0.85rem", fontWeight: 600 }}>Select SKU</label>
                <select
                  id="forecast-select-sku"
                  value={selectedSku}
                  onChange={(e) => setSelectedSku(e.target.value)}
                  style={{
                    background: "rgba(22, 28, 45, 0.7)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    width: "100%"
                  }}
                >
                  <option value="">-- Choose a SKU --</option>
                  {inventoryList.map((item: any) => {
                    const skuVal = item.sku;
                    return (
                      <option key={skuVal} value={skuVal}>
                        {skuVal}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="forecast-days" style={{ fontSize: "0.85rem", fontWeight: 600 }}>Forecast Horizon (Days)</label>
                <input
                  id="forecast-days"
                  type="number"
                  min="1"
                  max="365"
                  value={forecastDays}
                  onChange={(e) => setForecastDays(parseInt(e.target.value) || 30)}
                  style={{
                    background: "rgba(22, 28, 45, 0.7)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    padding: "8px 10px",
                    borderRadius: "6px"
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="trend-multiplier" style={{ fontSize: "0.85rem", fontWeight: 600 }}>Trend / Seasonality Multiplier</label>
                <input
                  id="trend-multiplier"
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="10.0"
                  value={trendMultiplier}
                  onChange={(e) => setTrendMultiplier(parseFloat(e.target.value) || 1.0)}
                  style={{
                    background: "rgba(22, 28, 45, 0.7)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    padding: "8px 10px",
                    borderRadius: "6px"
                  }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  e.g., 1.2 adds 20% bump for expected holiday peaks; 0.8 marks seasonal drop.
                </span>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={forecastLoading || !selectedSku} 
                style={{ marginTop: "10px", width: "100%" }}
                title={!selectedSku ? "Select a SKU to generate forecast" : forecastLoading ? "Calculating..." : "Generate and save forecast"}
                aria-label={!selectedSku ? "Select a SKU to generate forecast" : forecastLoading ? "Calculating..." : "Generate and save forecast"}
              >
                {forecastLoading ? <><span role="img" aria-hidden="true">⏳</span> Calculating Forecast...</> : "Generate & Save Forecast"}
              </button>
            </form>

            {forecastError && (
              <div style={{ marginTop: "15px", padding: "8px 12px", background: "rgba(220, 53, 69, 0.1)", border: "1px solid rgba(220, 53, 69, 0.2)", borderRadius: "6px", color: "#ea868f", fontSize: "0.85rem" }}>
                {forecastError}
              </div>
            )}

            {forecastResult && (
              <div style={{ 
                marginTop: "20px", 
                padding: "16px", 
                background: "linear-gradient(135deg, rgba(170, 59, 255, 0.08) 0%, rgba(315, 85, 58, 0.08) 100%)", 
                border: "1px solid rgba(170, 59, 255, 0.2)", 
                borderRadius: "8px",
                animation: "fadeIn 0.3s ease"
              }}>
                <h4 style={{ margin: "0 0 10px", color: "var(--accent-color-light)", fontSize: "0.95rem" }}>Forecast Created Successfully</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.85rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>SKU:</span>
                    <strong style={{ color: "var(--text-primary)" }}>{forecastResult.sku}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Horizon:</span>
                    <strong style={{ color: "var(--text-primary)" }}>{forecastDays} Days</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Projected Demand:</span>
                    <strong style={{ color: "var(--success-color)", fontSize: "1.1rem" }}>{forecastResult.forecastedQuantity} units</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Confidence Rating:</span>
                    <strong style={{ color: "var(--info-color)" }}>{(forecastResult.confidenceLevel * 100).toFixed(0)}%</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Active Window:</span>
                    <strong style={{ color: "var(--text-primary)", fontSize: "0.75rem" }}>
                      {new Date(forecastResult.periodStart).toLocaleDateString()} - {new Date(forecastResult.periodEnd).toLocaleDateString()}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface MobileScannerTabProps {
  inventoryList: any[];
  barcodeList: any[];
  onRefreshData: () => Promise<void>;
  tenantId: string;
}

function MobileScannerTab({ inventoryList, barcodeList, onRefreshData, tenantId }: MobileScannerTabProps) {
  const [activeMode, setActiveMode] = useState<"pick" | "receive" | "count">("pick");
  const [scanValue, setScanValue] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [resolvedItem, setResolvedItem] = useState<any | null>(null);
  
  // Transaction input states
  const [qtyInput, setQtyInput] = useState(1);
  const [selectedLocation, setSelectedLocation] = useState("default");
  
  // LED Status & messages
  const [ledStatus, setLedStatus] = useState<"idle" | "success" | "error" | "scanning">("idle");
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Cycle count session state
  const [cycleCountSession, setCycleCountSession] = useState<Array<{ sku: string; count: number }>>([]);

  const playBeep = (success: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (success) {
        osc.type = "sine";
        osc.frequency.setValueAtTime(950, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.28);
      }
    } catch (e) {
      console.warn("Web Audio API not allowed or blocked by browser policy.", e);
    }
  };

  const handleScan = async (value: string) => {
    if (!value) return;
    try {
      setScanLoading(true);
      setLedStatus("scanning");
      setActionMsg(null);
      
      // Simulate laser scanner scan timing (600ms) for high-fidelity UX
      await new Promise(resolve => setTimeout(resolve, 600));

      const res = await fetch(`${API_BASE}/barcodes/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawScan: value,
          context: activeMode === "pick" ? "pos" : activeMode === "receive" ? "receiving" : "cycle_count"
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Barcode not registered");
      }

      const scanResult = await res.json();
      const sku = scanResult.variantId;
      
      // Look up current stock details in the app inventory list
      const invItem = inventoryList.find(item => item.sku === sku);
      
      playBeep(true);
      setLedStatus("success");
      
      if (activeMode === "count") {
        // Increment directly in session list
        setCycleCountSession(prev => {
          const exists = prev.find(item => item.sku === sku);
          if (exists) {
            return prev.map(item => item.sku === sku ? { ...item, count: item.count + 1 } : item);
          } else {
            return [...prev, { sku, count: 1 }];
          }
        });
        setScanValue("");
        setActionMsg({ type: "success", text: `Counted ${sku}` });
      } else {
        setResolvedItem({
          sku,
          barcodeValue: value,
          currentStock: invItem ? invItem.quantity : 0
        });
        setQtyInput(1);
      }
    } catch (err: any) {
      console.error(err);
      playBeep(false);
      setLedStatus("error");
      setResolvedItem(null);
      setActionMsg({ type: "error", text: err.message || "Failed to scan barcode" });
    } finally {
      setScanLoading(false);
    }
  };

  const handleDispatch = async () => {
    if (!resolvedItem) return;
    try {
      setActionMsg(null);
      const res = await fetch(`${API_BASE}/inventory/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: resolvedItem.sku,
          amount: qtyInput,
          locationId: selectedLocation
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to dispatch stock");
      }

      try {
        await fetch(`${API_BASE}/accounting/stock-sold`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            variantId: resolvedItem.sku,
            quantity: qtyInput,
            tenantId
          })
        });
      } catch (accountingErr) {
        console.warn("Accounting entry dispatch warning:", accountingErr);
      }

      playBeep(true);
      setTimeout(() => playBeep(true), 120); // clean double chirp
      setLedStatus("success");
      setActionMsg({ type: "success", text: `Successfully dispatched ${qtyInput} units of ${resolvedItem.sku}!` });
      setResolvedItem(null);
      setScanValue("");
      await onRefreshData();
    } catch (err: any) {
      console.error(err);
      playBeep(false);
      setLedStatus("error");
      setActionMsg({ type: "error", text: err.message || "Dispatch failed" });
    }
  };

  const handleReceive = async () => {
    if (!resolvedItem) return;
    try {
      setActionMsg(null);
      const res = await fetch(`${API_BASE}/inventory/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: resolvedItem.sku,
          amount: qtyInput,
          locationId: selectedLocation
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to receive stock");
      }

      try {
        await fetch(`${API_BASE}/accounting/stock-received`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            variantId: resolvedItem.sku,
            totalCostCents: qtyInput * 1500, // mock $15.00 cost per item received
            supplierName: "Warehouse Inbound Scan",
            tenantId
          })
        });
      } catch (accountingErr) {
        console.warn("Accounting entry receive warning:", accountingErr);
      }

      playBeep(true);
      setTimeout(() => playBeep(true), 120);
      setLedStatus("success");
      setActionMsg({ type: "success", text: `Successfully received ${qtyInput} units of ${resolvedItem.sku}!` });
      setResolvedItem(null);
      setScanValue("");
      await onRefreshData();
    } catch (err: any) {
      console.error(err);
      playBeep(false);
      setLedStatus("error");
      setActionMsg({ type: "error", text: err.message || "Receive failed" });
    }
  };

  const handleSubmitCycleCount = async () => {
    if (cycleCountSession.length === 0) return;
    try {
      setActionMsg(null);
      const res = await fetch(`${API_BASE}/inventory/count`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counts: cycleCountSession.map(c => ({ sku: c.sku, count: c.count })),
          locationId: selectedLocation
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reconcile cycle count");
      }

      playBeep(true);
      setTimeout(() => playBeep(true), 120);
      setLedStatus("success");
      setActionMsg({ type: "success", text: `Cycle count reconciled successfully for ${cycleCountSession.length} SKUs!` });
      setCycleCountSession([]);
      await onRefreshData();
    } catch (err: any) {
      console.error(err);
      playBeep(false);
      setLedStatus("error");
      setActionMsg({ type: "error", text: err.message || "Reconciliation failed" });
    }
  };

  const handlePillClick = (val: string) => {
    setScanValue(val);
    handleScan(val);
  };

  // Find demo barcodes for active items to render as simulator helper buttons
  const activeBarcodes = barcodeList.slice(0, 8);

  return (
    <div className="tab-content" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h2>Warehouse Mobile Terminal Simulator</h2>
        <p>Perform live picking, receiving, and physical counts in real time using a simulated handheld computer.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px 1fr", width: "100%", gap: "30px", alignItems: "start" }}>
        {/* Left column: Simulator Instructions & Quick Barcode list */}
        <div className="card">
          <div className="card-header">
            <h3>Terminal Instructions</h3>
          </div>
          <div className="card-body" style={{ fontSize: "0.85rem", lineHeight: "145%" }}>
            <p><strong>1. Select Terminal Mode:</strong> Toggle the header buttons inside the Zebra terminal to select your current warehouse task.</p>
            <p><strong>2. Trigger Scanner:</strong> Use the clickable barcode shortcut pills below to simulate laser gun triggers, or type manually and press Enter.</p>
            <p><strong>3. Verify Audio & LED:</strong> Clean high-pitch beep represents a successful scan lookup; low buzz indicates unrecognized SKU.</p>
            
            <h4 style={{ marginTop: "20px", color: "var(--accent-color-light)", fontSize: "0.9rem" }}>Barcode Scanner Shortcut Pills</h4>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "8px" }}>Click to simulate a gun laser scan:</p>
            <div className="scan-pills-container">
              {activeBarcodes.length > 0 ? (
                activeBarcodes.map(b => (
                  <span 
                    key={b.barcodeValue} 
                    role="button"
                    tabIndex={0}
                    className="scan-pill"
                    onClick={() => handlePillClick(b.barcodeValue)}
                    aria-label={`Scan barcode ${b.barcodeValue} for ${b.variantId}`}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handlePillClick(b.barcodeValue); } }}
                    title={`Click to scan barcode for ${b.variantId}`}
                  >
                    {b.barcodeValue} ({b.variantId})
                  </span>
                ))
              ) : (
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  No barcodes registered yet. Create barcodes first!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle column: Simulated ZebraTC21 Device */}
        <div className="handheld-device">
          {/* LED Status light */}
          <div className={`scanner-led ${ledStatus}`} title={`Scanner LED: ${ledStatus}`}></div>

          <div className="handheld-screen">
            {/* Cell status bar */}
            <div className="sim-status-bar">
              <span className="sim-time">20:42 PM</span>
              <span style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span>LTE 📶</span>
                <span>🔋 98%</span>
              </span>
            </div>

            {/* Terminal Header */}
            <div className="sim-header">
              <h3>WMS Terminus</h3>
              <p>Device #8A-42 (Default)</p>
            </div>

            {/* Mode selection button grid */}
            <div className="mode-selector">
              <button 
                type="button"
                className={`mode-btn ${activeMode === "pick" ? "active" : ""}`}
                aria-label={activeMode === "pick" ? "Pick mode active" : "Switch to Pick mode"}
                title={activeMode === "pick" ? "Pick mode active" : "Switch to Pick mode"}
                onClick={() => {
                  setActiveMode("pick");
                  setResolvedItem(null);
                  setActionMsg(null);
                }}
              >
                📦 Pick
              </button>
              <button 
                type="button"
                className={`mode-btn ${activeMode === "receive" ? "active" : ""}`}
                aria-label={activeMode === "receive" ? "Receive mode active" : "Switch to Receive mode"}
                title={activeMode === "receive" ? "Receive mode active" : "Switch to Receive mode"}
                onClick={() => {
                  setActiveMode("receive");
                  setResolvedItem(null);
                  setActionMsg(null);
                }}
              >
                📥 Receive
              </button>
              <button 
                type="button"
                className={`mode-btn ${activeMode === "count" ? "active" : ""}`}
                aria-label={activeMode === "count" ? "Count mode active" : "Switch to Count mode"}
                title={activeMode === "count" ? "Count mode active" : "Switch to Count mode"}
                onClick={() => {
                  setActiveMode("count");
                  setResolvedItem(null);
                  setActionMsg(null);
                }}
              >
                📝 Count
              </button>
            </div>

            {/* Laser viewport animation when scanning */}
            <div className={`laser-viewport ${scanLoading ? "scanning" : ""}`}>
              <div className="laser-beam"></div>
              {scanLoading ? (
                <span style={{ fontSize: "0.75rem", color: "red", zIndex: 4, fontWeight: 700 }}>EMITTING LASER...</span>
              ) : resolvedItem ? (
                <div style={{ textAlign: "center", zIndex: 4 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--success-color)", fontWeight: "bold" }}>BARCODE RESOLVED</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>{resolvedItem.barcodeValue}</div>
                </div>
              ) : (
                <span className="virtual-scan-hint">Awaiting scan trigger...</span>
              )}
            </div>

            {/* Barcode input buffer */}
            <div style={{ marginBottom: "15px" }}>
              <input
                type="text"
                placeholder="Scan barcode buffer..."
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleScan(scanValue);
                  }
                }}
                disabled={scanLoading}
                aria-label="Scan barcode buffer"
                aria-busy={scanLoading}
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#fff",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  width: "100%",
                  boxSizing: "border-box",
                  textAlign: "center",
                  fontSize: "0.9rem",
                  fontFamily: "var(--mono-font)"
                }}
              />
            </div>

            {/* Screen Content: Results & Submits */}
            {actionMsg && (

              <div role="status" aria-live="polite" style={{

                padding: "8px 10px",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 600,
                marginBottom: "12px",
                background: actionMsg.type === "success" ? "rgba(52, 211, 153, 0.15)" : "rgba(248, 113, 113, 0.15)",
                border: actionMsg.type === "success" ? "1px solid rgba(52, 211, 153, 0.3)" : "1px solid rgba(248, 113, 113, 0.3)",
                color: actionMsg.type === "success" ? "#34d399" : "#f87171",
                textAlign: "center"
              }}>
                {actionMsg.text}
              </div>
            )}

            {/* Picking & Receiving Resolved Form View */}
            {resolvedItem && (activeMode === "pick" || activeMode === "receive") && (
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "8px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                  <span style={{ color: "var(--text-muted)" }}>SKU:</span>
                  <strong style={{ color: "#fff" }}>{resolvedItem.sku}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                  <span style={{ color: "var(--text-muted)" }}>Current On-Hand:</span>
                  <strong>{resolvedItem.currentStock} units</strong>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label htmlFor="qty-input" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Transaction Quantity</label>
                  <input
                    id="qty-input"
                    type="number"
                    min="1"
                    value={qtyInput}
                    onChange={(e) => setQtyInput(parseInt(e.target.value) || 1)}
                    style={{
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#fff",
                      padding: "6px",
                      borderRadius: "4px",
                      fontSize: "0.85rem"
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label htmlFor="scanner-warehouse-location" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Warehouse Location</label>
                  <select
                    id="scanner-warehouse-location"
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    style={{
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#fff",
                      padding: "6px",
                      borderRadius: "4px",
                      fontSize: "0.85rem"
                    }}
                  >
                    <option value="default">Default Location</option>
                    <option value="Main Store">Main Store</option>
                    <option value="warehouse-south">Warehouse South</option>
                    <option value="store-east">Store East</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: "8px", marginTop: "5px" }}>
                  <button
                    type="button"
                    aria-label="Cancel current scan operation"
                    onClick={() => {
                      setResolvedItem(null);
                      setScanValue("");
                    }}
                    style={{
                      flex: 1,
                      padding: "8px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#fff",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.8rem"
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={activeMode === "pick" ? handleDispatch : handleReceive}
                    style={{
                      flex: 1,
                      padding: "8px",
                      background: activeMode === "pick" ? "var(--error-color)" : "var(--success-color)",
                      border: "none",
                      color: "#fff",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: "0.8rem"
                    }}
                  >
                    {activeMode === "pick" ? "Pick Stock" : "Receive"}
                  </button>
                </div>
              </div>
            )}

            {/* Cycle Count Session List Screen */}
            {activeMode === "count" && (
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Scanned Session Items:</span>
                  {cycleCountSession.length > 0 && (
                    <button 
                      onClick={() => setCycleCountSession([])}
                      style={{ background: "none", border: "none", color: "#f87171", fontSize: "0.7rem", cursor: "pointer", padding: 0 }}
                      aria-label="Clear all scanned items in session"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                
                <div className="scanned-items-list">
                  {cycleCountSession.length > 0 ? (
                    cycleCountSession.map(c => (
                      <div key={c.sku} className="scan-list-item">
                        <span style={{ fontWeight: 600 }}>{c.sku}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: "4px", fontWeight: "bold" }}>
                            {c.count} pcs
                          </span>
                          <button
                            className="btn btn-danger btn-xs"
                            onClick={() => {
                              setCycleCountSession(prev => prev.filter(item => item.sku !== c.sku));
                            }}
                            title={"Delete item count for " + c.sku}
                            aria-label={"Delete item count for " + c.sku}
                            style={{ padding: "4px 6px" }}
                          >
                            ❌
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                      No items scanned in session. Scan a barcode to begin counting!
                    </div>
                  )}
                </div>

                {cycleCountSession.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <label htmlFor="scanner-audit-location" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Audit Location:</label>
                      <select
                        id="scanner-audit-location"
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        style={{
                          background: "rgba(0, 0, 0, 0.4)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          color: "#fff",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          flex: 1
                        }}
                      >
                        <option value="default">Default Location</option>
                        <option value="Main Store">Main Store</option>
                        <option value="warehouse-south">Warehouse South</option>
                        <option value="store-east">Store East</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleSubmitCycleCount}
                      style={{
                        padding: "10px",
                        background: "var(--accent-gradient)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: "0.8rem"
                      }}
                    >
                      Reconcile Cycle Count
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Bottom handheld trigger button */}
            <button
              type="button"
              className="physical-trigger-btn"
              disabled={scanLoading || !scanValue}
              onClick={() => handleScan(scanValue)}
              title={!scanValue ? "Enter a barcode to scan" : scanLoading ? "Scanning..." : "Trigger scan"}
              aria-label={!scanValue ? "Enter a barcode to scan" : scanLoading ? "Scanning..." : "Trigger scan"}
            >
              {scanLoading ? <><span role="img" aria-hidden="true">⏳</span> Scanning...</> : <><span role="img" aria-hidden="true">⚡</span> Trigger Scan</>}
            </button>
          </div>
        </div>

        {/* Right column: Active system stock stats lookup */}
        <div className="card">
          <div className="card-header">
            <h3>Registered Barcodes Index</h3>
          </div>
          <div className="card-body" style={{ padding: "0" }}>
            <div className="table-responsive" style={{ margin: 0, border: "none" }}>
              <table className="data-table" style={{ width: "100%", fontSize: "0.8rem" }}>
                <thead>
                  <tr>
                    <th>Barcode</th>
                    <th>SKU (Variant)</th>
                    <th>Format</th>
                    <th>System Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {barcodeList.length > 0 ? (
                    barcodeList.map(b => {
                      const itemStock = inventoryList.find(item => item.sku === b.variantId);
                      return (
                        <tr key={b.barcodeValue}>
                          <td style={{ fontFamily: "var(--mono-font)" }}>{b.barcodeValue}</td>
                          <td style={{ fontWeight: 600 }}>{b.variantId}</td>
                          <td style={{ textTransform: "uppercase", fontSize: "0.7rem", color: "var(--text-muted)" }}>{b.symbology}</td>
                          <td style={{ textAlign: "center", fontWeight: "bold" }}>
                            {itemStock ? itemStock.quantity : 0}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                        No barcodes found. Please assign barcodes first.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OutboxTab() {
  const [stats, setStats] = useState<{
    totalPending: number;
    totalProcessed: number;
    totalDeadLettered: number;
    recentFailures: any[];
  } | null>(null);
  const [dlqEvents, setDlqEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatsAndDlq = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const statsRes = await fetch("/api/outbox/stats");
      if (!statsRes.ok) throw new Error("Failed to fetch outbox statistics");
      const statsData = await statsRes.json();
      setStats(statsData);

      const dlqRes = await fetch("/api/outbox/dead-letter");
      if (!dlqRes.ok) throw new Error("Failed to fetch dead-lettered events");
      const dlqData = await dlqRes.json();
      setDlqEvents(dlqData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load outbox metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndDlq();
  }, []);

  const handleRetry = async (id: string) => {
    try {
      const res = await fetch(`/api/outbox/${id}/retry`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to retry event");
      alert("Event re-enqueued successfully!");
      fetchStatsAndDlq();
    } catch (err: any) {
      alert(`Error retrying event: ${err.message}`);
    }
  };

  return (
    <div className="tab-content">
      <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Outbox Event Processing & Diagnostics</h2>
          <p>Monitor event reliability, analyze message failures, and manage the Dead Letter Queue (DLQ).</p>
        </div>

        <button className="btn btn-secondary" onClick={loading ? undefined : fetchStatsAndDlq} aria-disabled={loading} aria-busy={loading} style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }} title={loading ? "Refreshing diagnostics..." : "Refresh diagnostic data"} aria-label={loading ? "Refreshing diagnostics..." : "Refresh diagnostic data"}>

          {loading ? "⏳ Refreshing..." : "Refresh Diagnostics"}
        </button>
      </div>

      {error && (

        <div role="status" aria-live="polite" style={{ padding: "12px", background: "rgba(220, 53, 69, 0.1)", border: "1px solid rgba(220, 53, 69, 0.2)", borderRadius: "6px", color: "#ea868f", marginBottom: "20px" }}>

          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid" style={{ marginBottom: "30px", marginTop: "10px" }}>
        <div className="stat-card" style={{ borderLeft: "4px solid var(--accent-color)" }}>
          <div className="stat-title">Pending Events</div>
          <div className="stat-value" style={{ color: "var(--accent-color-light)" }}>
            {stats ? stats.totalPending : "..."}
          </div>
          <div className="stat-desc">Awaiting asynchronous publishing</div>
        </div>
        <div className="stat-card" style={{ borderLeft: "4px solid var(--success-color)" }}>
          <div className="stat-title">Processed Events</div>
          <div className="stat-value" style={{ color: "var(--success-color)" }}>
            {stats ? stats.totalProcessed : "..."}
          </div>
          <div className="stat-desc">Successfully published to broker</div>
        </div>
        <div className="stat-card" style={{ borderLeft: "4px solid #dc3545" }}>
          <div className="stat-title">Dead-Lettered (DLQ)</div>
          <div className="stat-value" style={{ color: "#ea868f" }}>
            {stats ? stats.totalDeadLettered : "..."}
          </div>
          <div className="stat-desc">Exceeded max attempts (5)</div>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "30px" }}>
        {/* Dead Letter Queue Section */}
        <div className="card">
          <div className="card-header">
            <h3>Dead Letter Queue (DLQ)</h3>
          </div>
          <div className="card-body">
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "15px" }}>
              Events in this table have failed to publish multiple times and are skipped by the processor. Review details and retry.
            </p>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event ID</th>
                    <th>Event Type</th>
                    <th>Last Error</th>
                    <th>Attempts</th>
                    <th>Occurred On</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dlqEvents.length > 0 ? (
                    dlqEvents.map((event) => (
                      <tr key={event.id}>
                        <td style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>{event.id}</td>
                        <td>
                          <span style={{ padding: "4px 8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", fontWeight: 600 }}>
                            {event.eventName}
                          </span>
                        </td>
                        <td style={{ color: "#ea868f", fontSize: "0.85rem" }}>{event.lastError}</td>
                        <td style={{ textAlign: "center", fontWeight: 600 }}>{event.attempts}</td>
                        <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          {new Date(event.occurredOn).toLocaleString()}
                        </td>
                        <td>
                          <button className="btn btn-primary btn-sm" onClick={() => handleRetry(event.id)} aria-label={`Retry event ${event.id}`} title="Retry Event">
                            Retry Event
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                        No dead-lettered events detected. System publishing is healthy!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Failures Section */}
        <div className="card">
          <div className="card-header">
            <h3>Recent Failures & Backed-Off Retries</h3>
          </div>
          <div className="card-body">
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "15px" }}>
              These events are undergoing exponential backoff retries. The processor will retry them after their scheduled backoff time expires.
            </p>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event ID</th>
                    <th>Event Type</th>
                    <th>Last Error</th>
                    <th>Attempts</th>
                    <th>Retry Scheduled At</th>
                  </tr>
                </thead>
                <tbody>
                  {stats && stats.recentFailures.length > 0 ? (
                    stats.recentFailures.map((event) => (
                      <tr key={event.id}>
                        <td style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>{event.id}</td>
                        <td>
                          <span style={{ padding: "4px 8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", fontWeight: 600 }}>
                            {event.eventName}
                          </span>
                        </td>
                        <td style={{ color: "#f8c146", fontSize: "0.85rem" }}>{event.lastError}</td>
                        <td style={{ textAlign: "center", fontWeight: 600 }}>{event.attempts}</td>
                        <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          {new Date(event.nextAttemptAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                        No backed-off retries currently scheduled.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Shipment {
  id: string;
  sku: string;
  quantity: number;
  destinationAddress: string;
  carrier: string;
  trackingNumber: string | null;
  labelUrl: string | null;
  shippingRateCents: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface CarrierRate {
  carrier: string;
  rateCents: number;
  estimatedDays: number;
}

function ShippingTab({
  inventoryList,
  onRefreshData,
  tenantId,
  locationId
}: {
  inventoryList: any[];
  onRefreshData: () => void;
  tenantId: string;
  locationId: string;
}) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState("123 Main St, Seattle, WA 98101");
  const [rates, setRates] = useState<CarrierRate[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<string>("");
  const [loadingRates, setLoadingRates] = useState(false);
  const [purchasingLabel, setPurchasingLabel] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lastPurchasedLabel, setLastPurchasedLabel] = useState<{
    trackingNumber: string;
    labelUrl: string;
    rateCents: number;
    carrier: string;
    sku: string;
    quantity: number;
    destinationAddress: string;
  } | null>(null);

  const fetchShipments = async () => {
    try {
      const res = await fetch(`${API_BASE}/shipping/shipments`);
      if (res.ok) {
        const data = await res.json();
        setShipments(data);
      }
    } catch (e) {
      console.error("Failed to load shipments", e);
    }
  };

  useEffect(() => {
    fetchShipments();
    if (inventoryList.length > 0 && !sku) {
      setSku(inventoryList[0].sku);
    }
  }, [inventoryList, sku]);

  const handleEstimateRates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku || !address) return;
    setLoadingRates(true);
    setNotification(null);
    setRates([]);
    setSelectedCarrier("");
    try {
      const res = await fetch(`${API_BASE}/shipping/rates?sku=${encodeURIComponent(sku)}&quantity=${quantity}&address=${encodeURIComponent(address)}`);
      if (res.ok) {
        const data = await res.json();
        setRates(data);
        if (data.length > 0) {
          setSelectedCarrier(data[0].carrier);
        }
      } else {
        const err = await res.json();
        setNotification({ type: "error", text: err.error || "Failed to fetch rates." });
      }
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to fetch rates." });
    } finally {
      setLoadingRates(false);
    }
  };

  const handlePurchaseLabel = async () => {
    if (!sku || !quantity || !address || !selectedCarrier) return;
    setPurchasingLabel(true);
    setNotification(null);
    try {
      const res = await fetch(`${API_BASE}/shipping/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          quantity,
          destinationAddress: address,
          carrier: selectedCarrier,
          locationId,
          tenantId
        })
      });

      if (res.ok) {
        const data = await res.json();
        setNotification({ type: "success", text: `Label purchased successfully for ${selectedCarrier}! Tracking: ${data.trackingNumber}` });
        setLastPurchasedLabel({
          trackingNumber: data.trackingNumber,
          labelUrl: data.labelUrl,
          rateCents: data.rateCents,
          carrier: selectedCarrier,
          sku,
          quantity,
          destinationAddress: address
        });
        fetchShipments();
        onRefreshData();
      } else {
        const err = await res.json();
        setNotification({ type: "error", text: err.error || "Failed to purchase label." });
      }
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to purchase label." });
    } finally {
      setPurchasingLabel(false);
    }
  };

  const handleTrackShipment = async (id: string, nextStatus: string) => {
    setTrackingLoading(id);
    setNotification(null);
    try {
      const res = await fetch(`${API_BASE}/shipping/shipments/${id}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });

      if (res.ok) {
        setNotification({ type: "success", text: `Shipment status updated to ${nextStatus}` });
        fetchShipments();
      } else {
        const err = await res.json();
        setNotification({ type: "error", text: err.error || "Failed to update tracking status." });
      }
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to update tracking status." });
    } finally {
      setTrackingLoading(null);
    }
  };

  const renderQrPixels = (text: string) => {
    const pixels = [];
    const hash = text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    for (let i = 0; i < 64; i++) {
      const isBlack = ((i + hash) * 17) % 3 === 0 || (i % 8 === 0) || (i < 8 && i % 2 === 0) || (i > 56 && i % 2 === 0);
      pixels.push(<div key={i} className={`qr-pixel ${isBlack ? "" : "white"}`} />);
    }
    return pixels;
  };

  return (
    <div className="tab-container animated fadeIn">
      <div className="tab-header">
        <h2>Shipping Carrier Integration & Logistics</h2>
        <p>Estimate shipping options, buy labels (with automated ledger accruals), and track simulated carrier states.</p>
      </div>

      {notification && (

        <div className={`alert alert-${notification.type === "success" ? "success" : "danger"}`} role="status" aria-live="polite" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <span>{notification.text}</span>
          <button className="btn-close" aria-label="Close notification message" style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: "bold" }} onClick={() => setNotification(null)}>×</button>

        </div>
      )}

      <div className="shipping-grid">
        <div className="card">
          <div className="card-header">
            <h3>Estimate & Buy Label</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleEstimateRates} className="custom-form">
              <div className="form-group">
                <label htmlFor="shipping-select-sku">Select SKU to Ship</label>
                <select id="shipping-select-sku" value={sku} onChange={(e) => setSku(e.target.value)} required>
                  <option value="">-- Select SKU --</option>
                  {inventoryList.map((item) => (
                    <option key={item.sku} value={item.sku}>
                      {item.sku} (Qty: {item.quantity} available)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="shipping-qty">Quantity</label>
                <input
                  id="shipping-qty"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="shipping-address">Destination Address</label>
                <input
                  id="shipping-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, State, ZIP"
                  required
                />
              </div>


              <button type="submit" className="btn btn-primary" disabled={loadingRates} aria-busy={loadingRates} title={loadingRates ? "Estimating rates..." : "Estimate shipping rates"} aria-label={loadingRates ? "Estimating rates..." : "Estimate shipping rates"}>
                {loadingRates ? <><span role="img" aria-hidden="true">⏳</span> Estimating...</> : "Estimate Shipping"}
              </button>
            </form>

            {rates.length > 0 && (
              <div style={{ marginTop: "20px" }}>
                <h4>Available Carrier Options</h4>
                <div className="rate-cards">
                  {rates.map((r) => (
                    <div
                      key={r.carrier}
                      className={`rate-card ${selectedCarrier === r.carrier ? "selected" : ""}`}
                      onClick={() => setSelectedCarrier(r.carrier)}
                      aria-label={`Select ${r.carrier} carrier option`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedCarrier(r.carrier);
                        }
                      }}
                    >
                      <div className="rate-info">
                        <span className={`carrier-badge carrier-${r.carrier.toLowerCase()}`}>
                          {r.carrier}
                        </span>
                        <span className="rate-days">Est. Delivery: {r.estimatedDays} days</span>
                      </div>
                      <span className="rate-price">${(r.rateCents / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <button
                  className="btn btn-success"
                  style={{ width: "100%", marginTop: "15px" }}
                  onClick={handlePurchaseLabel}
                  disabled={purchasingLabel || !selectedCarrier}
                  aria-busy={purchasingLabel}
                  title={!selectedCarrier ? "Select a carrier to buy a label" : purchasingLabel ? "Purchasing..." : "Buy selected shipping label"}
                  aria-label={!selectedCarrier ? "Select a carrier to buy a label" : purchasingLabel ? "Purchasing..." : "Buy selected shipping label"}
                >
                  {purchasingLabel ? <><span role="img" aria-hidden="true">⏳</span> Purchasing...</> : "Buy " + selectedCarrier + " Shipping Label"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Label Printer Preview</h3>
          </div>
          <div className="card-body" style={{ minHeight: "350px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {lastPurchasedLabel ? (
              <div>
                <div className="shipping-label-container">
                  <div className="shipping-label">
                    <div className="label-header">
                      <span className="label-title">{lastPurchasedLabel.carrier} SHIPPING</span>
                      <span style={{ fontWeight: "bold" }}>PRIORITY</span>
                    </div>
                    <div className="label-addresses">
                      <div className="label-address">
                        <strong>SHIP FROM:</strong>
                        Warehouse A (Location: {locationId})<br />
                        Tenant ID: {tenantId}
                      </div>
                      <div className="label-address">
                        <strong>SHIP TO:</strong>
                        {lastPurchasedLabel.destinationAddress}
                      </div>
                    </div>
                    <div className="label-details">
                      <div>
                        <strong>SKU:</strong> {lastPurchasedLabel.sku}
                      </div>
                      <div>
                        <strong>QTY:</strong> {lastPurchasedLabel.quantity}
                      </div>
                      <div>
                        <strong>COST:</strong> ${(lastPurchasedLabel.rateCents / 100).toFixed(2)}
                      </div>
                      <div>
                        <strong>DATE:</strong> {new Date().toLocaleDateString()}
                      </div>
                    </div>
                    <div className="label-barcode-section">
                      <div className="label-barcode" />
                      <div style={{ display: "flex", gap: "10px", alignItems: "center", width: "100%", justifyContent: "space-between" }}>
                        <div>
                          <div className="tracking-number-text">{lastPurchasedLabel.trackingNumber}</div>
                          <div style={{ fontSize: "0.55rem", color: "#666", marginTop: "2px" }}>REF: {lastPurchasedLabel.labelUrl}</div>
                        </div>
                        <div className="label-qr-placeholder">
                          <div className="label-qr-grid">
                            {renderQrPixels(lastPurchasedLabel.trackingNumber)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "center", marginTop: "15px" }}>

                  <button className="btn btn-secondary btn-sm" aria-label="Print simulated shipping label" onClick={() => window.print()}>

                    🖨️ Print Label (Simulated)
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "15px" }}>📦</div>
                <p>No label printed yet.</p>
                <p style={{ fontSize: "0.8rem" }}>Estimate and purchase a shipping label on the left to generate a simulated barcode label sheet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "20px" }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Active Shipments & Carrier Milestones</h3>

          <button className="btn btn-secondary btn-sm" onClick={fetchShipments} title="Refresh the shipments list" aria-label="Refresh the shipments list">

            🔄 Refresh List
          </button>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Shipment ID</th>
                  <th>SKU / Qty</th>
                  <th>Carrier & Tracking</th>
                  <th>Destination</th>
                  <th>Cost</th>
                  <th>Current Status</th>
                  <th>Actions / Milestone Sim</th>
                </tr>
              </thead>
              <tbody>
                {shipments.length > 0 ? (
                  shipments.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>{s.id.substring(0, 8)}...</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.sku}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{s.quantity} units</div>
                      </td>
                      <td>
                        <span className={`carrier-badge carrier-${s.carrier.toLowerCase()}`} style={{ marginRight: "6px" }}>
                          {s.carrier}
                        </span>
                        <div style={{ fontSize: "0.8rem", fontFamily: "monospace", display: "inline-block" }}>
                          {s.trackingNumber || "N/A"}
                        </div>
                      </td>
                      <td style={{ fontSize: "0.8rem" }}>{s.destinationAddress}</td>
                      <td style={{ fontWeight: 600, fontFamily: "monospace" }}>${(s.shippingRateCents / 100).toFixed(2)}</td>
                      <td>
                        <span className={`badge badge-${s.status === "DELIVERED" ? "success" : s.status === "FAILED" ? "danger" : s.status === "IN_TRANSIT" ? "warning" : "info"}`}>
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          {s.status === "LABEL_GENERATED" && (
                            <button
                              className="btn btn-warning btn-sm"
                              onClick={() => handleTrackShipment(s.id, "IN_TRANSIT")}
                              disabled={trackingLoading !== null}
                              aria-busy={trackingLoading === s.id}
                              title={trackingLoading === s.id ? "Updating status..." : "Mark shipment as in transit"}
                              aria-label={trackingLoading === s.id ? "Updating status..." : `Mark shipment ${s.sku} as in transit`}

                            >
                              🚚 Scan (In Transit)
                            </button>
                          )}
                          {s.status === "IN_TRANSIT" && (
                            <>
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleTrackShipment(s.id, "DELIVERED")}
                                disabled={trackingLoading !== null}
                                aria-busy={trackingLoading === s.id}
                                title={trackingLoading === s.id ? "Updating status..." : "Mark shipment as delivered"}
                                aria-label={trackingLoading === s.id ? "Updating status..." : `Mark shipment ${s.sku} as delivered`}

                              >
                                ✅ Deliver
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleTrackShipment(s.id, "FAILED")}
                                disabled={trackingLoading !== null}
                                aria-busy={trackingLoading === s.id}
                                title={trackingLoading === s.id ? "Updating status..." : "Mark shipment as failed"}
                                aria-label={trackingLoading === s.id ? "Updating status..." : `Mark shipment ${s.sku} as failed`}

                              >
                                ❌ Fail
                              </button>
                            </>
                          )}
                          {(s.status === "DELIVERED" || s.status === "FAILED") && (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Transit Complete</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "30px" }}>
                      No shipments created yet. Purchase a shipping label to dispatch inventory and register a shipment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
