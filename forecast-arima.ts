// forecast-arima.ts
// Quick ARIMA / AutoARIMA pipeline in TypeScript using `arima` npm package

import fs from "fs";
import path from "path";

// `arima` is a CommonJS module, so we use require to avoid typing issues
// If you use ESLint, add a disable rule for this line
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ARIMA = require("arima");


const trainingDataPath = "./data/3_months/trainningData-grouped-by-day.csv";
const testingDataPath = "./data/3_months/testingData-grouped-by-day.csv";
/**
 * Defines the structure of a single time series point
 */
interface TimeSeriesPoint {
  date: Date;
  value: number;
}

/**
 * Forecast result structure
 */
interface ForecastResult {
  modelInfo: {
    // Main parameters of ARIMA/AutoARIMA
    p?: number;
    d?: number;
    q?: number;
    P?: number;
    D?: number;
    Q?: number;
    s?: number;
    auto: boolean;
  };
  history: TimeSeriesPoint[];
  forecast: {
    date: Date;
    value: number;
    error: number;
  }[];
}

/**
 * Load data from CSV file
 * Assumes CSV has 2 columns: date,value
 *   - date: yyyy-MM-dd or ISO datetime
 *   - value: numeric value (e.g., m3 water/day)
 */
function loadCsvTimeSeries(csvPath: string): TimeSeriesPoint[] {
  const absolute = path.resolve(csvPath);
  const raw = fs.readFileSync(absolute, "utf8");

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Skip header if present
  const [firstLine, ...dataLines] = lines;
  const hasHeader =
    firstLine.toLowerCase().includes("timepoint") ||
    firstLine.toLowerCase().includes("usage");

  const linesToUse = hasHeader ? dataLines : lines;

  const result: TimeSeriesPoint[] = linesToUse.map((line) => {
    const [dateStr, valueStr] = line.split(",");
    const date = new Date(dateStr);
    const value = Number(valueStr);
    if (Number.isNaN(value)) {
      throw new Error(`Invalid numeric value at line: "${line}"`);
    }
    return { date, value };
  });

  // Sort by time (in case CSV is not already sorted)
  result.sort((a, b) => a.date.getTime() - b.date.getTime());

  return result;
}

/**
 * Extract only numeric series from TimeSeriesPoint list
 */
function toNumericSeries(points: TimeSeriesPoint[]): number[] {
  return points.map((p) => p.value);
}

/**
 * Run AutoARIMA + forecast n steps into the future
 *
 * @param points Time series data (cleaned, evenly spaced)
 * @param steps Number of forecast steps (e.g., 11 days ahead)
 * @param options ARIMA configuration options
 */
function runAutoArimaForecast(
  points: TimeSeriesPoint[],
  steps: number,
  _options?: {
    // Whether to include seasonality (e.g., daily data with weekly pattern)
    seasonal?: boolean;
    seasonalPeriod?: number; // e.g., 7 for weekly, 24 for hourly-with-daily-seasonality
    verbose?: boolean;
  }
): ForecastResult {
  // const seasonal = options?.seasonal ?? true;
  // const seasonalPeriod = options?.seasonalPeriod ?? 7; // default: weekly pattern
  // const verbose = options?.verbose ?? false;

  const series = toNumericSeries(points);

  if (series.length < 10) {
    throw new Error("Time series is too short (<10 points) to train ARIMA.");
  }

  // ==== AUTO-ARIMA SETUP ====
  // Based on the `arima` package README:
  //   const autoarima = new ARIMA({ auto: true }).fit(ts)
  //   const [pred, errors] = autoarima.predict(12)  [oai_citation:1‡GitHub](https://github.com/zemlyansky/arima)
  //
  // Here we set max p,d,q,P,D,Q to avoid too large search space.
  // const arimaOptions = {
  //   auto: true, // Enable AutoARIMA
  //   // Max order for search (relatively chosen, you can adjust)
  //   p: 5,
  //   d: 2,
  //   q: 5,
  //   P: seasonal ? 2 : 0,
  //   D: seasonal ? 1 : 0,
  //   Q: seasonal ? 2 : 0,
  //   s: seasonal ? seasonalPeriod : 0,
  //   verbose,
  // };

  const arimaOptionsNotSeasonal = {
    auto: true, // Enable AutoARIMA
    // Max order for search (relatively chosen, you can adjust)
    p: 2,
    d: 1,
    q: 2,
    P: 0,
    D: 0,
    Q: 0,
    s: 0
  };

  // Initialize and fit the model
  const autoarima = new ARIMA(arimaOptionsNotSeasonal).fit(series);

  // Forecast `steps` steps into the future
  const [pred, errors]: [number[], number[]] = autoarima.predict(steps);

    // Build list of future dates
    const lastDate = points[points.length - 1].date;
    // Calculate step size based on data frequency
    // If data is hourly, use 60 * 60 * 1000; if daily, use 24 * 60 * 60 * 1000
    // Auto-detect: calculate average time difference between consecutive points
    let stepMs: number;
    if (points.length >= 2) {
      const timeDiffs = [];
      for (let i = 1; i < Math.min(points.length, 10); i++) {
        timeDiffs.push(points[i].date.getTime() - points[i - 1].date.getTime());
      }
      stepMs = Math.round(
        timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length
      );
    } else {
      // Fallback: assume hourly if can't determine
      stepMs = 60 * 60 * 1000;
    }

  const forecastPoints = pred.map((value, idx) => {
    const date = new Date(lastDate.getTime() + stepMs * (idx + 1));
    const error = errors[idx];
    return { date, value, error };
  });

  const modelInfo: ForecastResult["modelInfo"] = {
    auto: true,
    p: arimaOptionsNotSeasonal.p,
    d: arimaOptionsNotSeasonal.d,
    q: arimaOptionsNotSeasonal.q,
    P: arimaOptionsNotSeasonal.P,
    D: arimaOptionsNotSeasonal.D,
    Q: arimaOptionsNotSeasonal.Q,
    s: arimaOptionsNotSeasonal.s,
  };

  return {
    modelInfo,
    history: points,
    forecast: forecastPoints,
  };
}

/**
 * Convenience function: load CSV, run AutoARIMA, log results
 */
async function main() {
  try {
    // CSV file path - update this if your file is in a different location
    const csvPath = trainingDataPath;

    console.log("🔹 Loading CSV...");
    const points = loadCsvTimeSeries(csvPath);
    console.log(`Loaded ${points.length} points from ${csvPath}`);

    console.log("🔹 Running AutoARIMA + forecast 11 days...");
    const result = runAutoArimaForecast(points, 11, {
      seasonal: true,
      seasonalPeriod: 7, // unit is cycle, e.g. if data is daily, seasonalPeriod is 7 days, if data is hourly, seasonalPeriod is 7 hours,
      verbose: false,
    });

    console.log("=== Model Info (search bounds, auto=true) ===");
    console.log(result.modelInfo);

    console.log("\n=== Last 5 history points ===");
    result.history.slice(-5).forEach((p) => {
      console.log(
        `${p.date.toISOString().slice(0, 10)} -> ${p.value.toFixed(3)}`
      );
    });

    console.log("\n=== Forecast (next 11 days) ===");
    result.forecast.forEach((f) => {
      console.log(
        `${f.date.toISOString().slice(0, 10)} -> ` +
          `pred=${f.value.toFixed(3)}, error≈${f.error.toFixed(3)}`
      );
    });

    // === Evaluate on test set ===
    const testPath = testingDataPath;
    const testPoints = loadCsvTimeSeries(testPath);
    const actual = testPoints.map(p => p.value);

    // ARIMA forecast array (giá trị đã log ở trên)
    const arimaPred = result.forecast.map(f => f.value);

    // Baseline: dùng giá trị cuối cùng của training (points)
    const lastTrainValue = points[points.length - 1].value;
    const baselinePred = actual.map(() => lastTrainValue);

    const maeArima  = meanAbsoluteError(actual, arimaPred);
    const rmseArima = rootMeanSquaredError(actual, arimaPred);
    const mapeArima = meanAbsolutePercentageError(actual, arimaPred);

    const maeBase  = meanAbsoluteError(actual, baselinePred);
    const rmseBase = rootMeanSquaredError(actual, baselinePred);
    const mapeBase = meanAbsolutePercentageError(actual, baselinePred);

    console.log("\n=== Evaluation on test set (2025-10-21 → 2025-10-31) ===");
    console.log("Baseline value:", lastTrainValue.toFixed(3));
    console.log(`Baseline  - MAE: ${maeBase.toFixed(2)}, RMSE: ${rmseBase.toFixed(2)}, MAPE: ${mapeBase.toFixed(2)}%`);
    console.log(`ARIMA     - MAE: ${maeArima.toFixed(2)}, RMSE: ${rmseArima.toFixed(2)}, MAPE: ${mapeArima.toFixed(2)}%`);
  } catch (err) {
    console.error("Error:", err);
  }
}

// Run script if file is executed directly
// (node dist/forecast-arima.js)
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}

function meanAbsoluteError(actual: number[], predicted: number[]): number {
  const n = actual.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.abs(actual[i] - predicted[i]);
  }
  return sum / n;
}

function rootMeanSquaredError(actual: number[], predicted: number[]): number {
  const n = actual.length;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const diff = actual[i] - predicted[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq / n);
}

function meanAbsolutePercentageError(actual: number[], predicted: number[]): number {
  const n = actual.length;
  let sumPct = 0;
  for (let i = 0; i < n; i++) {
    if (actual[i] !== 0) {
      sumPct += Math.abs((actual[i] - predicted[i]) / actual[i]);
    }
  }
  return (sumPct / n) * 100;
}

export { loadCsvTimeSeries, runAutoArimaForecast, ForecastResult };