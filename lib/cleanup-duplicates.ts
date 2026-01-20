// Cleanup script to remove duplicate data from localStorage
// Run this in the browser console: node cleanup-duplicates.js

export function cleanupDuplicateData() {
  if (typeof window === "undefined") {
    console.log("This script must be run in the browser");
    return;
  }

  const keys = [
    'lab_confirmations',
    'dispatch_plans',
    'oil_approvals',
    'oil_indents'
  ];

  keys.forEach(key => {
    const data = localStorage.getItem(key);
    if (!data) return;

    try {
      const items = JSON.parse(data);
      const uniqueItems: any[] = [];
      const seenIds = new Set<string>();

      items.forEach((item: any) => {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          uniqueItems.push(item);
        }
      });

      if (uniqueItems.length !== items.length) {
        console.log(`${key}: Removed ${items.length - uniqueItems.length} duplicates (${items.length} -> ${uniqueItems.length})`);
        localStorage.setItem(key, JSON.stringify(uniqueItems));
      } else {
        console.log(`${key}: No duplicates found (${items.length} items)`);
      }
    } catch (e) {
      console.error(`Error processing ${key}:`, e);
    }
  });

  console.log("Cleanup complete! Please refresh the page.");
}

// Auto-run if in browser
if (typeof window !== "undefined") {
  cleanupDuplicateData();
}
