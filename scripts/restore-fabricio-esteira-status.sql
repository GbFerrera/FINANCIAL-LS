-- Restaura colunas da Esteira A (Fabricio): status a partir do checklist + regras PM.
-- Colunas padrão: TODO | IN_PROGRESS | IN_REVIEW | COMPLETED (kanbanColumnId NULL).

WITH fabricio AS (
  SELECT id AS uid FROM users WHERE email ILIKE 'lustosacosta7@gmail.com' LIMIT 1
),
stats AS (
  SELECT t.id,
    COUNT(i.id) AS total,
    COUNT(i.id) FILTER (WHERE i.done) AS done
  FROM tasks t
  CROSS JOIN fabricio f
  LEFT JOIN task_checklist_items i ON i."taskId" = t.id
  WHERE t."assigneeId" = f.uid AND t."isArchived" = false
  GROUP BY t.id
)
UPDATE tasks t SET
  status = CASE
    WHEN s.total > 0 AND s.done >= s.total THEN 'COMPLETED'::"TaskStatus"
    WHEN s.total > 0 AND (s.done::numeric / NULLIF(s.total, 0)) >= 0.55 THEN 'IN_REVIEW'::"TaskStatus"
    WHEN s.total > 0 AND (s.done > 0 OR s.total >= 20) THEN 'IN_PROGRESS'::"TaskStatus"
    WHEN s.total = 0 THEN 'IN_PROGRESS'::"TaskStatus"
    ELSE 'TODO'::"TaskStatus"
  END,
  "kanbanColumnId" = NULL,
  "updatedAt" = NOW()
FROM stats s
WHERE t.id = s.id;
