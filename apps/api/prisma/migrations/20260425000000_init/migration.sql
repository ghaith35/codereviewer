-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('QUEUED', 'FETCHING_FILES', 'RUNNING_STATIC', 'RUNNING_AI', 'GENERATING_REPORT', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('SECURITY', 'PERFORMANCE', 'QUALITY', 'BEST_PRACTICE', 'MAINTAINABILITY');

-- CreateEnum
CREATE TYPE "IssueSource" AS ENUM ('ESLINT', 'PYLINT', 'SEMGREP', 'GEMINI');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "githubId" INTEGER NOT NULL,
    "githubLogin" TEXT NOT NULL,
    "email" TEXT,
    "avatarUrl" TEXT,
    "name" TEXT,
    "githubTokenEnc" TEXT NOT NULL,
    "githubTokenIv" TEXT NOT NULL,
    "githubTokenTag" TEXT NOT NULL,
    "githubScopes" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "analysesUsedMtd" INTEGER NOT NULL DEFAULT 0,
    "lastQuotaReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "githubId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "language" TEXT,
    "htmlUrl" TEXT NOT NULL,
    "starsCount" INTEGER NOT NULL DEFAULT 0,
    "pushedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "commitSha" TEXT,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "status" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "overallScore" INTEGER,
    "securityScore" INTEGER,
    "performanceScore" INTEGER,
    "qualityScore" INTEGER,
    "filesAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "issuesCritical" INTEGER NOT NULL DEFAULT 0,
    "issuesHigh" INTEGER NOT NULL DEFAULT 0,
    "issuesMedium" INTEGER NOT NULL DEFAULT 0,
    "issuesLow" INTEGER NOT NULL DEFAULT 0,
    "issuesInfo" INTEGER NOT NULL DEFAULT 0,
    "jobId" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisFile" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "linesOfCode" INTEGER NOT NULL,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "skipReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "lineStart" INTEGER NOT NULL,
    "lineEnd" INTEGER,
    "columnStart" INTEGER,
    "severity" "IssueSeverity" NOT NULL,
    "category" "IssueCategory" NOT NULL,
    "source" "IssueSource" NOT NULL,
    "ruleId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "codeSnippet" TEXT,
    "suggestion" TEXT,
    "suggestionCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "status" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE INDEX "User_githubLogin_idx" ON "User"("githubLogin");

-- CreateIndex
CREATE INDEX "User_plan_idx" ON "User"("plan");

-- CreateIndex
CREATE INDEX "Repository_userId_idx" ON "Repository"("userId");

-- CreateIndex
CREATE INDEX "Repository_userId_pushedAt_idx" ON "Repository"("userId", "pushedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Repository_userId_githubId_key" ON "Repository"("userId", "githubId");

-- CreateIndex
CREATE INDEX "Analysis_userId_createdAt_idx" ON "Analysis"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Analysis_repositoryId_createdAt_idx" ON "Analysis"("repositoryId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Analysis_status_idx" ON "Analysis"("status");

-- CreateIndex
CREATE INDEX "AnalysisFile_analysisId_idx" ON "AnalysisFile"("analysisId");

-- CreateIndex
CREATE INDEX "AnalysisFile_analysisId_skipped_idx" ON "AnalysisFile"("analysisId", "skipped");

-- CreateIndex
CREATE INDEX "Issue_analysisId_idx" ON "Issue"("analysisId");

-- CreateIndex
CREATE INDEX "Issue_analysisId_severity_idx" ON "Issue"("analysisId", "severity");

-- CreateIndex
CREATE INDEX "Issue_analysisId_category_idx" ON "Issue"("analysisId", "category");

-- CreateIndex
CREATE INDEX "Issue_analysisId_filePath_idx" ON "Issue"("analysisId", "filePath");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisFile" ADD CONSTRAINT "AnalysisFile_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
