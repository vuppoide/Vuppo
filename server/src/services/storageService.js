const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR 
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');

const DB_FILE = path.join(DATA_DIR, 'db.json');

const INITIAL_STATE = {
  accounts: [],
  reports: []
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readData() {
  ensureDir();
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeData(INITIAL_STATE);
      return { ...INITIAL_STATE };
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return { ...INITIAL_STATE, ...JSON.parse(raw) };
  } catch (err) {
    console.error('[DB] Erro ao ler banco de dados local:', err.message);
    return { ...INITIAL_STATE };
  }
}

function writeData(data) {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = {
  readData,
  writeData,
  DATA_DIR,
  DB_FILE
};
