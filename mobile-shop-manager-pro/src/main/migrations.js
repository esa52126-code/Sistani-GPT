'use strict';
/**
 * Ordered schema migrations. Never edit a released migration; append a new one.
 * PRAGMA user_version stores how many have been applied.
 */
module.exports = [
  function v1(db) {
    db.exec(`
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      phone TEXT DEFAULT '', email TEXT DEFAULT '', company TEXT DEFAULT '',
      address TEXT DEFAULT '', notes TEXT DEFAULT '',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_suppliers_name ON suppliers(name);

    CREATE TABLE customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      phone_code TEXT DEFAULT '', phone TEXT DEFAULT '', email TEXT DEFAULT '',
      address TEXT DEFAULT '', country TEXT DEFAULT '', notes TEXT DEFAULT '',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_customers_name ON customers(name);
    CREATE INDEX idx_customers_phone ON customers(phone);

    CREATE TABLE mobiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_id TEXT NOT NULL UNIQUE,
      brand TEXT NOT NULL CHECK (length(trim(brand)) > 0),
      model TEXT NOT NULL CHECK (length(trim(model)) > 0),
      ram TEXT DEFAULT '', storage TEXT DEFAULT '', color TEXT DEFAULT '',
      imei1 TEXT NOT NULL CHECK (length(trim(imei1)) > 0),
      imei2 TEXT DEFAULT '',
      purchase_price REAL NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
      selling_price REAL NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      purchase_date TEXT, warranty TEXT DEFAULT '', notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock','sold','exchange','returned')),
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_mobiles_imei1 ON mobiles(imei1);
    CREATE UNIQUE INDEX idx_mobiles_imei2 ON mobiles(imei2) WHERE imei2 <> '';
    CREATE INDEX idx_mobiles_status ON mobiles(status);
    CREATE INDEX idx_mobiles_brand_model ON mobiles(brand, model);

    CREATE TABLE accessories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      category TEXT NOT NULL DEFAULT 'other',
      sku TEXT NOT NULL UNIQUE,
      purchase_price REAL NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
      selling_price REAL NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
      quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      notes TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_accessories_name ON accessories(name);
    CREATE INDEX idx_accessories_category ON accessories(category);

    CREATE TABLE exchanges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_id TEXT NOT NULL UNIQUE,
      brand TEXT NOT NULL CHECK (length(trim(brand)) > 0),
      model TEXT NOT NULL CHECK (length(trim(model)) > 0),
      imei TEXT DEFAULT '',
      condition TEXT DEFAULT 'good',
      estimated_value REAL NOT NULL DEFAULT 0 CHECK (estimated_value >= 0),
      acquisition_value REAL NOT NULL DEFAULT 0 CHECK (acquisition_value >= 0),
      notes TEXT DEFAULT '',
      date_received TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','sold','returned')),
      source_sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_exchanges_status ON exchanges(status);
    CREATE INDEX idx_exchanges_imei ON exchanges(imei);

    CREATE TABLE sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL UNIQUE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
      sale_date TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0 CHECK (discount >= 0),
      tax_label TEXT DEFAULT '', tax_rate REAL NOT NULL DEFAULT 0,
      tax_mode TEXT NOT NULL DEFAULT 'none' CHECK (tax_mode IN ('none','exclusive','inclusive','exempt')),
      tax_amount REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      profit REAL NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      currency_code TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','voided')),
      void_reason TEXT, voided_at TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX idx_sales_date ON sales(sale_date);
    CREATE INDEX idx_sales_customer ON sales(customer_id);
    CREATE INDEX idx_sales_status ON sales(status);

    CREATE TABLE sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL CHECK (item_type IN ('mobile','accessory','used')),
      mobile_id INTEGER REFERENCES mobiles(id) ON DELETE RESTRICT,
      accessory_id INTEGER REFERENCES accessories(id) ON DELETE RESTRICT,
      exchange_id INTEGER REFERENCES exchanges(id) ON DELETE RESTRICT,
      description TEXT NOT NULL,
      brand TEXT DEFAULT '', imei TEXT DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      unit_price REAL NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
      unit_cost REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0,
      discount_alloc REAL NOT NULL DEFAULT 0,
      tax_alloc REAL NOT NULL DEFAULT 0,
      profit REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX idx_sale_items_mobile ON sale_items(mobile_id);
    CREATE INDEX idx_sale_items_accessory ON sale_items(accessory_id);
    CREATE INDEX idx_sale_items_exchange ON sale_items(exchange_id);

    CREATE TABLE sale_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
      amount REAL NOT NULL CHECK (amount > 0),
      method TEXT NOT NULL DEFAULT 'cash',
      payment_date TEXT NOT NULL,
      receipt_no TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX idx_sale_payments_sale ON sale_payments(sale_id);
    CREATE INDEX idx_sale_payments_date ON sale_payments(payment_date);

    CREATE TABLE customer_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
      entry_date TEXT NOT NULL,
      entry_type TEXT NOT NULL CHECK (entry_type IN ('sale','payment','void','adjustment')),
      sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
      description TEXT DEFAULT '',
      debit REAL NOT NULL DEFAULT 0 CHECK (debit >= 0),
      credit REAL NOT NULL DEFAULT 0 CHECK (credit >= 0),
      method TEXT DEFAULT '',
      receipt_no TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX idx_customer_ledger_customer ON customer_ledger(customer_id, entry_date);

    CREATE TABLE supplier_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      entry_date TEXT NOT NULL,
      entry_type TEXT NOT NULL CHECK (entry_type IN ('purchase','payment','adjustment')),
      ref_type TEXT DEFAULT '', ref_id INTEGER,
      description TEXT DEFAULT '',
      debit REAL NOT NULL DEFAULT 0 CHECK (debit >= 0),
      credit REAL NOT NULL DEFAULT 0 CHECK (credit >= 0),
      method TEXT DEFAULT '',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX idx_supplier_ledger_supplier ON supplier_ledger(supplier_id, entry_date);
    CREATE INDEX idx_supplier_ledger_ref ON supplier_ledger(ref_type, ref_id);

    CREATE TABLE stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL CHECK (item_type IN ('mobile','accessory','used')),
      item_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      balance_after INTEGER,
      unit_cost REAL DEFAULT 0,
      ref_type TEXT DEFAULT '', ref_id INTEGER,
      note TEXT DEFAULT '',
      movement_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX idx_stock_movements_item ON stock_movements(item_type, item_id);

    CREATE TABLE expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL DEFAULT 'other',
      amount REAL NOT NULL CHECK (amount > 0),
      expense_date TEXT NOT NULL,
      description TEXT DEFAULT '',
      payment_method TEXT DEFAULT 'cash',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_expenses_date ON expenses(expense_date);

    CREATE TABLE backup_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      backup_type TEXT NOT NULL CHECK (backup_type IN ('manual','auto','safety')),
      size_bytes INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
    `);
  },
];
