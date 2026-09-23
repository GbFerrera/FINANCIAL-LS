-- Esteira A → CEO: tasks sem assignee (backlog gestão) + Gabriel; Fabricio permanece na entrega.
-- Sem links secundários na Esteira (evita card duplicado na pipeline de entrega).

BEGIN;

UPDATE tasks t SET
  "projectId" = 'cmu212nxh0006n126739nm4i8',
  "kanbanColumnId" = 'col-3940d6b9',
  "sprintId" = NULL,
  "updatedAt" = NOW()
WHERE t."isArchived" = false
  AND t."projectId" IN (
    'cmnhenfhr002tp4202x1aw096',
    'cmr984gs9000jpj263e3g0igv',
    'cmltidb5000awp81xkssz2a26',
    'cmqkwp2gr008eqs2pv9m6ie5f',
    'cms643jgp000qob2bt1l5roc7'
  )
  AND (t."assigneeId" IS NULL OR t."assigneeId" = (
    SELECT id FROM users WHERE email ILIKE 'business.gabrielferreira@gmail.com' LIMIT 1
  ))
  AND t."assigneeId" IS DISTINCT FROM (
    SELECT id FROM users WHERE email ILIKE 'lustosacosta7@gmail.com' LIMIT 1
  );

DELETE FROM task_projects tp
WHERE tp."taskId" IN (
  SELECT id FROM tasks
  WHERE "projectId" = 'cmu212nxh0006n126739nm4i8' AND "isArchived" = false
    AND ("assigneeId" IS NULL OR "assigneeId" = (
      SELECT id FROM users WHERE email ILIKE 'business.gabrielferreira@gmail.com' LIMIT 1
    ))
);

INSERT INTO task_projects (id, "taskId", "projectId", "isPrimary", "createdAt")
SELECT substr(md5('ceo-' || t.id), 1, 25), t.id, 'cmu212nxh0006n126739nm4i8', true, NOW()
FROM tasks t
WHERE t."projectId" = 'cmu212nxh0006n126739nm4i8' AND t."isArchived" = false
ON CONFLICT ("taskId", "projectId") DO UPDATE SET "isPrimary" = true;

COMMIT;
