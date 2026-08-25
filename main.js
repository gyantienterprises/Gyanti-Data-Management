import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { spawn } from "child_process"; // CHANGED: spawnSync -> spawn (non-blocking)
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
// Helper: run generate_doc.py WITHOUT blocking the main process,
// and resolve/reject once it's done. This replaces spawnSync.
// ==========================================
function generateDocuments(pythonPayload) {
  return new Promise((resolve, reject) => {
    const templateDirExists = true; // kept for clarity, no behavior change
    const pythonScriptPath = path.join(__dirname, "generate_doc.py");
    const pythonExecutable =
      process.platform === "win32" ? "python" : "python3";

    const pythonProcess = spawn(pythonExecutable, [pythonScriptPath], {
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    pythonProcess.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    pythonProcess.on("error", (err) => {
      console.error("Python execution error:", err);
      reject(err);
    });

    pythonProcess.on("close", () => {
      if (stderr) console.error("Python Stderr Output:", stderr);
      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch (parseErr) {
        console.error("Failed to parse Python response:", stdout);
        reject(new Error("Failed to parse Python response: " + stdout));
      }
    });

    pythonProcess.stdin.write(pythonPayload);
    pythonProcess.stdin.end();
  });
}

// ==========================================
// 2. IPC Handler: Add Customer & Generate Documents
// CHANGED: ipcMain.on(...sendSync) -> ipcMain.handle(...invoke), async,
// with progress events sent back to the renderer at each stage.
// ==========================================
ipcMain.handle("add-customer", async (event, customer) => {
  const sender = event.sender;
  const sendProgress = (step, total, message) => {
    sender.send("add-customer-progress", { step, total, message });
  };

  try {
    sendProgress(1, 4, "Preparing customer folder...");

    let { sr_no, name, address, date, signature_path } = customer;

    if (!sr_no || isNaN(parseInt(sr_no, 10))) {
      const maxRow = db
        .prepare("SELECT MAX(CAST(sr_no AS INTEGER)) as max_sr FROM customers")
        .get();
      sr_no = (maxRow && maxRow.max_sr ? maxRow.max_sr : 0) + 1;
    } else {
      sr_no = parseInt(sr_no, 10);
    }

    const safeName = (name || "Unknown").replace(/[/\\?%*:|"<>]/g, "_").trim();
    const folderName = `${sr_no} ${safeName}`;
    const sigFileName = `${safeName}_signature.png`;

    const targetDir = path.join(__dirname, "DATA", "files", folderName);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let savedSignaturePath = "";

    if (signature_path && signature_path.startsWith("data:image")) {
      const base64Data = signature_path.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      savedSignaturePath = path.join(targetDir, sigFileName);
      fs.writeFileSync(savedSignaturePath, buffer);
    }

    sendProgress(2, 4, "Signature saved. Generating documents...");

    const templateDir = path.join(__dirname, "template");

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

    const pyResult = await generateDocuments(pythonPayload);

    if (!pyResult.success) {
      console.error("Document generation error:", pyResult.error);
    } else {
      console.log("Documents generated successfully:", pyResult);
    }

    sendProgress(3, 4, "Documents generated. Saving to database...");

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

    sendProgress(4, 4, "Done!");

    return {
      success: true,
      id: info.lastInsertRowid,
      sr_no,
      signature_path: savedSignaturePath,
    };
  } catch (err) {
    console.error("Database Insertion Error:", err);
    return { success: false, error: err.message };
  }
});

// ==========================================
// 3. IPC Handler: Fetch All Customers with Bill Date
// ==========================================
ipcMain.on("get-all-customers", (event) => {
  try {
    const query = `
      SELECT 
        c.id,
        c.sr_no,
        c.name,
        c.address,
        c.date as customer_date,
        c.kw,
        c.panel_company,
        c.panel_watt,
        c.panel_quantity,
        c.inverter_company,
        c.inverter_watt,
        c.structure_watt,
        c.cost,
        c.signature_path,
        i.date AS bill_date
      FROM customers c
      LEFT JOIN invoices i ON c.sr_no = i.customer_sr_no
      ORDER BY c.sr_no DESC
    `;
    const customers = db.prepare(query).all();
    event.returnValue = { success: true, customers };
  } catch (err) {
    console.error("Error fetching customers:", err);
    event.returnValue = { success: false, customers: [], error: err.message };
  }
});

// ==========================================
// 4. IPC Handler: Delete Customer & Related Data
// ==========================================
ipcMain.on("delete-customer", (event, { id, sr_no, name }) => {
  try {
    const stmt = db.prepare("DELETE FROM customers WHERE id = ?");
    stmt.run(id);

    const safeName = (name || "Unknown").replace(/[/\\?%*:|"<>]/g, "_").trim();
    const folderName = `${sr_no} ${safeName}`;
    const targetDir = path.join(__dirname, "DATA", "files", folderName);

    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    event.returnValue = { success: true };
  } catch (err) {
    console.error("Error deleting customer:", err);
    event.returnValue = { success: false, error: err.message };
  }
});

// ==========================================
// 5. IPC Handler: Update Customer Data
// ==========================================
ipcMain.on("update-customer", (event, customer) => {
  try {
    const stmt = db.prepare(`
      UPDATE customers 
      SET name = @name, address = @address, kw = @kw, cost = @cost
      WHERE id = @id
    `);
    stmt.run(customer);
    event.returnValue = { success: true };
  } catch (err) {
    console.error("Error updating customer:", err);
    event.returnValue = { success: false, error: err.message };
  }
});

// ==========================================
// 6. IPC Handler: Fetch Client Directory Files
// ==========================================
ipcMain.on("get-client-files", (event, { sr_no, name }) => {
  try {
    const safeName = (name || "Unknown").replace(/[/\\?%*:|"<>]/g, "_").trim();
    const folderName = `${sr_no} ${safeName}`;
    const targetDir = path.join(__dirname, "DATA", "files", folderName);

    if (!fs.existsSync(targetDir)) {
      return (event.returnValue = { success: true, files: [], dirPath: "" });
    }

    const fileList = fs.readdirSync(targetDir).map((fileName) => {
      const fullPath = path.join(targetDir, fileName);
      const isSignature = fileName.toLowerCase().includes("signature");
      let base64Image = null;

      // Convert PNG/JPG signature files directly into Base64 Data URI for instant rendering
      if (isSignature && fs.existsSync(fullPath)) {
        try {
          const fileBuffer = fs.readFileSync(fullPath);
          const ext =
            path.extname(fileName).replace(".", "").toLowerCase() || "png";
          base64Image = `data:image/${ext};base64,${fileBuffer.toString("base64")}`;
        } catch (imgErr) {
          console.error("Error reading signature image:", imgErr);
        }
      }

      return {
        name: fileName,
        path: fullPath,
        fileUrl: base64Image,
        isSignature,
        isPDF: fileName.toLowerCase().endsWith(".pdf"),
      };
    });

    event.returnValue = { success: true, files: fileList, dirPath: targetDir };
  } catch (err) {
    console.error("Error fetching client files:", err);
    event.returnValue = { success: false, files: [], error: err.message };
  }
});

// ==========================================
// 7. IPC Handler: Open File in System Default App
// ==========================================
ipcMain.on("open-file", (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.openPath(filePath);
    event.returnValue = { success: true };
  } else {
    event.returnValue = { success: false, error: "File not found" };
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
