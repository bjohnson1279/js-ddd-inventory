// If today is August 3.
// 2 days ago is August 1
// 5 days ago is July 29
// 10 days ago is July 24

// So one dispatch in August, two in July.
// Total active months = 2.
// Overall monthly average = 30 / 2 = 15.
// Target month is August (current month).
// Target month sales = 10.
// Seasonal multiplier = 10 / 15 = 0.66666...
// Base quantity = 1.0 (ADS) * 15 (forecast days) = 15.
// Forecast quantity = Math.ceil(15 * 1.2 * (10/15)) = Math.ceil(15 * 1.2 * 0.6666) = Math.ceil(12) = 12.

// If today is May 15th
// 2 days ago is May 13th
// 5 days ago is May 10th
// 10 days ago is May 5th
// Total active months = 1.
// Overall monthly average = 30.
// Target month is May.
// Target month sales = 30.
// Seasonal multiplier = 30 / 30 = 1.0.
// Forecast quantity = Math.ceil(15 * 1.2 * 1.0) = Math.ceil(18) = 18.
