-- CreateTable
CREATE TABLE "public"."excalidraw_projects" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "excalidraw_projects_pkey" PRIMARY KEY ("id")
);
