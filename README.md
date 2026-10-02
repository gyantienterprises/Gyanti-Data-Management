# Gyanti Data Management System

A desktop application for Gyanti Enterprises to manage customer data, invoices, agreements, and quotation records with automated document generation. Built using **Electron**, **React**, **Vite**, **Tailwind CSS**, **SQLite (`better-sqlite3`)**, and **Python**.

---

## 📋 Prerequisites

Before setting up and running the application, make sure you have the following installed on your system:

1. **Node.js**: Version `18.x` or higher (Version `20.x` recommended)  
   [Download Node.js](https://nodejs.org/)
2. **Python**: Version `3.8` or higher  
   [Download Python](https://www.python.org/) (Ensure **"Add Python to PATH"** is checked during installation)
3. **Microsoft Word** or **LibreOffice** *(Optional, recommended for DOCX to PDF conversion)*

---

## 🚀 Step-by-Step Installation & Setup

### 1. Clone or Download the Repository
Open your terminal or command prompt, navigate to your desired directory, and clone the repository:
```bash
git clone https://github.com/gyantienterprises/Gyanti-Data-Management.git
cd Gyanti-Data-Management
```

### 2. Install Node.js Dependencies
Install all required Node.js packages (Electron, React, Vite, Tailwind CSS, SQLite, etc.):
```bash
npm install
```

### 3. Install Python Dependencies
The application relies on Python scripts to format and generate Word/Excel documents and PDFs. Install the required Python libraries by running:
```bash
pip install openpyxl docxtpl python-docx num2words pywin32
```

---

## 🛠️ Running the Project

### Start Desktop Application (Electron + React HMR)
To start the Electron application along with Vite live reloading in development mode:
```bash
npm run electron:dev
```

### Start Web UI Only (Browser Mode)
If you want to view or test the frontend UI in a web browser without launching Electron:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📜 Available Scripts

In the project directory, you can run:

| Command | Description |
| :--- | :--- |
| `npm run electron:dev` | Launches Vite dev server and starts the Electron app with live reload |
| `npm run dev` | Runs the Vite development server for web UI testing |
| `npm run build` | Builds the React frontend application for production |
| `npm run preview` | Previews the production build locally |
| `npm run lint` | Runs `oxlint` to check for code quality and syntax errors |

---

## 📁 Project Structure

```text
Gyanti-Data-Management/
├── DATA/                  # Stores SQLite database (gyanti_database.db) and generated customer documents
├── template/              # Document templates (.docx / .xlsx) for invoices, quotations, and agreements
├── src/                   # React frontend application code
│   ├── components/        # UI components (Customer forms, Invoices, Tables, etc.)
│   ├── App.jsx            # Main React application component
│   └── main.jsx           # React entry point
├── main.js                # Electron main process (IPC handlers, SQLite connection, Python runner)
├── generate_doc.py        # Python script for generating DOCX, XLSX, and PDF files
├── vite.config.js         # Vite configuration file
├── tailwind.config.js     # Tailwind CSS configuration
└── package.json           # Node.js dependencies and script definitions
```

---

## ❓ Troubleshooting

- **SQLite native module error (`better-sqlite3`)**:  
  If you encounter an error related to `better-sqlite3` compiled against a different Node/Electron version, rebuild the native module for Electron by running:
  ```bash
  npx electron-rebuild
  ```

- **Python script error**:  
  Ensure `python` (or `python3` on macOS/Linux) is accessible in your system's `PATH`. You can verify by running:
  ```bash
  python --version
  ```
