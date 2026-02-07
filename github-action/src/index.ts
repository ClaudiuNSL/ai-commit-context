import * as core from '@actions/core';
import * as github from '@actions/github';

interface SessionPreview {
  shortCode: string;
  firstUserMessage: string | null;
  fileCount: number;
  repoCount: number;
  url: string;
}

interface CommitContext {
  sha: string;
  message: string;
  sessions: SessionPreview[];
}

const COMMENT_MARKER = '<!-- ai-commit-context -->';

async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const apiUrl = core.getInput('api-url');
    const apiToken = core.getInput('api-token');
    const commentMode = core.getInput('comment-mode');
    const trailerKey = core.getInput('trailer-key');
    const setStatus = core.getInput('set-status') !== 'false';

    const octokit = github.getOctokit(token);
    const context = github.context;

    // Only run on pull requests
    if (!context.payload.pull_request) {
      core.info('Not a pull request event, skipping');
      return;
    }

    const pr = context.payload.pull_request;
    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const prNumber = pr.number;

    core.info(`Processing PR #${prNumber}: ${pr.title}`);

    // Get commits in the PR
    const { data: commits } = await octokit.rest.pulls.listCommits({
      owner,
      repo,
      pull_number: prNumber,
    });

    core.info(`Found ${commits.length} commits in PR`);

    // Parse trailers from commits and fetch session info
    const commitsWithContext: CommitContext[] = [];
    let totalSessions = 0;
    const allSessionUrls: string[] = [];

    for (const commit of commits) {
      const message = commit.commit.message;
      const sessionCodes = parseTrailers(message, trailerKey);

      if (sessionCodes.length === 0) continue;

      const sessions: SessionPreview[] = [];

      for (const sessionCode of sessionCodes) {
        const sessionPreview = await fetchSessionPreview(apiUrl, sessionCode, apiToken);
        if (sessionPreview) {
          sessions.push(sessionPreview);
          allSessionUrls.push(sessionPreview.url);
          totalSessions++;
        }
      }

      if (sessions.length > 0) {
        commitsWithContext.push({
          sha: commit.sha,
          message: commit.commit.message.split('\n')[0], // First line only
          sessions,
        });

        // Set commit status if enabled
        if (setStatus && sessions.length > 0) {
          await setCommitStatus(octokit, owner, repo, commit.sha, sessions[0]);
        }
      }
    }

    core.setOutput('sessions-found', totalSessions);
    core.setOutput('session-url', allSessionUrls[0] || '');

    if (commitsWithContext.length === 0) {
      core.info('No AI context found in commits');
      return;
    }

    core.info(`Found ${totalSessions} AI sessions in ${commitsWithContext.length} commits`);

    // Generate comment body
    const commentBody = generateComment(commitsWithContext);

    // Handle comment based on mode
    if (commentMode === 'none') {
      core.info('Comment mode is "none", skipping comment creation');
      return;
    }

    // Find existing comment
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    const existingComment = comments.find(c => c.body?.includes(COMMENT_MARKER));

    if (existingComment && commentMode === 'update') {
      // Update existing comment
      const { data: updated } = await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingComment.id,
        body: commentBody,
      });
      core.info(`Updated existing comment: ${updated.html_url}`);
      core.setOutput('comment-url', updated.html_url);
    } else if (!existingComment || commentMode === 'create') {
      // Create new comment
      const { data: created } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: commentBody,
      });
      core.info(`Created new comment: ${created.html_url}`);
      core.setOutput('comment-url', created.html_url);
    }

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

/**
 * Parse trailer values from a commit message
 */
function parseTrailers(message: string, trailerKey: string): string[] {
  const ids: string[] = [];
  const lines = message.split('\n');

  for (const line of lines) {
    // Match "AI-Context-ID: value" or "AI-Context-URL: url" patterns
    const idMatch = line.match(new RegExp(`^${trailerKey}:\\s*(.+)$`, 'i'));
    if (idMatch) {
      // Extract short code from URL if present
      const value = idMatch[1].trim();
      const urlMatch = value.match(/\/s\/([a-zA-Z0-9]+)$/);
      if (urlMatch) {
        ids.push(urlMatch[1]);
      } else if (!value.startsWith('http')) {
        // It's a session ID or short code
        ids.push(value);
      }
    }

    // Also check for AI-Context-URL trailer
    const urlMatch = line.match(/^AI-Context-URL:\s*(.+)$/i);
    if (urlMatch) {
      const url = urlMatch[1].trim();
      const codeMatch = url.match(/\/s\/([a-zA-Z0-9]+)$/);
      if (codeMatch && !ids.includes(codeMatch[1])) {
        ids.push(codeMatch[1]);
      }
    }
  }

  return ids;
}

/**
 * Fetch session preview from the API
 */
async function fetchSessionPreview(
  apiUrl: string,
  sessionCode: string,
  apiToken?: string
): Promise<SessionPreview | null> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiToken) {
      headers['Authorization'] = `Bearer ${apiToken}`;
    }

    const response = await fetch(`${apiUrl}/api/sessions/${sessionCode}/preview`, { headers });

    if (!response.ok) {
      // Fallback to full session endpoint
      core.debug(`Preview endpoint failed, trying full session endpoint`);
      return fetchSessionFallback(apiUrl, sessionCode, headers);
    }

    const data = await response.json() as SessionPreview;
    return data;
  } catch (error) {
    core.warning(`Error fetching session ${sessionCode}: ${error}`);
    return null;
  }
}

/**
 * Fallback to full session endpoint if preview doesn't exist
 */
async function fetchSessionFallback(
  apiUrl: string,
  sessionCode: string,
  headers: Record<string, string>
): Promise<SessionPreview | null> {
  try {
    const response = await fetch(`${apiUrl}/api/sessions/${sessionCode}`, { headers });

    if (!response.ok) {
      core.warning(`Failed to fetch session ${sessionCode}: ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      shortCode: string;
      firstUserMessage?: string;
      filesModified?: string[];
      repos?: { filesModified?: string[] }[];
    };

    const baseUrl = apiUrl.replace('/api', '').replace('api.', '');
    const fileCount = data.filesModified?.length ||
      (data.repos?.reduce((sum, r) => sum + (r.filesModified?.length || 0), 0) || 0);

    return {
      shortCode: data.shortCode,
      firstUserMessage: data.firstUserMessage || null,
      fileCount,
      repoCount: data.repos?.length || 0,
      url: `${baseUrl}/s/${data.shortCode}`,
    };
  } catch (error) {
    core.warning(`Error in fallback fetch for ${sessionCode}: ${error}`);
    return null;
  }
}

/**
 * Set commit status with AI context link
 */
async function setCommitStatus(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  sha: string,
  session: SessionPreview
): Promise<void> {
  try {
    await octokit.rest.repos.createCommitStatus({
      owner,
      repo,
      sha,
      state: 'success',
      context: 'commit-context',
      target_url: session.url,
      description: 'AI context linked',
    });
    core.debug(`Set commit status for ${sha.substring(0, 7)}`);
  } catch (error) {
    core.warning(`Failed to set commit status: ${error}`);
  }
}

/**
 * Generate the PR comment body
 */
function generateComment(commits: CommitContext[]): string {
  const totalSessions = commits.reduce((sum, c) => sum + c.sessions.length, 0);
  const totalFiles = commits.reduce((sum, c) =>
    sum + c.sessions.reduce((s, sess) => s + sess.fileCount, 0), 0);

  let body = `${COMMENT_MARKER}\n`;
  body += `## 🤖 AI Context\n\n`;

  // Show first task if available
  const firstSession = commits[0]?.sessions[0];
  if (firstSession?.firstUserMessage) {
    body += `**Task:** "${firstSession.firstUserMessage}"\n\n`;
  }

  body += `**Changes:** ${totalFiles} files across ${commits.length} commit${commits.length !== 1 ? 's' : ''}\n\n`;

  // Compact session list
  if (totalSessions === 1 && firstSession) {
    body += `[View full conversation](${firstSession.url})\n\n`;
  } else {
    body += `### Conversations\n\n`;
    for (const commit of commits) {
      const shortSha = commit.sha.substring(0, 7);
      for (const session of commit.sessions) {
        body += `- \`${shortSha}\`: `;
        if (session.firstUserMessage) {
          const truncated = session.firstUserMessage.length > 60
            ? session.firstUserMessage.substring(0, 57) + '...'
            : session.firstUserMessage;
          body += `"${truncated}" `;
        }
        body += `([view](${session.url}))\n`;
      }
    }
    body += '\n';
  }

  body += `---\n`;
  body += `*Generated by [AI Commit Context](https://github.com/ai-commit-context/action)*`;

  return body;
}

run();
