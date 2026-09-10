-- CreateTable
CREATE TABLE "Suppliers" (
    "ID" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER,
    "deletedBy" INTEGER,

    CONSTRAINT "Suppliers_pkey" PRIMARY KEY ("ID")
);

-- AddForeignKey
ALTER TABLE "Suppliers" ADD CONSTRAINT "Suppliers_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Users"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suppliers" ADD CONSTRAINT "Suppliers_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "Users"("ID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suppliers" ADD CONSTRAINT "Suppliers_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "Users"("ID") ON DELETE SET NULL ON UPDATE CASCADE;
