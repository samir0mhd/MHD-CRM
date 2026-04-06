alter table suppliers add column if not exists account_code text;
alter table suppliers add column if not exists company_reg text;
alter table suppliers add column if not exists description text;
alter table suppliers add column if not exists street_1 text;
alter table suppliers add column if not exists street_2 text;
alter table suppliers add column if not exists town text;
alter table suppliers add column if not exists country text;
alter table suppliers add column if not exists post_code text;
alter table suppliers add column if not exists fax text;

alter table suppliers add column if not exists account_contact_name text;
alter table suppliers add column if not exists account_contact_email text;
alter table suppliers add column if not exists account_contact_phone text;
alter table suppliers add column if not exists account_contact_fax text;

alter table suppliers add column if not exists sales_contact_name text;
alter table suppliers add column if not exists sales_contact_email text;
alter table suppliers add column if not exists sales_contact_phone text;
alter table suppliers add column if not exists sales_contact_fax text;

alter table suppliers add column if not exists bank_name text;
alter table suppliers add column if not exists bank_account_name text;
alter table suppliers add column if not exists bank_street_1 text;
alter table suppliers add column if not exists bank_street_2 text;
alter table suppliers add column if not exists bank_town text;
alter table suppliers add column if not exists bank_telephone text;
alter table suppliers add column if not exists bank_post_code text;
alter table suppliers add column if not exists bank_account_number text;
alter table suppliers add column if not exists bank_sort_code text;
alter table suppliers add column if not exists bank_iban text;
alter table suppliers add column if not exists bank_swift_code text;

alter table suppliers add column if not exists vat_number text;
alter table suppliers add column if not exists vat_registered boolean default false;
alter table suppliers add column if not exists product_types text;
alter table suppliers add column if not exists trading_terms_text text;
alter table suppliers add column if not exists commission_rate numeric(10,2) default 0;
alter table suppliers add column if not exists payment_due_days integer default 30;
alter table suppliers add column if not exists account_open_date date;
alter table suppliers add column if not exists payment_currency text;
alter table suppliers add column if not exists abta text;
alter table suppliers add column if not exists atol text;
alter table suppliers add column if not exists iata text;
alter table suppliers add column if not exists remarks text;
