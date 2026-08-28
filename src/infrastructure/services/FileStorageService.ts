import fs from 'fs';
import path from 'path';

export class FileStorageService {
  private readonly storageDir: string;

  constructor() {
    this.storageDir = path.join(__dirname, '../../../../uploads/reports');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  public getFilePath(filename: string): string {
    return path.join(this.storageDir, filename);
  }

  public async saveFile(filename: string, buffer: Buffer): Promise<string> {
    const fullPath = this.getFilePath(filename);
    fs.writeFileSync(fullPath, buffer);
    return `/uploads/reports/${filename}`;
  }

  public getWriteStream(filename: string): fs.WriteStream {
    const fullPath = this.getFilePath(filename);
    return fs.createWriteStream(fullPath);
  }
}
