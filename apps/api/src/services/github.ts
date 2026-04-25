import { Octokit } from "@octokit/rest";
import { decryptToken } from "../lib/crypto.js";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";

const CACHE_TTL = 300; // 5 min
const MAX_FILE_SIZE = 200 * 1024;
const MAX_FILES_PER_ANALYSIS = 200;

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", ".next", ".nuxt",
  "vendor", "target", "__pycache__", ".venv", "venv", "env",
  "coverage", ".cache", ".parcel-cache", ".turbo",
]);

const SKIP_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".bmp",
  ".mp4", ".mov", ".avi", ".webm", ".mp3", ".wav", ".ogg",
  ".pdf", ".zip", ".tar", ".gz", ".7z", ".rar",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".exe", ".dll", ".so", ".dylib", ".class", ".jar",
  ".lock",
  ".min.js", ".min.css",
]);

export const SUPPORTED_EXTENSIONS: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
};

export class GitHubService {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
      request: { timeout: 10_000 },
    });
  }

  static async forUser(userId: string): Promise<GitHubService> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { githubTokenEnc: true, githubTokenIv: true, githubTokenTag: true },
    });
    const token = decryptToken(user.githubTokenEnc, user.githubTokenIv, user.githubTokenTag);
    return new GitHubService(token);
  }

  async listRepos(): Promise<RepoDto[]> {
    const repos: RepoDto[] = [];
    let page = 1;
    while (true) {
      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        per_page: 100,
        page,
        sort: "pushed",
        affiliation: "owner,collaborator",
      });
      repos.push(...data.map(mapRepo));
      if (data.length < 100) break;
      page += 1;
      if (page > 10) break;
    }
    return repos;
  }

  async getFileTree(owner: string, repo: string, branch: string): Promise<TreeEntry[]> {
    const cacheKey = `gh:tree:${owner}/${repo}@${branch}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as TreeEntry[];

    const { data: branchData } = await this.octokit.repos.getBranch({ owner, repo, branch });
    const sha = branchData.commit.sha;

    const { data: tree } = await this.octokit.git.getTree({
      owner,
      repo,
      tree_sha: sha,
      recursive: "1",
    });

    const entries: TreeEntry[] = (tree.tree as any[])
      .filter((e) => e.type === "blob" && !!e.path && typeof e.size === "number")
      .map((e) => ({ path: e.path as string, sha: e.sha as string, size: e.size as number, type: "blob" as const }));

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(entries));
    return entries;
  }

  filterFiles(entries: TreeEntry[]): { keep: TreeEntry[]; skipped: SkippedFile[] } {
    const keep: TreeEntry[] = [];
    const skipped: SkippedFile[] = [];

    for (const entry of entries) {
      const reason = this.skipReason(entry);
      if (reason) {
        skipped.push({ path: entry.path, reason });
      } else {
        keep.push(entry);
      }
    }

    keep.sort((a, b) => a.path.length - b.path.length);
    if (keep.length > MAX_FILES_PER_ANALYSIS) {
      const overflow = keep.splice(MAX_FILES_PER_ANALYSIS);
      skipped.push(...overflow.map((e) => ({ path: e.path, reason: "file-limit" as SkipReason })));
    }

    return { keep, skipped };
  }

  private skipReason(e: TreeEntry): SkipReason | null {
    const parts = e.path.split("/");
    if (parts.some((p) => SKIP_DIRS.has(p))) return "ignored-dir";
    if (parts.some((p) => p.startsWith("."))) return "dotfile";

    const lower = e.path.toLowerCase();
    for (const ext of SKIP_EXTENSIONS) {
      if (lower.endsWith(ext)) return "binary-or-minified";
    }

    const dotIdx = lower.lastIndexOf(".");
    const ext = dotIdx !== -1 ? lower.slice(dotIdx) : "";
    if (!SUPPORTED_EXTENSIONS[ext]) return "unsupported-language";

    if (e.size > MAX_FILE_SIZE) return "too-large";
    if (e.size === 0) return "empty";

    return null;
  }

  async getFileContent(owner: string, repo: string, sha: string): Promise<string | null> {
    try {
      const { data } = await this.octokit.git.getBlob({ owner, repo, file_sha: sha });
      if (data.encoding !== "base64") return null;
      const buf = Buffer.from(data.content, "base64");
      if (buf.subarray(0, 8192).includes(0)) return null;
      return buf.toString("utf8");
    } catch (err: any) {
      if (err.status === 404) return null;
      if (err.status === 403 && String(err.message).includes("rate limit")) {
        throw new GitHubRateLimitError();
      }
      throw err;
    }
  }

  async getRateLimit(): Promise<{ remaining: number; resetAt: Date }> {
    const { data } = await this.octokit.rateLimit.get();
    return {
      remaining: data.rate.remaining,
      resetAt: new Date(data.rate.reset * 1000),
    };
  }
}

export type SkipReason =
  | "ignored-dir"
  | "dotfile"
  | "binary-or-minified"
  | "unsupported-language"
  | "too-large"
  | "empty"
  | "file-limit";

export interface TreeEntry {
  path: string;
  sha: string;
  size: number;
  type: "blob";
}

export interface SkippedFile {
  path: string;
  reason: SkipReason;
}

export interface RepoDto {
  githubId: number;
  fullName: string;
  name: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  language: string | null;
  htmlUrl: string;
  starsCount: number;
  pushedAt: string | null;
}

function mapRepo(r: any): RepoDto {
  return {
    githubId: r.id,
    fullName: r.full_name,
    name: r.name,
    description: r.description ?? null,
    private: r.private,
    defaultBranch: r.default_branch,
    language: r.language ?? null,
    htmlUrl: r.html_url,
    starsCount: r.stargazers_count,
    pushedAt: r.pushed_at ?? null,
  };
}

export class GitHubRateLimitError extends Error {
  constructor() {
    super("GitHub rate limit exceeded");
  }
}
