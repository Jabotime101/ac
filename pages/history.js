import { supabase } from '../lib/supabase';

export async function getServerSideProps() {
  const { data, error } = await supabase
    .from('transcriptions')
    .select('id, filename, created_at')
    .order('created_at', { ascending: false });

  return { props: { rows: data ?? [], error } };
}

export default function History({ rows }) {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Transcription History</h1>
      <ul className="space-y-2">
        {rows.map(r => (
          <li key={r.id} className="border p-3 rounded">
            <strong>{r.filename}</strong>
            <span className="ml-2 text-sm text-gray-500">
              {new Date(r.created_at).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
} 