-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('PENDING', 'VALIDATED', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MVOLA', 'AIRTEL MONEY', 'ORANGE MONEY', 'CASH');

-- CreateTable
CREATE TABLE "Carts" (
    "ID" SERIAL NOT NULL,
    "soldBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "CartStatus" NOT NULL DEFAULT 'PENDING',
    "validatedBy" INTEGER,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerContact" TEXT NOT NULL,
    "customerAddress" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,

    CONSTRAINT "Carts_pkey" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "CartDetails" (
    "ID" SERIAL NOT NULL,
    "cartId" INTEGER NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "soldFor" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "wholeSale" BOOLEAN NOT NULL DEFAULT false,
    "specialOfferId" INTEGER,

    CONSTRAINT "CartDetails_pkey" PRIMARY KEY ("ID")
);

-- CreateIndex
CREATE INDEX "Carts_soldBy_idx" ON "Carts"("soldBy");

-- CreateIndex
CREATE INDEX "Carts_validatedBy_idx" ON "Carts"("validatedBy");

-- CreateIndex
CREATE INDEX "CartDetails_cartId_idx" ON "CartDetails"("cartId");

-- CreateIndex
CREATE INDEX "CartDetails_inventoryId_idx" ON "CartDetails"("inventoryId");

-- CreateIndex
CREATE INDEX "CartDetails_specialOfferId_idx" ON "CartDetails"("specialOfferId");

-- AddForeignKey
ALTER TABLE "Carts" ADD CONSTRAINT "Carts_soldBy_fkey" FOREIGN KEY ("soldBy") REFERENCES "Users"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carts" ADD CONSTRAINT "Carts_validatedBy_fkey" FOREIGN KEY ("validatedBy") REFERENCES "Users"("ID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartDetails" ADD CONSTRAINT "CartDetails_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Carts"("ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartDetails" ADD CONSTRAINT "CartDetails_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventories"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;
