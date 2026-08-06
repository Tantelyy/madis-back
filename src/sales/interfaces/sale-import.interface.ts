export { CSV_MAX_FILE_SIZE as SALE_CSV_MAX_FILE_SIZE } from '../../common/interfaces/uploaded-csv-file.interface';
export type { UploadedCsvFile as UploadedSaleCsvFile } from '../../common/interfaces/uploaded-csv-file.interface';

export interface SaleImportSummary {
  rowsProcessed: number;
  rowsNotSold: number;
  rowsWithoutInventory: number;
  salesCreated: number;
  movementsCreated: number;
}
