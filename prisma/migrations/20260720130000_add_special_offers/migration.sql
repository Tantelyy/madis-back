-- CreateTable
CREATE TABLE "SpecialOffers" (
    "ID" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(12,2),
    "unit" TEXT,
    "buyQuantity" INTEGER,
    "freeQuantity" INTEGER,
    "type" TEXT NOT NULL,

    CONSTRAINT "SpecialOffers_pkey" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "InventorySpecialOffers" (
    "ID" SERIAL NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "specialOfferId" INTEGER NOT NULL,
    "limitDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySpecialOffers_pkey" PRIMARY KEY ("ID")
);

-- Preserve the former sale price as the base price for existing cart details.
ALTER TABLE "CartDetails" RENAME COLUMN "soldFor" TO "baseUnitPrice";

-- AlterTable
ALTER TABLE "CartDetails"
ADD COLUMN "freeQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "finalUnitPrice" DECIMAL(12,2),
ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "CartDetails"
SET "finalUnitPrice" = "baseUnitPrice";

ALTER TABLE "CartDetails"
ALTER COLUMN "finalUnitPrice" SET NOT NULL;

-- CreateIndex
CREATE INDEX "SpecialOffers_createdBy_idx" ON "SpecialOffers"("createdBy");

-- CreateIndex
CREATE INDEX "SpecialOffers_deletedBy_idx" ON "SpecialOffers"("deletedBy");

-- CreateIndex
CREATE INDEX "SpecialOffers_startDateTime_endDateTime_idx" ON "SpecialOffers"("startDateTime", "endDateTime");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySpecialOffers_inventoryId_specialOfferId_key" ON "InventorySpecialOffers"("inventoryId", "specialOfferId");

-- CreateIndex
CREATE INDEX "InventorySpecialOffers_specialOfferId_idx" ON "InventorySpecialOffers"("specialOfferId");

-- CreateIndex
CREATE INDEX "InventorySpecialOffers_limitDate_idx" ON "InventorySpecialOffers"("limitDate");

-- AddForeignKey
ALTER TABLE "SpecialOffers" ADD CONSTRAINT "SpecialOffers_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Users"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialOffers" ADD CONSTRAINT "SpecialOffers_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "Users"("ID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySpecialOffers" ADD CONSTRAINT "InventorySpecialOffers_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventories"("ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySpecialOffers" ADD CONSTRAINT "InventorySpecialOffers_specialOfferId_fkey" FOREIGN KEY ("specialOfferId") REFERENCES "SpecialOffers"("ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartDetails" ADD CONSTRAINT "CartDetails_specialOfferId_fkey" FOREIGN KEY ("specialOfferId") REFERENCES "SpecialOffers"("ID") ON DELETE SET NULL ON UPDATE CASCADE;
