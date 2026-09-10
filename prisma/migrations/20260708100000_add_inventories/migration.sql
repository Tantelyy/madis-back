-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('INCOMING', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "Inventories" (
    "ID" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "purchasePrice" DECIMAL(12,2) NOT NULL,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "updatedBy" INTEGER,
    "supplierId" INTEGER NOT NULL,
    "wholeSalePrice" DECIMAL(12,2) NOT NULL,
    "remainingQuantity" INTEGER NOT NULL,
    "expiredAt" TIMESTAMP(3),

    CONSTRAINT "Inventories_pkey" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "ID" SERIAL NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "incomingQuantity" INTEGER NOT NULL,
    "outgoingQuantity" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "purchasePrice" DECIMAL(12,2) NOT NULL,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "wholeSalePrice" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("ID")
);

-- CreateIndex
CREATE INDEX "Inventories_productId_idx" ON "Inventories"("productId");

-- CreateIndex
CREATE INDEX "Inventories_supplierId_idx" ON "Inventories"("supplierId");

-- CreateIndex
CREATE INDEX "InventoryMovement_inventoryId_idx" ON "InventoryMovement"("inventoryId");

-- CreateIndex
CREATE INDEX "InventoryMovement_actorId_idx" ON "InventoryMovement"("actorId");

-- AddForeignKey
ALTER TABLE "Inventories" ADD CONSTRAINT "Inventories_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventories" ADD CONSTRAINT "Inventories_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Suppliers"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventories" ADD CONSTRAINT "Inventories_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Users"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventories" ADD CONSTRAINT "Inventories_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "Users"("ID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventories"("ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Users"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;
