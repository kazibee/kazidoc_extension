# @kazibee/kazidoc

Kazibee extension for [Kazidoc](https://kazidoc.com) — work with one Kazidoc
project as a remote filesystem: navigate folders, read and grep text files,
write and edit documents (including span-handle range edits), and reorganize
the tree. Includes first-class support for CSV workbook folders
(`pricing.csv/` with tab files and `index.css` styling).

Backed by the Kazidoc agent API (`api.kazidoc.com`), authenticated with a
project-scoped `kzd_` API key.

## Setup

Create an API key in the Kazidoc web app under **Settings → API keys**
(shown exactly once), then:

```bash
kazibee kazidoc login <API_KEY> <PROJECT_ID>
# local development against a dev server:
kazibee kazidoc login <API_KEY> <PROJECT_ID> http://localhost:6005
```

The login command verifies the credentials against the live API before
storing them as tool env vars (`KAZIDOC_API_KEY`, `KAZIDOC_PROJECT_ID`,
optional `KAZIDOC_API_URL`).

## Usage (code sandbox)

```ts
export default async function ({ tools }) {
  const kazidoc = tools["kazidoc"];
  const root = await kazidoc.listdir();
  await kazidoc.write("notes/summary.md", "# Summary\n\n...");
  const range = await kazidoc.readRange("notes/long.md", 120, 160);
  if (range.ok) await kazidoc.rangeReplace(range.handleId, "new section text");
  return root;
}
```

See `llm.txt` for the full verb reference, reading/editing rules, and the
CSV workbook convention.

## Layout

- `src/index.ts` — `main(env)` entry returning the typed client
- `src/client.ts` — API client (14 verbs, error envelopes passed through)
- `src/command.ts` — `login` setup command
- `llm.txt` — model-facing manual
- `permissions.json` — network + env grants
