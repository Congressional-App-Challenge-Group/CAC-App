import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

interface Meeting {
  date: string;
  name: string;
  time: string;
  location: string;
}

async function scrapeCharlotteCalendar(): Promise<Meeting[]> {
  const url = "https://charlottenc.legistar.com/Calendar.aspx";
  const response = await fetch(url);
  const html = await response.text();
  
  // Extract meeting dates from the HTML
  const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4})/g;
  const dates = html.match(datePattern) || [];
  
  // Convert to YYYY-MM-DD format
  const formattedDates = dates.map(dateStr => {
    const [month, day, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  });
  
  // Get unique dates
  const uniqueDates = [...new Set(formattedDates)].sort();
  
  // Filter for future dates (starting from today)
  const today = new Date().toISOString().slice(0, 10);
  const futureDates = uniqueDates.filter(date => date >= today);
  
  console.log('Future meeting dates from Charlotte calendar:');
  futureDates.forEach(date => console.log(`  ${date}`));
  
  // Create placeholder meetings for each date
  const meetings: Meeting[] = futureDates.map(date => ({
    date,
    name: "Charlotte City Council Meeting",
    time: "5:00 PM",
    location: "Council Chamber",
  }));
  
  return meetings;
}

async function main() {
  const meetings = await scrapeCharlotteCalendar();
  const output = resolve(process.cwd(), ".civiclens/future-meetings.json");
  await writeFile(output, JSON.stringify(meetings, null, 2));
  console.log(`\nSaved ${meetings.length} future meetings to ${output}`);
}

main().catch(console.error);
