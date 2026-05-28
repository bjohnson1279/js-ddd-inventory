async function test() {
  await fetch("http://localhost:5000/api/inventory/receive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku: "TEST-1", amount: 10 })
  });

  await fetch("http://localhost:5000/api/inventory/dispatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku: "TEST-1", amount: 10 })
  });
}

test();
