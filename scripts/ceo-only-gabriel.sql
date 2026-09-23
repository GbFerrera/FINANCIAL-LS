-- Remove do quadro CEO tasks do Fabricio, sem assignee e demais; mantém só Gabriel Ferreira.
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
      WHEN 'cmr97wcko000bpj26lwxtsfsq' THEN 'cmnhenfhr002tp4202x1aw096'
      WHEN 'cmu2so3yk0009tf2bxktuj2eg' THEN 'cmltidb5000awp81xkssz2a26'
      WHEN 'cmtw085mx005xtd2nusr49ndy' THEN 'cmltidb5000awp81xkssz2a26'
      WHEN 'cms4q3wio0005qd2ad1w1eosg' THEN 'cmltidb5000awp81xkssz2a26'
      WHEN 'cmtw1x4rn0061td2nnu4quvjk' THEN 'cmltidb5000awp81xkssz2a26'
      WHEN 'cmrj9lq78000qnu2arq3o6sxe' THEN 'cmqkwp2gr008eqs2pv9m6ie5f'
      WHEN 'cmu2mrpl80056n126l1617ngk' THEN 'cmr984gs9000jpj263e3g0igv'
      WHEN 'cmu3cbfmx002rtf2bmagnqm5n' THEN 'cmltidb5000awp81xkssz2a26'
      WHEN 'cmtw879dk006ltd2ng4lkrsmh' THEN 'cmltidb5000awp81xkssz2a26'
      WHEN 'cmu2n4uhm005wn1261bndt6qr' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmu2n5lb40061n126iyah4jxc' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmtxj7vyf009ftd2ntaqmg0yb' THEN 'cmltidb5000awp81xkssz2a26'
      WHEN 'cmt97sjlb00xwnv2cxxy7hlm8' THEN 'cmnhenfhr002tp4202x1aw096'
      WHEN 'cmu3dby5i0033tf2b534lx6lz' THEN 'cmltidb5000awp81xkssz2a26'
      WHEN 'cmqkwqmzt008iqs2pfv9n2u7n' THEN 'cmqkwp2gr008eqs2pv9m6ie5f'
      WHEN 'cmu3ebdq2003stf2b165cyn7o' THEN 'cmqkwp2gr008eqs2pv9m6ie5f'
      WHEN 'cmu3g2icb003xtf2b0hx3tphi' THEN 'cmnhenfhr002tp4202x1aw096'
      WHEN 'cmqkwgljx008aqs2p5u2fv893' THEN 'cmltidb5000awp81xkssz2a26'
      WHEN 'cmu1n0xdv00ajkd2b9yxiz4n6' THEN 'cmr984gs9000jpj263e3g0igv'
      WHEN 'cmu2linfs003vn1265yv4l7g4' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmttb2k0y000std2nolydmany' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmu3ao90s002ktf2b7k0r4atl' THEN 'cmr984gs9000jpj263e3g0igv'
      WHEN 'cmu2m4aas0040n126zp12bb43' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmttbhql4000wtd2n47ezbmp9' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmu2m52yz0045n12616tla7fx' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmttbtqx2000ytd2nzygf25w8' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmtt0kbvo000jmz2dmikfiicn' THEN 'cmnhenfhr002tp4202x1aw096'
      WHEN 'cmu2m5soj004an1265utz8v2b' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmu2m9b7b004ln1262af6t617' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmu2m6x2n004fn126i5d6fuyj' THEN 'cmr984gs9000jpj263e3g0igv'
      WHEN 'cmu2mat4e004qn126b1910qa4' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmu2mfc530051n126a7u0jbvk' THEN 'cmr984gs9000jpj263e3g0igv'
      WHEN 'cmsrl99lu006inv2ctdhil9t5' THEN 'cmltidb5000awp81xkssz2a26'
      WHEN 'cmrzdknf10003nz2bdq3ojfl4' THEN 'cmqkwp2gr008eqs2pv9m6ie5f'
      WHEN 'cmu2mwsvk005gn126vy30pegn' THEN 'cmltidb5000awp81xkssz2a26'
      WHEN 'cmu2mx84p005ln126846r44y3' THEN 'cms643jgp000qob2bt1l5roc7'
      WHEN 'cmu2msjzp005bn126hilb22k2' THEN 'cmltidb5000awp81xkssz2a26'
      WHEN 'cmu63menz001vtf2ieud9tlt5' THEN 'cmqkwp2gr008eqs2pv9m6ie5f'
      WHEN 'cmsdm18cr001mnv2cv6w15dq5' THEN 'cmltidb5000awp81xkssz2a26'
      ELSE NULL
    END
  ) AS delivery_project_id
FROM tasks t
JOIN users g ON g.email ILIKE 'business.gabrielferreira@gmail.com'
WHERE t."projectId" = 'cmu212nxh0006n126739nm4i8'
  AND t."isArchived" = false
  AND (t."assigneeId" IS DISTINCT FROM g.id);

UPDATE tasks t SET
  "projectId" = r.delivery_project_id,
  "kanbanColumnId" = NULL,
  "updatedAt" = NOW()
FROM off_ceo r
WHERE t.id = r.task_id
  AND r.delivery_project_id IS NOT NULL;

DELETE FROM task_projects tp
USING off_ceo r
WHERE tp."taskId" = r.task_id;

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

COMMIT;
