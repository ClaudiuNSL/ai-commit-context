import * as core from '@actions/core';
import * as github from '@actions/github';

interface SessionInfo {
  id: string;
  shortCode: string;
  url: string;
  projectName: string;
  messageCount: number;
  startedAt: string;
  excerpt?: string;
}

interface CommitContext {
  sha: string;
  message: string;
  sessions: SessionInfo[];
}

const COMMENT_MARKER = '<!-- ai-commit-context -->';

async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const apiUrl = core.getInput('api-url');
    const apiToken = core.getInput('api-token');
    const commentMode = core.getInput('comment-mode');
    const showExcerpts = core.getInput('show-excerpts') === 'true';
    const trailerKey = core.getInput('trailer-key');

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

    for (const commit of commits) {
      const message = commit.commit.message;
      const sessionIds = parseTrailers(message, trailerKey);

      if (sessionIds.length === 0) continue;

      const sessions: SessionInfo[] = [];

      for (const sessionId of sessionIds) {
        const sessionInfo = await fetchSessionInfo(apiUrl, sessionId, apiToken);
        if (sessionInfo) {
          sessions.push(sessionInfo);
          totalSessions++;
        }
      }

      if (sessions.length > 0) {
        commitsWithContext.push({
          sha: commit.sha,
          message: commit.commit.message.split('\n')[0], // First line only
          sessions,
        });
      }
    }

    core.setOutput('sessions-found', totalSessions);

    if (commitsWithContext.length === 0) {
      core.info('No AI context found in commits');
      return;
    }

    core.info(`Found ${totalSessions} AI sessions in ${commitsWithContext.length} commits`);

    // Generate comment body
    const commentBody = generateComment(commitsWithContext, showExcerpts);

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
    // Match "AI-Context-ID: value" or similar patterns
    const match = line.match(new RegExp(`^${trailerKey}:\\s*(.+)$`, 'i'));
    if (match) {
      ids.push(match[1].trim());
    }
  }

  return ids;
}

/**
 * Fetch session info from the API
 */
async function fetchSessionInfo(
  apiUrl: string,
  sessionId: string,
  apiToken?: string
): Promise<SessionInfo | null> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiToken) {
      headers['Authorization'] = `Bearer ${apiToken}`;
    }

    const response = await fetch(`${apiUrl}/api/sessions/${sessionId}`, { headers });

    if (!response.ok) {
      core.warning(`Failed to fetch session ${sessionId}: ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      id: string;
      shortCode: string;
      projectName: string;
      messageCount: number;
      startedAt: string;
      messages?: Array<{ type: string; message: { content: string | unknown[] } }>;
    };

    // Extract first user message as excerpt
    let excerpt: string | undefined;
    if (data.messages) {
      const firstUserMsg = data.messages.find(m => m.type === 'user');
      if (firstUserMsg && typeof firstUserMsg.message.content === 'string') {
        excerpt = firstUserMsg.message.content.substring(0, 200);
        if (firstUserMsg.message.content.length > 200) {
          excerpt += '...';
        }
      }
    }

    const baseUrl = apiUrl.replace('/api', '').replace('api.', '');

    return {
      id: data.id,
      shortCode: data.shortCode,
      url: `${baseUrl}/c/${data.shortCode}`,
      projectName: data.projectName,
      messageCount: data.messageCount,
      startedAt: data.startedAt,
      excerpt,
    };
  } catch (error) {
    core.warning(`Error fetching session ${sessionId}: ${error}`);
    return null;
  }
}

/**
 * Generate the PR comment body
 */
function generateComment(commits: CommitContext[], showExcerpts: boolean): string {
  const totalSessions = commits.reduce((sum, c) => sum + c.sessions.length, 0);

  let body = `${COMMENT_MARKER}\n`;
  body += `## AI Development Context\n\n`;
  body += `This PR includes code developed with AI assistance. `;
  body += `Found **${totalSessions} conversation${totalSessions !== 1 ? 's' : ''}** `;
  body += `across **${commits.length} commit${commits.length !== 1 ? 's' : ''}**.\n\n`;

  // Summary table
  body += `| Commit | Conversation | Messages | Files |\n`;
  body += `|--------|--------------|----------|-------|\n`;

  for (const commit of commits) {
    const shortSha = commit.sha.substring(0, 7);

    for (const session of commit.sessions) {
      body += `| \`${shortSha}\` | `;
      body += `[View conversation](${session.url}) | `;
      body += `${session.messageCount} | `;
      body += `${session.projectName} |\n`;
    }
  }

  // Excerpts section
  if (showExcerpts) {
    body += `\n<details>\n<summary>View conversation excerpts</summary>\n\n`;

    for (const commit of commits) {
      for (const session of commit.sessions) {
        if (session.excerpt) {
          body += `### Commit \`${commit.sha.substring(0, 7)}\`\n\n`;
          body += `> ${session.excerpt.replace(/\n/g, '\n> ')}\n\n`;
          body += `[View full conversation \u2192](${session.url})\n\n`;
          body += `---\n\n`;
        }
      }
    }

    body += `</details>\n`;
  }

  body += `\n---\n`;
  body += `*Generated by [AI Commit Context](https://github.com/ai-commit-context/action)*`;

  return body;
}

run();
