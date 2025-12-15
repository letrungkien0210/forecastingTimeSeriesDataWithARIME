import fs from "fs";
import path from "path";

/**
 * Group usage by day (from 1AM to 00AM of next day)
 * and export to a new CSV file
 */
function groupUsageByDay(inputPath: string, outputPath: string): void {
  const absoluteInputPath = path.resolve(inputPath);
  const absoluteOutputPath = path.resolve(outputPath);

  // Read the CSV file
  const raw = fs.readFileSync(absoluteInputPath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Skip header
  const [, ...dataLines] = lines;

  // Parse data and group by day
  const dayGroups = new Map<string, number>();

  for (const line of dataLines) {
    const [timepointStr, usageStr] = line.split(",");
    const usage = Number(usageStr);

    if (Number.isNaN(usage)) {
      console.warn(`Skipping invalid line: ${line}`);
      continue;
    }

    // Parse the timestamp
    const date = new Date(timepointStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = date.getHours();

    // Determine which day group this belongs to
    // If hour is 0 (midnight), it belongs to the previous day's group
    // If hour is 1-23, it belongs to the current day's group
    let groupDate: string;
    if (hour === 0) {
      // This midnight belongs to the previous day
      const prevDate = new Date(date);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevYear = prevDate.getFullYear();
      const prevMonth = String(prevDate.getMonth() + 1).padStart(2, "0");
      const prevDay = String(prevDate.getDate()).padStart(2, "0");
      groupDate = `${prevYear}-${prevMonth}-${prevDay}`;
    } else {
      // Hours 1-23 belong to the current day
      groupDate = `${year}-${month}-${day}`;
    }

    // Add usage to the group
    const currentUsage = dayGroups.get(groupDate) || 0;
    dayGroups.set(groupDate, currentUsage + usage);
  }

  // Sort by date
  const sortedDates = Array.from(dayGroups.keys()).sort();

  // Write to output CSV
  const outputLines = ["Timepoint,Usage"];
  for (const date of sortedDates) {
    const usage = dayGroups.get(date) || 0;
    outputLines.push(`${date},${usage.toFixed(4)}`);
  }

  fs.writeFileSync(absoluteOutputPath, outputLines.join("\n") + "\n", "utf8");

  console.log(`✅ Processed ${dataLines.length} data points`);
  console.log(`✅ Grouped into ${sortedDates.length} days`);
  console.log(`✅ Output written to: ${absoluteOutputPath}`);
}

// Run the script
const inputFile = "./data/two_months/trainningData.csv";
const outputFile = "./data/two_months/trainningData-grouped-by-day.csv";

groupUsageByDay(inputFile, outputFile);

