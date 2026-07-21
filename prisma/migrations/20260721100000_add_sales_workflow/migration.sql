-- AlterEnum
ALTER TYPE "InventoryMovementType" ADD VALUE 'SALE';
ALTER TYPE "InventoryMovementType" ADD VALUE 'REFUND';
ALTER TYPE "InventoryMovementType" ADD VALUE 'CANCELLATION';

-- AlterEnum
ALTER TYPE "CartStatus" ADD VALUE 'REFUNDED';
ALTER TYPE "CartStatus" ADD VALUE 'CANCELLED';
