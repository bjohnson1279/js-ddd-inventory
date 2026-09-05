import fs from 'fs';
import path from 'path';
import { FileStorageService } from '../../../src/infrastructure/services/FileStorageService';

jest.mock('fs');

describe('FileStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create the storage directory if it does not exist', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    new FileStorageService();

    expect(fs.existsSync).toHaveBeenCalled();
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('uploads', 'reports')),
      { recursive: true }
    );
  });

  it('should not create the storage directory if it already exists', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    new FileStorageService();

    expect(fs.existsSync).toHaveBeenCalled();
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it('should return the correct file path', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    const service = new FileStorageService();

    const filePath = service.getFilePath('test.txt');
    expect(filePath).toContain(path.join('uploads', 'reports', 'test.txt'));
  });

  it('should save a file and return the relative path', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    const service = new FileStorageService();

    const buffer = Buffer.from('test data');
    const result = await service.saveFile('test.txt', buffer);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('uploads', 'reports', 'test.txt')),
      buffer
    );
    expect(result).toBe('/uploads/reports/test.txt');
  });

  it('should return a write stream for a file', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    const mockWriteStream = {} as fs.WriteStream;
    (fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

    const service = new FileStorageService();
    const stream = service.getWriteStream('test.txt');

    expect(fs.createWriteStream).toHaveBeenCalledWith(
      expect.stringContaining(path.join('uploads', 'reports', 'test.txt'))
    );
    expect(stream).toBe(mockWriteStream);
  });
});
