import { createClient } from "@/lib/supabase/server";

export default async function TestDatabasePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("important_files")
    .select("id, title, original_filename")
    .limit(10);

  if (error) {
    return <pre>{error.message}</pre>;
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Database Test</h1>

      <pre className="mt-4">
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  );
}