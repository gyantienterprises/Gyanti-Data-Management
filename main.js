import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;

function initDatabase() {
  // 1. Check and create the DATA folder if missing
  const dataFolderPath = path.join(__dirname, "DATA");
  if (!fs.existsSync(dataFolderPath)) {
    fs.mkdirSync(dataFolderPath, { recursive: true });
  }

  // 2. Check and connect to SQLite database file
  const dbPath = path.join(dataFolderPath, "gyanti_database.db");
  db = new Database(dbPath);

  // Enable foreign key support in SQLite
  db.pragma("foreign_keys = ON");

  // 3. Create customers and invoices tables with sr_no reference
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sr_no INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        address TEXT,
        date TEXT,
        kw REAL,
        panel_company TEXT,
        panel_watt INTEGER,
        panel_quantity INTEGER,
        inverter_company TEXT,
        inverter_watt REAL,
        structure_watt REAL,
        cost REAL,
        signature_path TEXT
    );

    CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_sr_no INTEGER NOT NULL,
        invoice_no TEXT NOT NULL UNIQUE,
        date TEXT,
        panel_company TEXT,
        panel_watt INTEGER,
        panel_quantity INTEGER,
        panel_type TEXT,
        panel_total_cost REAL,
        inverter_company TEXT,
        inverter_watt REAL,
        inverter_total_cost REAL,
        structure_total_cost REAL,
        installation_total_cost REAL,
        FOREIGN KEY (customer_sr_no) REFERENCES customers(sr_no) ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  console.log("Database initialized successfully at:", dbPath);
}

// IPC Listener to handle adding new customers and saving signature files
// ==========================================
// 1. New Handler: Fetch Latest SR NO Sync
// ==========================================
ipcMain.on("get-latest-sr-no", (event) => {
  try {
    const row = db
      .prepare("SELECT MAX(CAST(sr_no AS INTEGER)) as max_sr FROM customers")
      .get();
    const latestSrNo = row && row.max_sr ? row.max_sr : 0;
    event.returnValue = { success: true, latestSrNo };
  } catch (err) {
    console.error("Error fetching latest sr_no:", err);
    event.returnValue = { success: false, latestSrNo: 0, error: err.message };
  }
});

// ==========================================
// 2. Updated Handler: Add Customer
// ==========================================
// ==========================================
// 1. New Handler: Fetch Latest SR NO Sync
// ==========================================
ipcMain.on('get-latest-sr-no', (event) => {
  try {
    const row = db.prepare('SELECT MAX(CAST(sr_no AS INTEGER)) as max_sr FROM customers').get();
    const latestSrNo = row && row.max_sr ? row.max_sr : 0;
    event.returnValue = { success: true, latestSrNo };
  } catch (err) {
    console.error('Error fetching latest sr_no:', err);
    event.returnValue = { success: false, latestSrNo: 0, error: err.message };
  }
});

// ==========================================
// 2. Updated Handler: Add Customer
// ==========================================
ipcMain.on('add-customer', (event, customer) => {
  try {
    let { sr_no, name, signature_path } = customer;

    // Auto-calculate sr_no if not provided or invalid
    if (!sr_no || isNaN(parseInt(sr_no, 10))) {
      const maxRow = db.prepare('SELECT MAX(CAST(sr_no AS INTEGER)) as max_sr FROM customers').get();
      sr_no = (maxRow && maxRow.max_sr ? maxRow.max_sr : 0) + 1;
    } else {
      sr_no = parseInt(sr_no, 10);
    }

    // Sanitize folder & file names to handle special characters safely
    const safeName = (name || 'Unknown').replace(/[/\\?%*:|"<>]/g, '_').trim();
    const folderName = `${sr_no} ${safeName}`;
    const fileName = `${safeName}_signature.png`;

    // Directory path: DATA/files/<sr_no customername>/
    const targetDir = path.join(__dirname, 'DATA', 'files', folderName);

    // Create the customer directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let savedSignaturePath = '';

    // Convert Base64 Signature string into PNG file and write to disk
    if (signature_path && signature_path.startsWith('data:image')) {
      const base64Data = signature_path.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const filePath = path.join(targetDir, fileName);
      fs.writeFileSync(filePath, buffer);

      savedSignaturePath = filePath;
    }

    // Insert record with disk file path saved into the database
    const stmt = db.prepare(`
      INSERT INTO customers (
        sr_no, name, address, date, kw,
        panel_company, panel_watt, panel_quantity,
        inverter_company, inverter_watt, structure_watt,
        cost, signature_path
      ) VALUES (
        @sr_no, @name, @address, @date, @kw,
        @panel_company, @panel_watt, @panel_quantity,
        @inverter_company, @inverter_watt, @structure_watt,
        @cost, @signature_path
      )
    `);

    const info = stmt.run({
      ...customer,
      sr_no, // Overwrite with parsed integer / calculated auto-increment
      signature_path: savedSignaturePath
    });

    event.returnValue = { 
      success: true, 
      id: info.lastInsertRowid, 
      sr_no, 
      signature_path: savedSignaturePath 
    };
  } catch (err) {
    console.error('Database Insertion Error:', err);
    event.returnValue = { success: false, error: err.message };
  }
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#0B0F19",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadURL("http://localhost:5173");
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
});

app.on("window-all-closed", () => {
  if (db) db.close();
  if (process.platform !== "darwin") app.quit();
});
