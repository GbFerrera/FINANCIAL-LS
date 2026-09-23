-- Volta ao CEO o backlog sem assignee (25) que estava no quadro antes; Fabricio permanece na entrega.
BEGIN;

CREATE TEMP TABLE ceo_backlog AS
SELECT t.id AS task_id, t."projectId" AS delivery_project_id, t.status::text AS st
FROM tasks t
JOIN workspace_projects wp ON wp."projectId" = t."projectId"
JOIN workspaces w ON w.id = wp."workspaceId" AND w.slug = 'esteira-a'
WHERE t."isArchived" = false
  AND t."assigneeId" IS NULL;

UPDATE tasks t SET
  "projectId" = 'cmu212nxh0006n126739nm4i8',
  "kanbanColumnId" = CASE
    WHEN r.st = 'COMPLETED' THEN 'col-done'
    WHEN r.st = 'IN_PROGRESS' THEN 'col-doing'
    WHEN r.st = 'IN_REVIEW' THEN 'col-doing'
    ELSE 'col-3940d6b9'
  END,
  "updatedAt" = NOW()
FROM ceo_backlog r
WHERE t.id = r.task_id;

DELETE FROM task_projects tp
USING ceo_backlog r
WHERE tp."taskId" = r.task_id;

INSERT INTO task_projects (id, "taskId", "projectId", "isPrimary", "createdAt")
SELECT substr(md5('c' || r.task_id), 1, 25), r.task_id, 'cmu212nxh0006n126739nm4i8', true, NOW()
FROM ceo_backlog r;

INSERT INTO task_projects (id, "taskId", "projectId", "isPrimary", "createdAt")
SELECT substr(md5('d' || r.task_id || r.delivery_project_id), 1, 25), r.task_id, r.delivery_project_id, false, NOW()
FROM ceo_backlog r
WHERE r.delivery_project_id <> 'cmu212nxh0006n126739nm4i8'
ON CONFLICT ("taskId", "projectId") DO NOTHING;

COMMIT;
