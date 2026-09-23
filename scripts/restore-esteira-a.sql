BEGIN;

UPDATE tasks SET "projectId" = 'cmr984gs9000jpj263e3g0igv', "kanbanColumnId" = NULL, "updatedAt" = NOW()
WHERE id IN (
  'cmub5u6jp00smtf2i43i1u3d5','cmu1n0xdv00ajkd2b9yxiz4n6','cmu2mrpl80056n126l1617ngk',
  'cmu2m6x2n004fn126i5d6fuyj','cmu2mfc530051n126a7u0jbvk','cmu3ao90s002ktf2b7k0r4atl'
);

UPDATE tasks SET "projectId" = 'cmltidb5000awp81xkssz2a26', "kanbanColumnId" = NULL, "updatedAt" = NOW()
WHERE id IN (
  'cmsrl99lu006inv2ctdhil9t5','cmu2so3yk0009tf2bxktuj2eg','cmtw1x4rn0061td2nnu4quvjk',
  'cmtw879dk006ltd2ng4lkrsmh','cmu3cbfmx002rtf2bmagnqm5n','cmtxj7vyf009ftd2ntaqmg0yb',
  'cmu3dby5i0033tf2b534lx6lz','cms4q3wio0005qd2ad1w1eosg','cmsdm18cr001mnv2cv6w15dq5',
  'cmu2mwsvk005gn126vy30pegn','cmu2msjzp005bn126hilb22k2','cmqkwgljx008aqs2p5u2fv893',
  'cmtw085mx005xtd2nusr49ndy'
);

UPDATE tasks SET "projectId" = 'cmqkwp2gr008eqs2pv9m6ie5f', "kanbanColumnId" = NULL, "updatedAt" = NOW()
WHERE id IN (
  'cmqkwqmzt008iqs2pfv9n2u7n','cmu3ebdq2003stf2b165cyn7o','cmrzdknf10003nz2bdq3ojfl4',
  'cmu63menz001vtf2ieud9tlt5','cmrj9lq78000qnu2arq3o6sxe'
);

UPDATE tasks SET "projectId" = 'cms643jgp000qob2bt1l5roc7', "kanbanColumnId" = NULL, "updatedAt" = NOW()
WHERE id IN (
  'cmttbtqx2000ytd2nzygf25w8','cmttbhql4000wtd2n47ezbmp9','cmu2m4aas0040n126zp12bb43',
  'cmu2m52yz0045n12616tla7fx','cmu2m9b7b004ln1262af6t617','cmu2mat4e004qn126b1910qa4',
  'cmu2m5soj004an1265utz8v2b','cmu2linfs003vn1265yv4l7g4','cmu2mx84p005ln126846r44y3',
  'cmu2n4uhm005wn1261bndt6qr','cmttb2k0y000std2nolydmany','cmu2n5lb40061n126iyah4jxc'
);

COMMIT;
