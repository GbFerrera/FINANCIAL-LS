-- Volta tasks ao quadro CEO e mantém vínculo com projeto de entrega (Esteira A).
BEGIN;

CREATE TEMP TABLE ceo_restore AS
SELECT t.id AS task_id, t."projectId" AS delivery_project_id, t.status
FROM tasks t
WHERE t."isArchived" = false
  AND t.id IN (
    'cmub5u6jp00smtf2i43i1u3d5','cmr97wcko000bpj26lwxtsfsq','cmu2so3yk0009tf2bxktuj2eg','cmtw085mx005xtd2nusr49ndy',
    'cms4q3wio0005qd2ad1w1eosg','cmtw1x4rn0061td2nnu4quvjk','cmrj9lq78000qnu2arq3o6sxe','cmu2mrpl80056n126l1617ngk',
    'cmu3cbfmx002rtf2bmagnqm5n','cmtw879dk006ltd2ng4lkrsmh','cmu2n4uhm005wn1261bndt6qr','cmu2n5lb40061n126iyah4jxc',
    'cmtxj7vyf009ftd2ntaqmg0yb','cmt97sjlb00xwnv2cxxy7hlm8','cmu3dby5i0033tf2b534lx6lz','cmqkwqmzt008iqs2pfv9n2u7n',
    'cmu3ebdq2003stf2b165cyn7o','cmu3g2icb003xtf2b0hx3tphi','cmqkwgljx008aqs2p5u2fv893','cmu1n0xdv00ajkd2b9yxiz4n6',
    'cmu2linfs003vn1265yv4l7g4','cmttb2k0y000std2nolydmany','cmu3ao90s002ktf2b7k0r4atl','cmu2m4aas0040n126zp12bb43',
    'cmttbhql4000wtd2n47ezbmp9','cmu2m52yz0045n12616tla7fx','cmttbtqx2000ytd2nzygf25w8','cmtt0kbvo000jmz2dmikfiicn',
    'cmu2m5soj004an1265utz8v2b','cmu2m9b7b004ln1262af6t617','cmu2m6x2n004fn126i5d6fuyj','cmu2mat4e004qn126b1910qa4',
    'cmu2mfc530051n126a7u0jbvk','cmsrl99lu006inv2ctdhil9t5','cmrzdknf10003nz2bdq3ojfl4','cmu2mwsvk005gn126vy30pegn',
    'cmu2mx84p005ln126846r44y3','cmu2msjzp005bn126hilb22k2','cmu63menz001vtf2ieud9tlt5','cmsdm18cr001mnv2cv6w15dq5'
  )
  AND t."projectId" <> 'cmu212nxh0006n126739nm4i8';

UPDATE tasks t SET
  "projectId" = 'cmu212nxh0006n126739nm4i8',
  "kanbanColumnId" = CASE
    WHEN t.status::text = 'COMPLETED' THEN 'col-done'
    WHEN t.status::text = 'IN_PROGRESS' THEN 'col-doing'
    WHEN t.status::text = 'IN_REVIEW' THEN 'col-doing'
    ELSE 'col-3940d6b9'
  END,
  "updatedAt" = NOW()
FROM ceo_restore r
WHERE t.id = r.task_id;

DELETE FROM task_projects tp
USING ceo_restore r
WHERE tp."taskId" = r.task_id;

INSERT INTO task_projects (id, "taskId", "projectId", "isPrimary", "createdAt")
SELECT
  substr(md5('p' || r.task_id || 'ceo'), 1, 25),
  r.task_id,
  'cmu212nxh0006n126739nm4i8',
  true,
  NOW()
FROM ceo_restore r;

INSERT INTO task_projects (id, "taskId", "projectId", "isPrimary", "createdAt")
SELECT
  substr(md5('p' || r.task_id || r.delivery_project_id), 1, 25),
  r.task_id,
  r.delivery_project_id,
  false,
  NOW()
FROM ceo_restore r
WHERE r.delivery_project_id <> 'cmu212nxh0006n126739nm4i8'
ON CONFLICT ("taskId", "projectId") DO NOTHING;

COMMIT;
