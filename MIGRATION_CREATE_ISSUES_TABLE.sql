-- Migration: Create issues table for tracking order and system issues
-- Date: 2026-01-29

create table public.issues (
  id uuid not null default gen_random_uuid (),
  order_id uuid null,
  basket_number integer null,
  description text not null,
  status text null default 'open'::text,
  severity text null default 'low'::text,
  reported_by uuid null,
  resolved_by uuid null,
  resolved_at timestamp without time zone null,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint issues_pkey primary key (id),
  constraint issues_reported_by_fkey foreign KEY (reported_by) references staff (id) on delete set null,
  constraint issues_resolved_by_fkey foreign KEY (resolved_by) references staff (id) on delete set null,
  constraint issues_severity_check check (
    (
      severity = any (
        array[
          'low'::text,
          'medium'::text,
          'high'::text,
          'critical'::text
        ]
      )
    )
  ),
  constraint issues_status_check check (
    (
      status = any (
        array['open'::text, 'resolved'::text, 'cancelled'::text]
      )
    )
  )
) TABLESPACE pg_default;

-- Indexes for performance
create index IF not exists idx_issues_order_id on public.issues using btree (order_id) TABLESPACE pg_default;

create index IF not exists idx_issues_status on public.issues using btree (status) TABLESPACE pg_default;

create index IF not exists idx_issues_severity on public.issues using btree (severity) TABLESPACE pg_default;

-- Enable RLS
alter table public.issues enable row level security;

-- RLS Policies
create policy "Enable read access for authenticated users" on public.issues
  for select
  using (auth.role() = 'authenticated');

create policy "Enable insert for authenticated users" on public.issues
  for insert
  with check (auth.role() = 'authenticated');

create policy "Enable update for authenticated users" on public.issues
  for update
  using (auth.role() = 'authenticated');

create policy "Enable delete for authenticated users" on public.issues
  for delete
  using (auth.role() = 'authenticated');

-- Add table comment
comment on table public.issues is 'Issue tracking table for order problems and system issues reported by staff';
