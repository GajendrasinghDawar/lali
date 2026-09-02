import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { ArtifactManager, MAX_FILE_SIZE } from "./artifacts.ts";
import { db } from "./auth.ts";
import fs from "fs";
import path from "path";

describe("ArtifactManager", () => {
  beforeEach(() => {
    db.exec("DELETE FROM artifacts");
  });

  afterAll(() => {
    // Clean up created files
    const dir = path.resolve(process.cwd(), "data", "artifacts");
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stores and retrieves allowed files", () => {
    const id = ArtifactManager.store("sess-1", "test.png", "image/png", Buffer.from("fake-png-data"));
    expect(id).toBeDefined();

    const retrieved = ArtifactManager.getByIds([id]);
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].name).toBe("test.png");
    expect(retrieved[0].mimeType).toBe("image/png");
    expect(fs.existsSync(retrieved[0].path)).toBe(true);
  });

  it("rejects oversized files", () => {
    expect(() => {
      ArtifactManager.validate("image/png", MAX_FILE_SIZE + 1);
    }).toThrow(/exceeds limit/);
  });

  it("rejects unauthorized mime types", () => {
    expect(() => {
      ArtifactManager.validate("application/x-sh", 1024);
    }).toThrow(/Unsupported file type/);
    
    expect(() => {
      ArtifactManager.store("sess-1", "script.sh", "application/x-sh", Buffer.from("echo hi"));
    }).toThrow(/Unsupported file type/);
  });

  it("sanitizes hostile filenames", () => {
    const hostileName = "../../../etc/passwd";
    const id = ArtifactManager.store("sess-1", hostileName, "text/plain", Buffer.from("secret"));
    const retrieved = ArtifactManager.getByIds([id]);
    expect(retrieved[0].name).not.toContain("..");
    expect(retrieved[0].name).toBe("passwd");
    expect(retrieved[0].path).toMatch(/data[/\\]artifacts[/\\][a-f0-9-]+-passwd/);
  });
});
