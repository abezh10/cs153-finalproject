const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY',
  'PEXELS_API_KEY',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SPOTIFY_REDIRECT_URI',
  'DEMO_USER_ID',
  'DEV_TOOLS_TOKEN',
];

export function EnvStatusTable() {
  return (
    <table className="text-sm w-full">
      <thead>
        <tr className="text-left text-zinc-500">
          <th className="py-1 pr-4">Variable</th>
          <th className="py-1">Status</th>
        </tr>
      </thead>
      <tbody>
        {REQUIRED.map((name) => {
          const set = process.env[name] !== undefined && process.env[name] !== '';
          return (
            <tr key={name} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-1.5 pr-4 font-mono text-xs">{name}</td>
              <td className="py-1.5">
                <span className={set ? 'text-green-600' : 'text-red-600'}>
                  {set ? '✓ set' : '✗ missing'}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
