-- CreateTable
CREATE TABLE "ProductMarks" (
    "ID" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMarks_pkey" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "ProductSpecifications" (
    "ID" SERIAL NOT NULL,
    "specification" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProductSpecifications_pkey" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "ProductFormats" (
    "ID" SERIAL NOT NULL,
    "format" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFormats_pkey" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "ProductTypes" (
    "ID" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTypes_pkey" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Products" (
    "ID" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "markId" INTEGER NOT NULL,
    "specificationId" INTEGER NOT NULL,
    "formatId" INTEGER NOT NULL,
    "productTypeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "image" TEXT,
    "updatedBy" INTEGER,

    CONSTRAINT "Products_pkey" PRIMARY KEY ("ID")
);

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "Products_markId_fkey" FOREIGN KEY ("markId") REFERENCES "ProductMarks"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "Products_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "ProductSpecifications"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "Products_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "ProductFormats"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "Products_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductTypes"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "Products_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "Users"("ID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "Products_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Users"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "Products_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "Users"("ID") ON DELETE SET NULL ON UPDATE CASCADE;
