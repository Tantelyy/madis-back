export const INVENTORY_CSV_MAX_FILE_SIZE = 5 * 1024 * 1024;

export interface UploadedInventoryCsvFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface InventoryImportSummary {
  rowsProcessed: number;
  rowsSkipped: number;
  inventoriesCreated: number;
  lotsSkipped: number;
  movementsCreated: number;
  productsCreated: number;
  marksCreated: number;
  specificationsCreated: number;
  formatsCreated: number;
  productTypesCreated: number;
  suppliersCreated: number;
}
