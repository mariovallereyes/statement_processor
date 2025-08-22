export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: Date;
  checksum?: string;
}

export interface UploadResult {
  fileId: string;
  fileType: 'pdf' | 'csv';
  metadata: FileMetadata;
  rawContent: string | ArrayBuffer;
}