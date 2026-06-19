-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Users" (
    "ID" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "roleId" INTEGER NOT NULL,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Roles" (
    "ID" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "deletedBy" INTEGER,

    CONSTRAINT "Roles_pkey" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Permissions" (
    "ID" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "descriptions" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "Permissions_pkey" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "UserPermissions" (
    "ID" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "UserPermissions_pkey" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "RolePermissions" (
    "ID" SERIAL NOT NULL,
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "deletedBy" INTEGER,

    CONSTRAINT "RolePermissions_pkey" PRIMARY KEY ("ID")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Roles_label_key" ON "Roles"("label");

-- CreateIndex
CREATE UNIQUE INDEX "Permissions_code_key" ON "Permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissions_userId_permissionId_key" ON "UserPermissions"("userId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermissions_roleId_permissionId_key" ON "RolePermissions"("roleId", "permissionId");

-- AddForeignKey
ALTER TABLE "Users" ADD CONSTRAINT "Users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Roles"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissions" ADD CONSTRAINT "UserPermissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissions" ADD CONSTRAINT "UserPermissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permissions"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermissions" ADD CONSTRAINT "RolePermissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Roles"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermissions" ADD CONSTRAINT "RolePermissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permissions"("ID") ON DELETE RESTRICT ON UPDATE CASCADE;
