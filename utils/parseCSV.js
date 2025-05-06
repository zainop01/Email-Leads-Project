// utils/parseCSV.js
const fs     = require("fs");
const path   = require("path");
const os     = require("os");
const csv    = require("fast-csv");
const axios  = require("axios");

async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv.parse({ headers: true, trim: true }))
      .on("error", err => reject(err))
      .on("data", row => {
        // Only include rows with an email
        const emailKey = Object.keys(row).find(k => k.toLowerCase() === "email");
        if (emailKey && row[emailKey]) {
          // normalize the email field
          row.email = row[emailKey].trim();
          rows.push(row);
        }
      })
      .on("end", rowCount => {
        console.log(`⚙️  Parsed ${rowCount} rows, retained ${rows.length} recipients`);
        resolve(rows);
      });
  });
}

async function parseCSVUrl(url) {
  const tmpPath = path.join(os.tmpdir(), `tpl-csv-${Date.now()}.csv`);
  const writer  = fs.createWriteStream(tmpPath);

  const response = await axios.get(url, { responseType: "stream" });
  await new Promise((res, rej) => {
    response.data.pipe(writer);
    writer.on("finish", res);
    writer.on("error", rej);
  });

  try {
    return await parseCSV(tmpPath);
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}

module.exports = { parseCSV, parseCSVUrl };