const history = [
  { quantity: 10, dispatchedAt: new Date(new Date().getTime() - 2 * 24 * 60 * 60 * 1000) },
  { quantity: 10, dispatchedAt: new Date(new Date().getTime() - 5 * 24 * 60 * 60 * 1000) },
  { quantity: 10, dispatchedAt: new Date(new Date().getTime() - 10 * 24 * 60 * 60 * 1000) },
];

const monthlySales = Array(12).fill(0);
history.forEach(record => {
  const month = record.dispatchedAt.getMonth(); // 0-11
  monthlySales[month] += record.quantity;
});
const totalSales = monthlySales.reduce((sum, s) => sum + s, 0);
const activeMonths = monthlySales.filter(s => s > 0).length || 1;
const overallMonthlyAverage = totalSales / activeMonths; // Wait, wait. Is this actually overallMonthlyAverage = totalSales / 12?
console.log({ overallMonthlyAverage, totalSales, activeMonths, monthlySales });

let seasonalMultiplier = 1.0;
if (overallMonthlyAverage > 0) {
  const targetMonth = new Date().getMonth();
  const targetMonthSales = monthlySales[targetMonth];
  if (targetMonthSales > 0) {
    seasonalMultiplier = targetMonthSales / overallMonthlyAverage;
    seasonalMultiplier = Math.max(0.3, Math.min(3.0, seasonalMultiplier));
  }
}
console.log({ seasonalMultiplier });
