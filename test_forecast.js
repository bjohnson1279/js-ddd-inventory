const monthlySales = Array(12).fill(0);
const monthlyCounts = Array(12).fill(0);

const now = new Date();
const dates = [
  new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
  new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
  new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
];

dates.forEach(d => {
  const month = d.getMonth();
  monthlySales[month] += 10;
  monthlyCounts[month] += 1;
});

const totalSales = monthlySales.reduce((sum, s) => sum + s, 0);
const activeMonths = 12; // Wait, wait. Is the actual code using 12 or activeMonths?
// Let's re-read the code:
// const activeMonths = monthlySales.filter(s => s > 0).length || 1;
// Wait! If activeMonths = 1 (because only current month has sales), then overallMonthlyAverage = 30 / 1 = 30.
// Then targetMonthSales = 30. seasonalMultiplier = 30 / 30 = 1.0.
