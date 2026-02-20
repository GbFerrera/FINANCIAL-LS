-- CreateTable: user_page_access
CREATE TABLE "public"."user_page_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_page_access_pkey" PRIMARY KEY ("id")
);

-- Ensure one record per user-path
CREATE UNIQUE INDEX "user_page_access_userId_path_key" ON "public"."user_page_access"("userId","path");

-- Add foreign key to users
ALTER TABLE "public"."user_page_access"
  ADD CONSTRAINT "user_page_access_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
