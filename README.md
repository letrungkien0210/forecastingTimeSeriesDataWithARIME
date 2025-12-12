# Forecasting Time Series Data with ARIMA

A TypeScript project for forecasting time series data using ARIMA/AutoARIMA models.

## Prerequisites

- Node.js v24.6.0 or higher
- npm

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

## Usage

### Development Mode (runs TypeScript directly)
```bash
npm run dev
```

### Production Mode (runs compiled JavaScript)
```bash
npm run build
npm start
```

## Project Structure

- `forecast-arima.ts` - Main TypeScript file with ARIMA forecasting logic
- `trainningData.csv` - Training data file (CSV format with date,value columns)
- `dist/` - Compiled JavaScript output (generated after build)

## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled JavaScript
- `npm run dev` - Run TypeScript directly using ts-node
- `npm run clean` - Remove the dist directory

## Note

Make sure to update the CSV file path in `forecast-arima.ts` (line 176) if your data file has a different name or location. Currently, the code references `./water_usage_daily.csv`, but you may need to change it to `./trainningData.csv` or your actual file path.