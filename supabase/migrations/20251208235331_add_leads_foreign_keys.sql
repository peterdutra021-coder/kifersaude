/*
  # Normalize lead categorical fields with foreign keys

  ## Purpose
  - Ensure lead origin, contract type, status, and responsible values reference
    their respective configuration tables instead of allowing arbitrary text.
  - Automatically seed missing configuration records based on existing lead data
    to avoid constraint violations during the migration.

  ## Changes
  1. Seeds missing entries in configuration tables from existing lead data
  2. Adds foreign key constraints to enforce referential integrity
*/

-- Seed missing origins referenced by leads
INSERT INTO lead_origens (nome)
SELECT DISTINCT origem
FROM leads
WHERE origem IS NOT NULL
  AND origem <> ''
  AND NOT EXISTS (
    SELECT 1 FROM lead_origens o WHERE o.nome = leads.origem
  );

-- Seed missing contract types referenced by leads
INSERT INTO lead_tipos_contratacao (label, value, ativo)
SELECT DISTINCT tipo_contratacao AS label, tipo_contratacao AS value, true
FROM leads
WHERE tipo_contratacao IS NOT NULL
  AND tipo_contratacao <> ''
  AND NOT EXISTS (
    SELECT 1 FROM lead_tipos_contratacao t WHERE t.value = leads.tipo_contratacao
  );

-- Seed missing lead statuses referenced by leads
WITH max_ordem AS (
  SELECT COALESCE(MAX(ordem), 0) AS ordem_base FROM lead_status_config
), distinct_status AS (
  SELECT DISTINCT status FROM leads WHERE status IS NOT NULL AND status <> ''
), missing_status AS (
  SELECT ds.status, mo.ordem_base, ROW_NUMBER() OVER (ORDER BY ds.status) - 1 AS rn
  FROM distinct_status ds
  CROSS JOIN max_ordem mo
  WHERE NOT EXISTS (
    SELECT 1 FROM lead_status_config lsc WHERE lsc.nome = ds.status
  )
)
INSERT INTO lead_status_config (nome, cor, ordem, ativo, padrao)
SELECT status,
       '#6B7280' AS cor,
       ordem_base + rn + 1 AS ordem,
       true AS ativo,
       false AS padrao
FROM missing_status;

-- Seed missing responsibles referenced by leads
INSERT INTO lead_responsaveis (label, value, ativo)
SELECT DISTINCT responsavel AS label, responsavel AS value, true
FROM leads
WHERE responsavel IS NOT NULL
  AND responsavel <> ''
  AND NOT EXISTS (
    SELECT 1 FROM lead_responsaveis r WHERE r.value = leads.responsavel
  );

-- Add foreign key constraints to enforce valid references
DO $$
BEGIN
  -- Add origem foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_leads_origem' AND table_name = 'leads'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT fk_leads_origem FOREIGN KEY (origem) REFERENCES lead_origens(nome);
  END IF;

  -- Add tipo_contratacao foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_leads_tipo_contratacao' AND table_name = 'leads'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT fk_leads_tipo_contratacao FOREIGN KEY (tipo_contratacao) REFERENCES lead_tipos_contratacao(value);
  END IF;

  -- Add status foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_leads_status' AND table_name = 'leads'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT fk_leads_status FOREIGN KEY (status) REFERENCES lead_status_config(nome);
  END IF;

  -- Add responsavel foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_leads_responsavel' AND table_name = 'leads'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT fk_leads_responsavel FOREIGN KEY (responsavel) REFERENCES lead_responsaveis(value);
  END IF;
END $$;
