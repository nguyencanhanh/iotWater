#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import connectToDatabase from './db/db.js';
import Sensor from './models/Sensor.js';
import dotenv from 'dotenv';

dotenv.config();

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { input: null, index: 28429, user: 0, resolutionMinutes: 1, batchSize: 1000, endAtMidnight: true };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === '--csv' || a === '-c' || a === '--input' || a === '-i') && args[i+1]) { out.input = args[++i]; }
    else if (a === '--index' && args[i+1]) { out.index = Number(args[++i]); }
    else if (a === '--user' && args[i+1]) { out.user = Number(args[++i]); }
    else if (a === '--resolution-minutes' && args[i+1]) { out.resolutionMinutes = Number(args[++i]); }
    else if (a === '--batch-size' && args[i+1]) { out.batchSize = Number(args[++i]); }
    else if (a === '--no-end-midnight') { out.endAtMidnight = false; }
  }
  return out;
}

function readCsvRecords(csvPath) {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(csvPath)
      .pipe(csvParser())
      .on('data', (row) => {
        records.push(row);
      })
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}

function toTimestampMs(thoiGianStr) {
  // Expecting format like: 4/5/2026-00:00:58 or 4/5/2026 00:00:58; normalize
  const s = thoiGianStr.replace('-', ' ').trim();
  const d = new Date(s);
  if (isNaN(d.getTime())) {
    // Try with explicit parsing: m/d/Y-H:M:S
    // Split by space
    const parts = thoiGianStr.split(/[- ]/);
    if (parts.length >= 2) {
      const datePart = parts[0];
      const timePart = parts[1];
      const [m,d,y] = datePart.split('/').map(Number);
      const [hh,mm,ss] = timePart.split(':').map(Number);
      const dd = new Date(y, m-1, d, hh, mm, ss);
      return dd.getTime();
    }
  }
  return d.getTime();
}

function buildInterpolatedPoints(rows, resolutionMinutes = 1) {
  // Expect rows to contain Thoi_Gian, Ap_Sau_Van, Dung_Luong_Ac_Quy_Van
  const points = rows.map(r => {
    return {
      t: toTimestampMs(r['Thoi_Gian']),
      ap_sau_van: (r['Ap_Sau_Van'] !== undefined && r['Ap_Sau_Van'] !== '') ? Number(r['Ap_Sau_Van']) : NaN,
      battery: (r['Dung_Luong_Ac_Quy_Van'] !== undefined && r['Dung_Luong_Ac_Quy_Van'] !== '') ? Number(r['Dung_Luong_Ac_Quy_Van']) : NaN,
    };
  }).filter(p => !isNaN(p.t)).sort((a,b) => a.t - b.t);

  const out = [];
  const stepMs = resolutionMinutes * 60 * 1000;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i+1];
    if (b.t <= a.t) continue;
    // include a point at a.t (if first) then intermediate minutes
    if (i === 0) {
      out.push({ t: a.t, ap_sau_van: a.ap_sau_van, battery: a.battery });
    }
    for (let t = a.t + stepMs; t <= b.t; t += stepMs) {
      const frac = (t - a.t) / (b.t - a.t);
      const ap = (isNaN(a.ap_sau_van) || isNaN(b.ap_sau_van)) ? NaN : (a.ap_sau_van + frac * (b.ap_sau_van - a.ap_sau_van));
      const bat = (isNaN(a.battery) || isNaN(b.battery)) ? NaN : (a.battery + frac * (b.battery - a.battery));
      out.push({ t, ap_sau_van: ap, battery: bat });
    }
  }
  // If there's only one point or to ensure last original timestamp included
  if (points.length >= 1) {
    const last = points[points.length - 1];
    // avoid duplicate if already present
    if (out.length === 0 || out[out.length -1].t !== last.t) {
      out.push({ t: last.t, ap_sau_van: last.ap_sau_van, battery: last.battery });
    }
  }
  return out;
}

async function insertDocuments(docs, batchSize = 1000) {
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const res = await Sensor.insertMany(batch, { ordered: false });
    console.log(`Inserted batch ${i}..${i + batch.length - 1} (${res.length} docs)`);
  }
}

async function main() {
  const opts = parseArgs();
  if (!opts.input) {
    console.error('Missing --input <file|dir> argument');
    process.exit(2);
  }

  const inputPath = path.resolve(opts.input);
  if (!fs.existsSync(inputPath)) {
    console.error('Input path not found:', inputPath);
    process.exit(2);
  }

  // build list of csv files to process
  let csvFiles = [];
  const stat = fs.statSync(inputPath);
  if (stat.isDirectory()) {
    csvFiles = fs.readdirSync(inputPath)
      .filter(f => f.toLowerCase().endsWith('.csv'))
      .map(f => path.join(inputPath, f))
      .sort();
  } else {
    csvFiles = [inputPath];
  }

  if (csvFiles.length === 0) {
    console.error('No CSV files found in input path');
    process.exit(2);
  }

  await connectToDatabase();

  let totalInserted = 0;
  for (const csvPath of csvFiles) {
    console.log('Processing', csvPath);
    const rows = await readCsvRecords(csvPath);
    console.log(`  Loaded ${rows.length} CSV rows`);

    // If requested, ensure we extend to midnight (00:00:00 of next day)
    if (opts.endAtMidnight && rows.length > 0) {
      // parse first row date to infer day
      let firstDate = null;
      try {
        firstDate = toTimestampMs(rows[0]['Thoi_Gian']);
      } catch (e) {
        // fallback: use first parsed row via readCsvRecords order
      }
      // compute midnight of next day based on last row's date
      const lastRow = rows[rows.length-1];
      const lastTs = toTimestampMs(lastRow['Thoi_Gian']);
      const lastDate = new Date(lastTs);
      const midnight = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + 1, 0, 0, 0);

      if (lastTs < midnight.getTime()) {
        // append a synthetic row at midnight carrying forward last known values
        const carryAp = lastRow['Ap_Sau_Van'];
        const carryBat = lastRow['Dung_Luong_Ac_Quy_Van'];
        rows.push({ 'Thoi_Gian': `${midnight.getMonth()+1}/${midnight.getDate()}/${midnight.getFullYear()} ${String(midnight.getHours()).padStart(2,'0')}:${String(midnight.getMinutes()).padStart(2,'0')}:${String(midnight.getSeconds()).padStart(2,'0')}`, 'Ap_Sau_Van': carryAp, 'Dung_Luong_Ac_Quy_Van': carryBat });
        console.log('  Appended synthetic midnight row to extend to 00:00');
      }
    }

    const interp = buildInterpolatedPoints(rows, opts.resolutionMinutes);
    console.log(`  Prepared ${interp.length} interpolated timestamps (resolution ${opts.resolutionMinutes} min)`);

    const docs = interp.map(p => ({
      index: Number(opts.index),
      user: Number(opts.user),
      Pressure: Number.isFinite(p.ap_sau_van) ? p.ap_sau_van * 10 : null,
      battery: Number.isFinite(p.battery) ? p.battery : null,
      flow: null,
      temperature: 25,
      sum: 0,
      createAt: new Date(p.t),
    }));

    if (docs.length === 0) {
      console.log('  No documents to insert for', csvPath);
      continue;
    }

    console.log('  Sample document:', docs[0]);
    await insertDocuments(docs, opts.batchSize);
    totalInserted += docs.length;
  }

  console.log(`All done. Total documents prepared/inserted (approx): ${totalInserted}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
