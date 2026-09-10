ALTER TABLE "Carts"
ADD COLUMN "customerNif" TEXT,
ADD COLUMN "customerStat" TEXT;

INSERT INTO "Roles" ("label", "createdAt", "updatedAt")
VALUES ('STOCK_MANAGER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("label") DO UPDATE
SET "deletedAt" = NULL, "deletedBy" = NULL, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Permissions" (
  "label",
  "code",
  "descriptions",
  "createdAt",
  "updatedAt"
)
VALUES (
  'Consulter l''état du stock',
  'CAN_VIEW_STOCK',
  'Permet de consulter et d''exporter l''état du stock par produit et par lot.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE
SET
  "label" = EXCLUDED."label",
  "descriptions" = EXCLUDED."descriptions",
  "deletedAt" = NULL,
  "deletedBy" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermissions" (
  "roleId",
  "permissionId",
  "createdAt",
  "updatedAt"
)
SELECT role."ID", permission."ID", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Roles" role
CROSS JOIN "Permissions" permission
WHERE role."label" = 'STOCK_MANAGER'
  AND permission."code" = 'CAN_VIEW_STOCK'
ON CONFLICT ("roleId", "permissionId") DO UPDATE
SET "deletedAt" = NULL, "deletedBy" = NULL, "updatedAt" = CURRENT_TIMESTAMP;
