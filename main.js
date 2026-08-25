import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { spawnSync } from "child_process";
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

// ==========================================
// 1. IPC Handler: Fetch Latest SR NO Sync
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
// 2. IPC Handler: Add Customer & Generate Documents
// ==========================================
ipcMain.on("add-customer", (event, customer) => {
  try {
    let { sr_no, name, address, date, signature_path } = customer;

    // Auto-calculate sr_no if not provided or invalid
    if (!sr_no || isNaN(parseInt(sr_no, 10))) {
      const maxRow = db
        .prepare("SELECT MAX(CAST(sr_no AS INTEGER)) as max_sr FROM customers")
        .get();
      sr_no = (maxRow && maxRow.max_sr ? maxRow.max_sr : 0) + 1;
    } else {
      sr_no = parseInt(sr_no, 10);
    }

    // Sanitize folder & file names to handle special characters safely
    const safeName = (name || "Unknown").replace(/[/\\?%*:|"<>]/g, "_").trim();
    const folderName = `${sr_no} ${safeName}`;
    const sigFileName = `${safeName}_signature.png`;

    // Target Directory path: DATA/files/<sr_no customername>/
    const targetDir = path.join(__dirname, "DATA", "files", folderName);

    // Create the customer directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let savedSignaturePath = "";

    // Convert Base64 Signature string into PNG file and write to disk
    if (signature_path && signature_path.startsWith("data:image")) {
      const base64Data = signature_path.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      savedSignaturePath = path.join(targetDir, sigFileName);
      fs.writeFileSync(savedSignaturePath, buffer);
    }

    // Paths for Document Generation
    const templateDir = path.join(__dirname, "template");
    const pythonScriptPath = path.join(__dirname, "generate_doc.py");

    const pythonPayload = JSON.stringify({
      template_dir: templateDir,
      target_dir: targetDir,
      sr_no: sr_no,
      customer_name: name,
      customer_address: address,
      date: date,
      signature_path: savedSignaturePath,
      kw: customer.kw,
      panel_company: customer.panel_company,
      panel_watt: customer.panel_watt,
      panel_quantity: customer.panel_quantity,
      inverter_company: customer.inverter_company,
      inverter_watt: customer.inverter_watt,
      structure_watt: customer.structure_watt,
      cost: customer.cost,
    });

    // Execute Python script safely by piping JSON payload via input stream (stdin)
    const pythonExecutable =
      process.platform === "win32" ? "python" : "python3";
    const pythonProcess = spawnSync(pythonExecutable, [pythonScriptPath], {
      input: pythonPayload, // Send data safely via stdin
      encoding: "utf-8",
      shell: false, // Resolves DEP0190 security warning
    });

    if (pythonProcess.error) {
      console.error("Python execution error:", pythonProcess.error);
    } else if (pythonProcess.stderr) {
      console.error("Python Stderr Output:", pythonProcess.stderr);
    }

    if (pythonProcess.stdout) {
      try {
        const pyResult = JSON.parse(pythonProcess.stdout.trim());
        if (!pyResult.success) {
          console.error("Document generation error:", pyResult.error);
        } else {
          console.log("Documents generated successfully:", pyResult);
        }
      } catch (parseErr) {
        console.error("Failed to parse Python response:", pythonProcess.stdout);
      }
    }

    // Insert customer record with disk file path saved into database
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
      sr_no,
      signature_path: savedSignaturePath,
    });

    event.returnValue = {
      success: true,
      id: info.lastInsertRowid,
      sr_no,
      signature_path: savedSignaturePath,
    };
  } catch (err) {
    console.error("Database Insertion Error:", err);
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
