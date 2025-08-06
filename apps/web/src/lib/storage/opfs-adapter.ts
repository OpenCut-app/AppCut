import { StorageAdapter } from "./types";

export class OPFSAdapter implements StorageAdapter<File> {
  private directoryName: string;

  constructor(directoryName = "media") {
    this.directoryName = directoryName;
  }
  
  // will check first rather charsing directly
  private async getDirectory(): Promise<FileSystemDirectoryHandle> {
    if (!OPFSAdapter.isSupported()) {
      throw new Error("OPFS is not supported in this environment.");
    }

    const opfsRoot = await navigator.storage.getDirectory();
    return await opfsRoot.getDirectoryHandle(this.directoryName, {
      create: true,
    });
  }


  async get(key: string): Promise<File | null> {
    try {
      const directory = await this.getDirectory();
      const fileHandle = await directory.getFileHandle(key);
      return await fileHandle.getFile();
    } catch (error) {
      if ((error as Error).name === "NotFoundError") {
        return null;
      }
      throw error;
    }
  }

  async set(key: string, file: File): Promise<void> {
    const directory = await this.getDirectory();
    const fileHandle = await directory.getFileHandle(key, { create: true });
    const writable = await fileHandle.createWritable();

    await writable.write(file);
    await writable.close();
  }

  async remove(key: string): Promise<void> {
    try {
      const directory = await this.getDirectory();
      await directory.removeEntry(key);
    } catch (error) {
      if ((error as Error).name !== "NotFoundError") {
        throw error;
      }
    }
  }

  async list(): Promise<string[]> {
    const directory = await this.getDirectory();
    const keys: string[] = [];

    for await (const name of directory.keys()) {
      keys.push(name);
    }

    return keys;
  }

  async clear(): Promise<void> {
    const directory = await this.getDirectory();

    for await (const name of directory.keys()) {
      await directory.removeEntry(name);
    }
  }

  // Helper method to check OPFS support
  static isSupported(): boolean {
    return "storage" in navigator && "getDirectory" in navigator.storage;
  }
}
