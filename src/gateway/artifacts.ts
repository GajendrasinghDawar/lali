import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db } from "./auth.ts";

const ARTIFACTS_DIR = path.resolve(process.cwd(), "data", "artifacts");
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

db.exec(`
  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    sessionId TEXT NOT NULL,
    fileName TEXT NOT NULL,
    mimeType TEXT NOT NULL,
    size INTEGER NOT NULL,
    storagePath TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export class ArtifactManager {
  static validate(mimeType: string, size: number) {
    if (size > MAX_FILE_SIZE) {
      throw new Error(`File size ${size} exceeds limit of ${MAX_FILE_SIZE}`);
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  }

  static store(sessionId: string, originalFileName: string, mimeType: string, buffer: Buffer): string {
    ArtifactManager.validate(mimeType, buffer.length);
    
    const id = crypto.randomUUID();
    // Normalize original filename to remove any path elements
    const safeName = path.basename(originalFileName).replace(/[^a-zA-Z0-9.-]/g, "_");
    const storageName = `${id}-${safeName}`;
    const storagePath = path.join(ARTIFACTS_DIR, storageName);

    // Prevent path traversal
    if (!storagePath.startsWith(ARTIFACTS_DIR)) {
      throw new Error("Invalid artifact path");
    }

    fs.writeFileSync(storagePath, buffer);

    db.prepare(`
      INSERT INTO artifacts (id, sessionId, fileName, mimeType, size, storagePath)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, sessionId, safeName, mimeType, buffer.length, storagePath);

    return id;
  }

  static getByIds(ids: string[]) {
    if (!ids || ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    const artifacts = db.prepare(`SELECT id, fileName, mimeType, storagePath FROM artifacts WHERE id IN (${placeholders})`).all(...ids) as { id: string, fileName: string, mimeType: string, storagePath: string }[];
    return artifacts.map(a => ({
      id: a.id,
      name: a.fileName,
      mimeType: a.mimeType,
      path: a.storagePath
    }));
  }

  static cleanupOldArtifacts(daysRetention: number = 7) {
    const old = db.prepare(`SELECT id, storagePath FROM artifacts WHERE created_at < datetime('now', ?)`).all(`-${daysRetention} days`) as { id: string, storagePath: string }[];
    for (const artifact of old) {
      if (fs.existsSync(artifact.storagePath)) {
        fs.unlinkSync(artifact.storagePath);
      }
      db.prepare(`DELETE FROM artifacts WHERE id = ?`).run(artifact.id);
    }
  }
}
