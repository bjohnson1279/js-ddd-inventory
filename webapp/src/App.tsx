import { useState } from 'react';
import './App.css';

interface OnboardingItem {
  sku: string;
  quantity: number;
  unitCostCents: number;
}

function App() {
  const [locationId, setLocationId] = useState('Main Store');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<OnboardingItem[]>([
    { sku: '', quantity: 0, unitCostCents: 0 }
  ]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const addItem = () => {
    setItems([...items, { sku: '', quantity: 0, unitCostCents: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OnboardingItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('http://localhost:5000/api/onboarding/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationId,
          asOfDate,
          items,
          actorId: 'setup-web-app'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Inventory setup successful!' });
        setItems([{ sku: '', quantity: 0, unitCostCents: 0 }]);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit onboarding' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Could not connect to the API. Make sure it is running.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Inventory Initial Setup</h1>
      <p>Enter your initial stock levels to begin using the system.</p>

      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h2>Session Configuration</h2>
          <div className="grid">
            <div className="field">
              <label>Location ID</label>
              <input 
                type="text" 
                value={locationId} 
                onChange={(e) => setLocationId(e.target.value)} 
                required 
              />
            </div>
            <div className="field">
              <label>As Of Date</label>
              <input 
                type="date" 
                value={asOfDate} 
                onChange={(e) => setAsOfDate(e.target.value)} 
                required 
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Items</h2>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Quantity</th>
                <th>Unit Cost (Cents)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>
                    <input 
                      type="text" 
                      placeholder="e.g. SKU-123"
                      value={item.sku} 
                      onChange={(e) => updateItem(index, 'sku', e.target.value)} 
                      required 
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      value={item.quantity} 
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)} 
                      required 
                      min="0"
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      value={item.unitCostCents} 
                      onChange={(e) => updateItem(index, 'unitCostCents', parseInt(e.target.value) || 0)} 
                      required 
                      min="0"
                    />
                  </td>
                  <td>
                    {items.length > 1 && (
                      <button type="button" className="btn-remove" onClick={() => removeItem(index)}>
                        &times;
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn-add" onClick={addItem}>
            + Add Another SKU
          </button>
        </div>

        <div className="actions">
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Submitting...' : 'Initialize Inventory'}
          </button>
        </div>
      </form>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}

export default App;
