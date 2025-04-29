// utils/parseCSV.js
const fs     = require("fs");
const path   = require("path");
const os     = require("os");
const csv    = require("fast-csv");
const axios  = require("axios");

async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const emails = [];
    fs.createReadStream(filePath)
      .pipe(csv.parse({ headers: true, trim: true }))
      .on("error", err => reject(err))
      .on("data", row => {
        // find any column whose name lower-cased is "email"
        const key = Object.keys(row)
          .find(k => k.toLowerCase() === "email");
        if (key && row[key]) {
          emails.push(row[key].trim());
        }
      })
      .on("end", rowCount => {
        console.log(`⚙️  Parsed ${rowCount} rows, found ${emails.length} emails`);
        resolve(emails);
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