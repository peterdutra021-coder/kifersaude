/*
  # Email multi-conta

  Cria as tabelas de contas, threads e mensagens de email para substituir os mocks do painel.
*/

create table if not exists email_accounts (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  email_address text not null unique,
  display_name text not null,
  status text not null default 'connected',
  is_primary boolean default false,
  connected_at timestamptz default now(),
  last_sync_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists email_threads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references email_accounts(id) on delete cascade,
  subject text,
  preview text,
  folder text not null default 'inbox',
  unread boolean not null default true,
  starred boolean not null default false,
  participants jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references email_threads(id) on delete cascade,
  account_id uuid not null references email_accounts(id) on delete cascade,
  direction text not null default 'outbound',
  from_participant jsonb not null,
  to_participants jsonb not null default '[]'::jsonb,
  cc_participants jsonb,
  bcc_participants jsonb,
  subject text,
  body text,
  folder text not null default 'inbox',
  unread boolean not null default true,
  sent_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_email_accounts_provider on email_accounts(provider_id);
create index if not exists idx_email_threads_account on email_threads(account_id);
create index if not exists idx_email_threads_folder on email_threads(folder);
create index if not exists idx_email_threads_updated on email_threads(updated_at desc);
create index if not exists idx_email_messages_thread on email_messages(thread_id);
create index if not exists idx_email_messages_account on email_messages(account_id);
create index if not exists idx_email_messages_sent_at on email_messages(sent_at desc);

alter table email_accounts enable row level security;
alter table email_threads enable row level security;
alter table email_messages enable row level security;

create policy "Usuários autenticados podem gerenciar contas de email"
  on email_accounts for all
  to authenticated
  using (true)
  with check (true);

create policy "Usuários autenticados podem gerenciar threads de email"
  on email_threads for all
  to authenticated
  using (true)
  with check (true);

create policy "Usuários autenticados podem gerenciar mensagens de email"
  on email_messages for all
  to authenticated
  using (true)
  with check (true);