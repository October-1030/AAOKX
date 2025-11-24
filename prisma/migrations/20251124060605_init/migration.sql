-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelName" TEXT NOT NULL,
    "coin" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "entryPrice" REAL NOT NULL,
    "exitPrice" REAL NOT NULL,
    "leverage" INTEGER NOT NULL,
    "notional" REAL NOT NULL,
    "pnl" REAL NOT NULL,
    "pnlPercent" REAL NOT NULL,
    "openedAt" DATETIME NOT NULL,
    "closedAt" DATETIME NOT NULL,
    "exitReason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PositionSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelName" TEXT NOT NULL,
    "coin" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "leverage" INTEGER NOT NULL,
    "notional" REAL NOT NULL,
    "entryPrice" REAL NOT NULL,
    "currentPrice" REAL NOT NULL,
    "liquidationPrice" REAL NOT NULL,
    "unrealizedPnL" REAL NOT NULL,
    "unrealizedPnLPercent" REAL NOT NULL,
    "maxUnrealizedPnL" REAL,
    "maxUnrealizedPnLPercent" REAL,
    "trailingStopActivated" BOOLEAN NOT NULL DEFAULT false,
    "stopLoss" REAL NOT NULL,
    "takeProfit" REAL NOT NULL,
    "invalidation" TEXT NOT NULL,
    "openedAt" DATETIME NOT NULL,
    "snapshotAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AccountSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelName" TEXT NOT NULL,
    "availableCash" REAL NOT NULL,
    "totalEquity" REAL NOT NULL,
    "totalReturn" REAL NOT NULL,
    "tradingDuration" BIGINT NOT NULL,
    "totalCalls" INTEGER NOT NULL,
    "positionsCount" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AIDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelName" TEXT NOT NULL,
    "coin" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "leverage" INTEGER,
    "notional" REAL,
    "stopLoss" REAL,
    "takeProfit" REAL,
    "invalidation" TEXT,
    "chainOfThought" TEXT NOT NULL,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "executionResult" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EquityHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelName" TEXT NOT NULL,
    "equity" REAL NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Trade_modelName_idx" ON "Trade"("modelName");

-- CreateIndex
CREATE INDEX "Trade_coin_idx" ON "Trade"("coin");

-- CreateIndex
CREATE INDEX "Trade_closedAt_idx" ON "Trade"("closedAt");

-- CreateIndex
CREATE INDEX "PositionSnapshot_modelName_idx" ON "PositionSnapshot"("modelName");

-- CreateIndex
CREATE INDEX "PositionSnapshot_coin_idx" ON "PositionSnapshot"("coin");

-- CreateIndex
CREATE INDEX "PositionSnapshot_snapshotAt_idx" ON "PositionSnapshot"("snapshotAt");

-- CreateIndex
CREATE INDEX "AccountSnapshot_modelName_idx" ON "AccountSnapshot"("modelName");

-- CreateIndex
CREATE INDEX "AccountSnapshot_timestamp_idx" ON "AccountSnapshot"("timestamp");

-- CreateIndex
CREATE INDEX "AIDecision_modelName_idx" ON "AIDecision"("modelName");

-- CreateIndex
CREATE INDEX "AIDecision_coin_idx" ON "AIDecision"("coin");

-- CreateIndex
CREATE INDEX "AIDecision_timestamp_idx" ON "AIDecision"("timestamp");

-- CreateIndex
CREATE INDEX "EquityHistory_modelName_idx" ON "EquityHistory"("modelName");

-- CreateIndex
CREATE INDEX "EquityHistory_timestamp_idx" ON "EquityHistory"("timestamp");

-- CreateIndex
CREATE INDEX "SystemLog_level_idx" ON "SystemLog"("level");

-- CreateIndex
CREATE INDEX "SystemLog_category_idx" ON "SystemLog"("category");

-- CreateIndex
CREATE INDEX "SystemLog_timestamp_idx" ON "SystemLog"("timestamp");
