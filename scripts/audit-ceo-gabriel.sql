-- Auditoria: tasks Gabriel + CEO workspace
\set ceo 'cmu212nxh0006n126739nm4i8'

SELECT id, name, email FROM users WHERE email ILIKE '%gabrielferreira%' OR name ILIKE '%Gabriel%';

SELECT p.name AS project, t.status, LEFT(t.title, 55) AS title, t."kanbanColumnId", t."isArchived"
FROM tasks t
JOIN projects p ON p.id = t."projectId"
JOIN users u ON u.id = t."assigneeId"
WHERE u.email ILIKE 'business.gabrielferreira@gmail.com'
ORDER BY t."isArchived", p.name, t.title;

SELECT 'linked_to_ceo_not_primary' AS kind, p.name AS primary_project, LEFT(t.title, 50) AS title, u.name AS assignee
FROM tasks t
JOIN task_projects tp ON tp."taskId" = t.id AND tp."projectId" = :'ceo' AND NOT tp."isPrimary"
JOIN projects p ON p.id = t."projectId"
LEFT JOIN users u ON u.id = t."assigneeId"
WHERE t."isArchived" = false;

SELECT 'on_ceo_project' AS kind, COUNT(*) FROM tasks WHERE "projectId" = :'ceo' AND "isArchived" = false;

SELECT 'gabriel_on_ceo' AS kind, COUNT(*) FROM tasks t
JOIN users u ON u.id = t."assigneeId"
WHERE t."projectId" = :'ceo' AND t."isArchived" = false AND u.email ILIKE 'business.gabrielferreira@gmail.com';

SELECT 'gabriel_archived' AS kind, COUNT(*) FROM tasks t
JOIN users u ON u.id = t."assigneeId"
WHERE u.email ILIKE 'business.gabrielferreira@gmail.com' AND t."isArchived" = true;

-- Possíveis CEO antigas: Gabriel assignee, não CEO project, título gestão
SELECT p.name, LEFT(t.title, 50) AS title, t.status
FROM tasks t
JOIN projects p ON p.id = t."projectId"
JOIN users u ON u.id = t."assigneeId"
WHERE u.email ILIKE 'business.gabrielferreira@gmail.com'
  AND t."projectId" <> :'ceo'
  AND t."isArchived" = false;
