import fs from 'fs';
import path from 'path';
import { FileStorageService } from '../../../src/infrastructure/services/FileStorageService';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  createWriteStream: jest.fn(),
}));

describe('FileStorageService', () => {
  let fileStorageService: FileStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create the storage directory if it does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      fileStorageService = new FileStorageService();
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    it('should not create the storage directory if it already exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fileStorageService = new FileStorageService();
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('getFilePath', () => {
    beforeEach(() => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fileStorageService = new FileStorageService();
    });

    it('should return the correct file path for a valid filename', () => {
      const filename = 'test.pdf';
      const expectedPath = path.resolve(path.join((fileStorageService as any).storageDir, filename));
      expect(fileStorageService.getFilePath(filename)).toBe(expectedPath);
    });

    it('should throw an error for path traversal attempt', () => {
      expect(() => {
        fileStorageService.getFilePath('../../../etc/passwd');
      }).toThrow('Invalid filename: Path traversal detected');
    });
  });

  describe('saveFile', () => {
    beforeEach(() => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fileStorageService = new FileStorageService();
    });

    it('should save a file and return the relative path', async () => {
      const filename = 'test.pdf';
      const buffer = Buffer.from('test data');
      const expectedPath = path.resolve(path.join((fileStorageService as any).storageDir, filename));
      const result = await fileStorageService.saveFile(filename, buffer);
      expect(fs.writeFileSync).toHaveBeenCalledWith(expectedPath, buffer);
      expect(result).toBe(`/uploads/reports/${filename}`);
    });
  });

  describe('getWriteStream', () => {
    beforeEach(() => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fileStorageService = new FileStorageService();
    });

    it('should return a write stream for a file', () => {
      const filename = 'test.pdf';
      const expectedPath = path.resolve(path.join((fileStorageService as any).storageDir, filename));
      const mockStream = {} as fs.WriteStream;
      (fs.createWriteStream as jest.Mock).mockReturnValue(mockStream);

      const result = fileStorageService.getWriteStream(filename);
      expect(fs.createWriteStream).toHaveBeenCalledWith(expectedPath);
      expect(result).toBe(mockStream);
    });
  });
});
