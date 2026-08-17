CREATE TABLE IF NOT EXISTS app_users (
  mobile varchar(11) PRIMARY KEY CHECK (mobile ~ '^09[0-9]{9}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_key text NOT NULL UNIQUE,
  name varchar(200) NOT NULL,
  normalized_name varchar(200) NOT NULL,
  economic_number varchar(50) NOT NULL DEFAULT '',
  national_id varchar(50) NOT NULL DEFAULT '',
  normalized_national_id varchar(50) NOT NULL DEFAULT '',
  province varchar(100) NOT NULL DEFAULT '',
  city varchar(100) NOT NULL DEFAULT '',
  postal_code varchar(20) NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  phone varchar(50) NOT NULL DEFAULT '',
  created_by_mobile varchar(11) NOT NULL REFERENCES app_users(mobile),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_normalized_name_idx ON customers (normalized_name);
CREATE INDEX IF NOT EXISTS customers_normalized_national_id_idx ON customers (normalized_national_id);

CREATE TABLE IF NOT EXISTS invoices (
  invoice_number bigint GENERATED ALWAYS AS IDENTITY (START WITH 345) PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers(id),
  issuer_mobile varchar(11) NOT NULL REFERENCES app_users(mobile),
  invoice_date varchar(20) NOT NULL,
  payload jsonb NOT NULL,
  shipping_terms text NOT NULL DEFAULT '',
  validity_terms text NOT NULL DEFAULT '',
  subtotal numeric(20,2) NOT NULL DEFAULT 0,
  discount numeric(20,2) NOT NULL DEFAULT 0,
  vat numeric(20,2) NOT NULL DEFAULT 0,
  total numeric(20,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_customer_id_idx ON invoices (customer_id);
CREATE INDEX IF NOT EXISTS invoices_issuer_mobile_idx ON invoices (issuer_mobile);
CREATE INDEX IF NOT EXISTS invoices_created_at_idx ON invoices (created_at DESC);
