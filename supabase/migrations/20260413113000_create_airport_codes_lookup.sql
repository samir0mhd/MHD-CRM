create table if not exists public.airport_codes (
  code text primary key,
  name text not null,
  city text not null,
  country text not null,
  created_at timestamptz not null default now(),
  constraint airport_codes_code_format check (code ~ '^[A-Z]{3}$')
);

create index if not exists airport_codes_city_idx on public.airport_codes (city);
