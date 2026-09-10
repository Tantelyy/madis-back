export const CSV_MAX_FILE_SIZE = 5 * 1024 * 1024;

export interface UploadedCsvFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
