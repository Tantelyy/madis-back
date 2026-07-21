-- AlterTable
ALTER TABLE "Carts"
ADD COLUMN "reason" TEXT,
ALTER COLUMN "status" SET DEFAULT 'VALIDATED',
ALTER COLUMN "paymentMethod" DROP NOT NULL;

-- AlterTable
ALTER TABLE "InventoryMovement"
ADD COLUMN "cartId" INTEGER;

-- CreateIndex
CREATE INDEX "InventoryMovement_cartId_idx" ON "InventoryMovement"("cartId");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Carts"("ID") ON DELETE SET NULL ON UPDATE CASCADE;
