-- CreateTable: AI-generated SEO article (System 5 content engine)
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "faq" JSONB NOT NULL DEFAULT '[]',
    "internalLinks" JSONB NOT NULL DEFAULT '[]',
    "category" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "primaryKeyword" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "intent" TEXT NOT NULL DEFAULT 'informational',
    "scoreSeo" INTEGER NOT NULL DEFAULT 0,
    "scoreReadability" INTEGER NOT NULL DEFAULT 0,
    "scoreValue" INTEGER NOT NULL DEFAULT 0,
    "scoreTrust" INTEGER NOT NULL DEFAULT 0,
    "scoreConversion" INTEGER NOT NULL DEFAULT 0,
    "scoreTotal" INTEGER NOT NULL DEFAULT 0,
    "similarityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "newAngle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "generatedBy" TEXT NOT NULL DEFAULT 'fallback',
    "authorId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_status_publishedAt_idx" ON "Article"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Article_category_idx" ON "Article"("category");
