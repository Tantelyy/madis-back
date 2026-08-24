-- AlterEnum
ALTER TYPE "CartStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';

-- AlterTable
ALTER TABLE "SpecialOffers"
ADD COLUMN "productIdOffer" INTEGER;

-- AlterTable
ALTER TABLE "CartDetails"
ADD COLUMN "refundAt" TIMESTAMP(3),
ADD COLUMN "refundBy" INTEGER,
ADD COLUMN "refundedQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reason" TEXT;

-- CreateTable
CREATE TABLE "LimitInventory" (
    "ID" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "LimitInventory_pkey" PRIMARY KEY ("ID")
);

-- CreateIndex
CREATE INDEX "SpecialOffers_productIdOffer_idx" ON "SpecialOffers"("productIdOffer");
CREATE INDEX "CartDetails_refundBy_idx" ON "CartDetails"("refundBy");
CREATE INDEX "LimitInventory_createdAt_idx" ON "LimitInventory"("createdAt");
CREATE INDEX "LimitInventory_createdBy_idx" ON "LimitInventory"("createdBy");

-- AddForeignKey
ALTER TABLE "SpecialOffers" ADD CONSTRAINT "SpecialOffers_productIdOffer_fkey" FOREIGN KEY ("productIdOffer") REFERENCES "Products"("ID") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CartDetails" ADD CONSTRAINT "CartDetails_refundBy_fkey" FOREIGN KEY ("refundBy") REFERENCES "Users"("ID") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LimitInventory" ADD CONSTRAINT "LimitInventory_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Users"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;
