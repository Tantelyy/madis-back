export { CSV_MAX_FILE_SIZE as INVENTORY_CSV_MAX_FILE_SIZE } from '../../common/interfaces/uploaded-csv-file.interface';
export type { UploadedCsvFile as UploadedInventoryCsvFile } from '../../common/interfaces/uploaded-csv-file.interface';

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
