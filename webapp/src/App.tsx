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
  Database: ({ active }: { active: boolean }) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={active ? "#34d399" : "#f87171"} strokeWidth="2.5" className={active ? "pulse-icon" : ""}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  )
};

function App() {
  const [activeTab, setActiveTab] = useState<"overview" | "onboarding" | "barcodes" | "serials" | "kits" | "bookkeeping">("overview");

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
            purchaseOrderId: `RE-STOCK-${Math.floor(Math.random()*1000)}`,
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
              saleId: `POS-SALE-${Math.floor(Math.random()*1000)}`,
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
    }
  };

  const handleRegisterSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    setSerialMsg(null);
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
    }
  };

  const handleSerialLifecycleAction = async (action: "receive" | "sell" | "return" | "restock") => {
    setSerialMsg(null);
    if (!serialQuery) {
      setSerialMsg({ type: "error", text: "Please query or enter a Serial Number first." });
      return;
    }
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
          saleId: "KIT-SALE-" + Math.floor(Math.random() * 10000),
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
            <button className="btn-refresh" onClick={fetchAllData} title="Force Sync API Metrics">
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
          <button role="tab" aria-selected={activeTab === "overview"} className={`tab-btn ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
            <Icons.Dashboard />
            <span>Overview</span>
          </button>
          <button role="tab" aria-selected={activeTab === "onboarding"} className={`tab-btn ${activeTab === "onboarding" ? "active" : ""}`} onClick={() => setActiveTab("onboarding")}>
            <Icons.Onboarding />
            <span>Onboarding</span>
          </button>
          <button role="tab" aria-selected={activeTab === "barcodes"} className={`tab-btn ${activeTab === "barcodes" ? "active" : ""}`} onClick={() => setActiveTab("barcodes")}>
            <Icons.Barcode />
            <span>Barcodes</span>
          </button>
          <button role="tab" aria-selected={activeTab === "serials"} className={`tab-btn ${activeTab === "serials" ? "active" : ""}`} onClick={() => setActiveTab("serials")}>
            <Icons.Serial />
            <span>Serials</span>
          </button>
          <button role="tab" aria-selected={activeTab === "kits"} className={`tab-btn ${activeTab === "kits" ? "active" : ""}`} onClick={() => setActiveTab("kits")}>
            <Icons.Kit />
            <span>Kitting</span>
          </button>
          <button role="tab" aria-selected={activeTab === "bookkeeping"} className={`tab-btn ${activeTab === "bookkeeping" ? "active" : ""}`} onClick={() => setActiveTab("bookkeeping")}>
            <Icons.Bookkeeping />
            <span>Ledger</span>
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
                <div className="alert-list">
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
                      <button className="btn btn-primary btn-xs" aria-label={"Quick restock 15 units for " + item.sku} onClick={() => handleQuickRestock(item.sku, 15)}>
                        📥 Quick Restock 15 Units
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="alert-success-placeholder">
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
                  <label>SKU Variant</label>
                  <select
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
                  <button className="btn btn-secondary" onClick={() => handleQuickRestock(valSku, 10)}>
                    + Receive 10 Units
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={!valSku || (inventoryList.find(i => i.sku === valSku)?.quantity || 0) <= 0}
                    title={!valSku ? "Select a SKU first" : (inventoryList.find(i => i.sku === valSku)?.quantity || 0) <= 0 ? "Insufficient stock" : undefined}
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
                            saleId: `MANUAL-${Math.floor(Math.random()*1000)}`,
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
                <label>Location ID</label>
                <input className="form-control" type="text" value={locationId} onChange={(e) => setLocationId(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Opening Costing Date</label>
                <input className="form-control" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} required />
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
                <label>Variant SKU</label>
                <select
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
                <label>Symbology Standard</label>
                <select
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
                <label>Barcode ID Value</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
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
                <label>GS1 Registration Origin</label>
                <select
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
                  <label>Barcode String</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Enter or select barcode from table"
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Scan Dispatch Target</label>
                  <select className="form-control" value={scanContext} onChange={(e) => setScanContext(e.target.value)}>
                    <option value="pos">Point of Sale (POS Sales)</option>
                    <option value="receiving">Goods Inflow Receiving</option>
                    <option value="cycle_count">Inventory Reconciliation</option>
                  </select>
                </div>
              </div>

              <button className="btn btn-primary" style={{ width: "100%", marginBottom: "15px" }} onClick={handleBarcodeScan}>
                Trigger Scanner Ingestion Event
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
                <label>Unique Serial Code</label>
                <input className="form-control" type="text" value={newSerialNum} onChange={(e) => setNewSerialNum(e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label>SKU Variant Mapping</label>
                <select className="form-control" value={serialVariant} onChange={(e) => setSerialVariant(e.target.value)} required>
                  {inventoryList.map(item => (
                    <option key={item.id} value={item.sku}>{item.sku}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: "15px" }}>
                <label>Opening Location</label>
                <input className="form-control" type="text" value={serialLocation} onChange={(e) => setSerialLocation(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                Pre-Register Serial Item
              </button>
            </form>

            <h2>Lifecycle Transitions SIM</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "15px" }}>
              Transitions the serial number state and verifies invariants (e.g. Cannot sell serial that is already SOLD or pending).
            </p>
            <div className="form-grid-2" style={{ marginBottom: "15px" }}>
              <div className="form-group">
                <label>Authorized Actor</label>
                <input className="form-control" type="text" value={serialActor} onChange={(e) => setSerialActor(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Ref Invoice / PO ID</label>
                <input className="form-control" type="text" value={serialRefId} onChange={(e) => setSerialRefId(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button className="btn btn-secondary" onClick={() => handleSerialLifecycleAction("receive")} title="Pending -> InStock">
                Receive Stock
              </button>
              <button className="btn btn-secondary" onClick={() => handleSerialLifecycleAction("sell")} title="InStock -> Sold">
                POS Sell
              </button>
              <button className="btn btn-secondary" onClick={() => handleSerialLifecycleAction("return")} title="Sold -> Returned">
                Customer Return
              </button>
              <button className="btn btn-secondary" onClick={() => handleSerialLifecycleAction("restock")} title="Returned -> InStock">
                Restock Shelf
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
                <label>Composite Kit SKU Code</label>
                <input className="form-control" type="text" placeholder="e.g. BUNDLE-IPHONE-PRO" value={kitSku} onChange={(e) => setKitSku(e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: "15px" }}>
                <label>Bundle Marketing Name</label>
                <input className="form-control" type="text" placeholder="iPhone Tech Pack" value={kitName} onChange={(e) => setKitName(e.target.value)} required />
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
                    <label>Kit SKU Code</label>
                    <select
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
                    <label>Quantity to Sell</label>
                    <input
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
                <label>Active Tenant Context ID</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="e.g. DEFAULT, TENANT_A"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value.toUpperCase())}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label>Accounting Standard</label>
                <select
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
                <label>Costing Layer Method</label>
                <select
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
                  <label>Currency ISO</label>
                  <input
                    className="form-control"
                    type="text"
                    value={tenantCurrencyCode}
                    onChange={(e) => setTenantCurrencyCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Fiscal Year Start</label>
                  <input
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
                <label>Variant SKU</label>
                <select className="form-control" value={valSku} onChange={(e) => setValSku(e.target.value)} required>
                  {inventoryList.map(item => (
                    <option key={item.id} value={item.sku}>{item.sku}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label>Quantity to Consume</label>
                <input className="form-control" type="number" value={valQty} onChange={(e) => setValQty(parseInt(e.target.value) || 0)} required min="1" />
              </div>
              <div className="form-group" style={{ marginBottom: "15px" }}>
                <label>Valuation Method</label>
                <select className="form-control" value={valMethod} onChange={(e) => setValMethod(e.target.value)}>
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
    </div>
  );
}

export default App;
