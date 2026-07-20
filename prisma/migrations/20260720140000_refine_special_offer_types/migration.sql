-- CreateEnum
CREATE TYPE "SpecialOfferType" AS ENUM ('REDUCTION', 'BUY_X_GET_N');

-- CreateEnum
CREATE TYPE "SpecialOfferUnit" AS ENUM ('PERCENT', 'FIXED');

-- AlterTable
ALTER TABLE "CartDetails"
ALTER COLUMN "freeQuantity" DROP DEFAULT,
ALTER COLUMN "freeQuantity" DROP NOT NULL,
ALTER COLUMN "discountAmount" DROP DEFAULT,
ALTER COLUMN "discountAmount" DROP NOT NULL;

-- AlterTable
ALTER TABLE "InventorySpecialOffers"
ALTER COLUMN "limitDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SpecialOffers"
ALTER COLUMN "type" TYPE "SpecialOfferType"
USING ("type"::text::"SpecialOfferType"),
ALTER COLUMN "unit" TYPE "SpecialOfferUnit"
USING ("unit"::text::"SpecialOfferUnit");
