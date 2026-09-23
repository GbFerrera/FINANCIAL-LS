-- Redistribui cards do quadro CEO (colunas custom + status/checklist).
-- CEO: kanbanColumnId deve bater com workspaces.settings.kanbanColumns[].id

WITH ceo_tasks AS (
  SELECT t.id, t.title,
    COUNT(i.id) AS total,
    COUNT(i.id) FILTER (WHERE i.done) AS done
  FROM tasks t
  LEFT JOIN task_checklist_items i ON i."taskId" = t.id
  WHERE t."projectId" = 'cmu212nxh0006n126739nm4i8' AND t."isArchived" = false
  GROUP BY t.id, t.title
)
UPDATE tasks t SET
  "kanbanColumnId" = CASE
    WHEN c.total > 0 AND c.done >= c.total THEN 'col-done'
    WHEN t.title ILIKE '%reunião%' OR t.title ILIKE '%reuniao%' THEN 'col-88013088'
    WHEN t.title ILIKE '%atualiza%' OR t.title ILIKE '%pontuais%' OR t.title ILIKE '%subir nova versão%' THEN 'col-38707647'
    WHEN t.title ILIKE '%dona cheirosa%' OR t.title ILIKE '%aguardando%' THEN 'col-70b1044f'
    WHEN t.title ILIKE '%orçamento%' OR t.title ILIKE '%orcamento%' THEN 'col-a384e969'
    WHEN t.title ILIKE '%IA para%' OR t.title ILIKE '%melhoria do visual%' OR t.title ILIKE '%estudo %' THEN 'col-0ffc1cdc'
    WHEN c.total > 0 AND c.done > 0 THEN 'col-doing'
    WHEN c.total >= 10 THEN 'col-doing'
    WHEN t.title ILIKE '%restaurante%' OR t.title ILIKE '%simão%' OR t.title ILIKE '%simao%' OR t.title ILIKE '%recriando%' OR t.title ILIKE '%grupo de empresas%' THEN 'col-doing'
    ELSE 'col-3940d6b9'
  END,
  status = CASE
    WHEN c.total > 0 AND c.done >= c.total THEN 'COMPLETED'::"TaskStatus"
    WHEN t.title ILIKE '%reunião%' OR t.title ILIKE '%reuniao%' THEN 'TODO'::"TaskStatus"
    WHEN t.title ILIKE '%atualiza%' OR t.title ILIKE '%pontuais%' OR t.title ILIKE '%subir nova versão%' THEN 'TODO'::"TaskStatus"
    WHEN t.title ILIKE '%dona cheirosa%' THEN 'TODO'::"TaskStatus"
    WHEN t.title ILIKE '%orçamento%' THEN 'TODO'::"TaskStatus"
    WHEN t.title ILIKE '%IA para%' OR t.title ILIKE '%melhoria do visual%' OR t.title ILIKE '%estudo %' THEN 'TODO'::"TaskStatus"
    WHEN c.total > 0 AND c.done > 0 THEN 'IN_PROGRESS'::"TaskStatus"
    WHEN c.total >= 10 THEN 'IN_PROGRESS'::"TaskStatus"
    WHEN t.title ILIKE '%restaurante%' OR t.title ILIKE '%simão%' OR t.title ILIKE '%recriando%' OR t.title ILIKE '%grupo de empresas%' THEN 'IN_PROGRESS'::"TaskStatus"
    ELSE 'TODO'::"TaskStatus"
  END,
  "completedAt" = CASE
    WHEN c.total > 0 AND c.done >= c.total THEN COALESCE(t."completedAt", NOW())
    ELSE NULL
  END,
  "updatedAt" = NOW()
FROM ceo_tasks c
WHERE t.id = c.id;
