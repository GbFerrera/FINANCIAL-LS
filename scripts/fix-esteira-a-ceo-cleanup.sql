-- Corrige bagunça pós-migração CEO/Esteira A (2026-09-22):
-- - Devolve tasks sem assignee (não-Gabriel) do CEO para projeto primário na Esteira A
-- - Desmarca COMPLETED indevido em backlog sem assignee
-- - Gabriel: gestão no CEO em TODO (A Fazer); remove poluição "concluída" na Esteira via links

BEGIN;

CREATE TEMP TABLE off_ceo AS
SELECT
  t.id AS task_id,
  COALESCE(
    (SELECT tp."projectId" FROM task_projects tp
     WHERE tp."taskId" = t.id AND tp."isPrimary" = false
     LIMIT 1),
    CASE t.id
      WHEN 'cmub5u6jp00smtf2i43i1u3d5' THEN 'cmr984gs9000jpj263e3g0igv'
      WHEN 'cmu2so3yk0009tf2bxktuj2eg' THEN 'cmltidb5000awp81xkssz2a26'
      WHEN 'cmu2mrpl80056n126l1617ngk' THEN 'cmr984gs9000jpj263e3g0igv'
      WHEN 'cmu2n4uhm005wn1261bndt6qr' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmu2n5lb40061n126iyah4jxc' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmu3ebdq2003stf2b165cyn7o' THEN 'cmqkwp2gr008eqs2pv9m6ie5f'
      WHEN 'cmu2linfs003vn1265yv4l7g4' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmttb2k0y000std2nolydmany' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmu2m4aas0040n126zp12bb43' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmu2m52yz0045n12616tla7fx' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmu2m5soj004an1265utz8v2b' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmu2m9b7b004ln1262af6t617' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmu2m6x2n004fn126i5d6fuyj' THEN 'cmr984gs9000jpj263e3g0igv'
      WHEN 'cmu2mat4e004qn126b1910qa4' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmu2mfc530051n126a7u0jbvk' THEN 'cmr984gs9000jpj263e3g0igv'
      WHEN 'cmsrl99lu006inv2ctdhil9t5' THEN 'cmltidb5000awp81xkssz2a26'
      WHEN 'cmu2mwsvk005gn126vy30pegn' THEN 'cmltidb5000awp81xkssz2a26'
      WHEN 'cmu2mx84p005ln126846r44y3' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmu2msjzp005bn126hilb22k2' THEN 'cmltidb5000awp81xkssz2a26'
      WHEN 'cmu3g2icb003xtf2b0hx3tphi' THEN 'cmnhenfhr002tp4202x1aw096'
      ELSE NULL
    END
  ) AS delivery_project_id,
  t.status::text AS st
FROM tasks t
JOIN users g ON g.email ILIKE 'business.gabrielferreira@gmail.com'
WHERE t."projectId" = 'cmu212nxh0006n126739nm4i8'
  AND t."isArchived" = false
  AND (t."assigneeId" IS DISTINCT FROM g.id);

UPDATE tasks t SET
  "projectId" = r.delivery_project_id,
  "kanbanColumnId" = NULL,
  status = CASE
    WHEN r.st = 'COMPLETED' AND t."assigneeId" IS NULL THEN 'TODO'::"TaskStatus"
    ELSE t.status
  END,
  "completedAt" = CASE
    WHEN r.st = 'COMPLETED' AND t."assigneeId" IS NULL THEN NULL
    ELSE t."completedAt"
  END,
  "updatedAt" = NOW()
FROM off_ceo r
WHERE t.id = r.task_id
  AND r.delivery_project_id IS NOT NULL;

DELETE FROM task_projects tp
USING off_ceo r
WHERE tp."taskId" = r.task_id
  AND r.delivery_project_id IS NOT NULL;

INSERT INTO task_projects (id, "taskId", "projectId", "isPrimary", "createdAt")
SELECT
  substr(md5('d' || r.task_id || r.delivery_project_id), 1, 25),
  r.task_id,
  r.delivery_project_id,
  true,
  NOW()
FROM off_ceo r
WHERE r.delivery_project_id IS NOT NULL
ON CONFLICT ("taskId", "projectId") DO UPDATE SET "isPrimary" = true;

UPDATE tasks SET
  "projectId" = 'cmu212nxh0006n126739nm4i8',
  status = 'TODO'::"TaskStatus",
  "kanbanColumnId" = 'col-3940d6b9',
  "completedAt" = NULL,
  "updatedAt" = NOW()
WHERE id IN (
  'cmu2n44sb005rn1269yvoasam',
  'cmtxjaaxj009htd2nf3nhqovg'
);

DELETE FROM task_projects WHERE "taskId" IN ('cmu2n44sb005rn1269yvoasam', 'cmtxjaaxj009htd2nf3nhqovg');

INSERT INTO task_projects (id, "taskId", "projectId", "isPrimary", "createdAt")
VALUES
  (substr(md5('g' || 'cmu2n44sb005rn1269yvoasam'), 1, 25), 'cmu2n44sb005rn1269yvoasam', 'cmu212nxh0006n126739nm4i8', true, NOW()),
  (substr(md5('g' || 'cmtxjaaxj009htd2nf3nhqovg'), 1, 25), 'cmtxjaaxj009htd2nf3nhqovg', 'cmu212nxh0006n126739nm4i8', true, NOW())
ON CONFLICT ("taskId", "projectId") DO UPDATE SET "isPrimary" = true;

INSERT INTO task_projects (id, "taskId", "projectId", "isPrimary", "createdAt")
VALUES (
  substr(md5('ge' || 'cmu2n44sb005rn1269yvoasam'), 1, 25),
  'cmu2n44sb005rn1269yvoasam',
  'cmltidb5000awp81xkssz2a26',
  false,
  NOW()
)
ON CONFLICT ("taskId", "projectId") DO NOTHING;

COMMIT;
