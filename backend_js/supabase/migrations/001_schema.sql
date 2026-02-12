-- Schema inicial para gestão de colaboradores, tarefas e horas trabalhadas.
-- Execute no SQL Editor do Supabase ou via Supabase CLI.

-- Colaboradores (com hierarquia via gestor_id)
create table if not exists public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  cargo text not null,
  custo_hora numeric(10, 2),
  gestor_id uuid references public.colaboradores(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_colaboradores_gestor on public.colaboradores(gestor_id);
create index if not exists idx_colaboradores_ativo on public.colaboradores(ativo);

-- Tarefas
create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  colaborador_id uuid references public.colaboradores(id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  data_limite timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tarefas_colaborador on public.tarefas(colaborador_id);
create index if not exists idx_tarefas_status on public.tarefas(status);

-- Horas trabalhadas
create table if not exists public.horas_trabalhadas (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  tarefa_id uuid references public.tarefas(id) on delete set null,
  data date not null,
  horas numeric(5, 2) not null check (horas > 0 and horas <= 24),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_horas_colaborador on public.horas_trabalhadas(colaborador_id);
create index if not exists idx_horas_data on public.horas_trabalhadas(data);
create index if not exists idx_horas_tarefa on public.horas_trabalhadas(tarefa_id);

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists colaboradores_updated_at on public.colaboradores;
create trigger colaboradores_updated_at
  before update on public.colaboradores
  for each row execute function public.set_updated_at();

drop trigger if exists tarefas_updated_at on public.tarefas;
create trigger tarefas_updated_at
  before update on public.tarefas
  for each row execute function public.set_updated_at();

drop trigger if exists horas_trabalhadas_updated_at on public.horas_trabalhadas;
create trigger horas_trabalhadas_updated_at
  before update on public.horas_trabalhadas
  for each row execute function public.set_updated_at();

-- Habilitar Realtime (opcional)
alter publication supabase_realtime add table public.horas_trabalhadas;
alter publication supabase_realtime add table public.colaboradores;
alter publication supabase_realtime add table public.tarefas;

-- Storage: criar bucket "documentos" pelo dashboard do Supabase ou:
-- insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false);
-- Políticas RLS podem ser adicionadas conforme necessidade.
