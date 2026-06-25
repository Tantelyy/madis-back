-- CreateEnum
CREATE TYPE "PricingGridStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DRAFT');

-- CreateTable
CREATE TABLE "PricingGrids" (
    "ID" SERIAL NOT NULL,
    "status" "PricingGridStatus" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingGrids_pkey" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "PricingRules" (
    "ID" SERIAL NOT NULL,
    "pricingGridId" INTEGER NOT NULL,
    "minPurchasePrice" INTEGER NOT NULL,
    "maxPurchasePrice" INTEGER NOT NULL,
    "retailMarginPercent" DECIMAL(5,2) NOT NULL,
    "wholeSaleMarginPercent" DECIMAL(5,2) NOT NULL,
    "retailAverage" DECIMAL(12,2) NOT NULL,
    "wholeSaleAverage" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PricingRules_pkey" PRIMARY KEY ("ID")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingGrids_effectiveFrom_key" ON "PricingGrids"("effectiveFrom");

-- CreateIndex
CREATE INDEX "PricingRules_pricingGridId_idx" ON "PricingRules"("pricingGridId");

-- CreateIndex
CREATE UNIQUE INDEX "PricingRules_pricingGridId_minPurchasePrice_maxPurchasePrice_key" ON "PricingRules"("pricingGridId", "minPurchasePrice", "maxPurchasePrice");

-- AddForeignKey
ALTER TABLE "PricingGrids" ADD CONSTRAINT "PricingGrids_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Users"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRules" ADD CONSTRAINT "PricingRules_pricingGridId_fkey" FOREIGN KEY ("pricingGridId") REFERENCES "PricingGrids"("ID") ON DELETE CASCADE ON UPDATE CASCADE;
