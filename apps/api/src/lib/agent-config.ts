// Agent configuration Markdown generator.

const PLACEHOLDER_INSTANCE = "<instance_id>";

export function buildAgentConfigMarkdown(
  hubUrl: string,
  exampleId: string | null,
  token: string,
): string {
  const id = exampleId || PLACEHOLDER_INSTANCE;

  return `# IDA Hub Agent Config

## Connection

- **Hub URL:** \`${hubUrl}\`
- **Token:** \`${token}\`
- **Instance ID:** \`${id}\`

## API Endpoints

- \`GET /api/instances\` — 列出当前用户的 IDA 实例
- \`POST /api/execute\` — 执行代码（body: \`{"instance_id": "...", "code": "..."}\`）

## Quick Check

\`\`\`bash
curl -s ${hubUrl}/api/instances -H 'Authorization: Bearer ${token}'
\`\`\`
`;
}
