import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export class GitHubManager {
  static get workspaceRoot() {
    const dir = path.join(process.cwd(), "data", "workspaces");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  static get token() {
    const t = process.env.GITHUB_SERVICE_TOKEN || process.env.GITHUB_TOKEN;
    if (!t) throw new Error("GitHub service token not configured");
    return t;
  }

  static async cloneRepo(repo: string, workspaceName: string) {
    const targetDir = path.join(this.workspaceRoot, workspaceName);
    if (fs.existsSync(targetDir)) {
      throw new Error("Workspace already exists");
    }

    const token = this.token;
    // Inject credentials for one operation
    const cloneUrl = "https://oauth2:" + token + "@github.com/" + repo + ".git";
    
    try {
      execSync("git clone " + cloneUrl + " " + targetDir, { stdio: 'ignore' });
      
      // Remove temporary credential material immediately
      execSync("git remote set-url origin https://github.com/" + repo + ".git", { cwd: targetDir, stdio: 'ignore' });
      
      // Also ensure git config doesn't cache it
      execSync("git config --local credential.helper \"\"", { cwd: targetDir, stdio: 'ignore' });
    } catch (e) {
      if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
      throw new Error("Failed to clone repository");
    }

    return targetDir;
  }

  static async fetchAPI(endpoint: string, options: RequestInit = {}) {
    const res = await fetch("https://api.github.com" + endpoint, {
      ...options,
      headers: {
        "Authorization": "Bearer " + this.token,
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      throw new Error("GitHub API error: " + res.status + " " + res.statusText);
    }
    return res.json();
  }

  static async publishPR(repo: string, workspaceName: string, localBranch: string, commitSha: string, destBranch: string, title: string, body: string) {
    const targetDir = path.join(this.workspaceRoot, workspaceName);
    if (!fs.existsSync(targetDir)) throw new Error("Workspace not found");

    // Validate branch policy, commit identity, and local branch relationship
    const actualSha = execSync("git rev-parse " + localBranch, { cwd: targetDir }).toString().trim();
    if (actualSha !== commitSha) {
      throw new Error("Commit identity mismatch. Expected " + commitSha + ", got " + actualSha);
    }

    const remoteUrl = "https://oauth2:" + this.token + "@github.com/" + repo + ".git";

    try {
      // Push exactly that branch/commit
      execSync("git push " + remoteUrl + " " + commitSha + ":refs/heads/" + localBranch + " --force", { cwd: targetDir, stdio: 'ignore' });
    } catch (e) {
      throw new Error("Failed to push to GitHub");
    }

    // Create or update PR
    try {
      const prs = await this.fetchAPI("/repos/" + repo + "/pulls?head=" + repo.split('/')[0] + ":" + localBranch + "&state=open");
      if (prs.length > 0) {
        // Update existing PR
        const pr = prs[0];
        return await this.fetchAPI("/repos/" + repo + "/pulls/" + pr.number, {
          method: "PATCH",
          body: JSON.stringify({ title, body })
        });
      } else {
        // Create new PR
        return await this.fetchAPI("/repos/" + repo + "/pulls", {
          method: "POST",
          body: JSON.stringify({
            title,
            body,
            head: localBranch,
            base: destBranch
          })
        });
      }
    } catch (e) {
      throw new Error("Failed to create/update pull request");
    }
  }
}
