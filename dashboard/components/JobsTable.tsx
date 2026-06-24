import type { JobRow } from "@/lib/types";
import { isNew } from "@/lib/status";

export function JobsTable({
  jobs,
  nowIso,
  windowHours,
}: {
  jobs: JobRow[];
  nowIso: string;
  windowHours: number;
}) {
  const now = new Date(nowIso);
  if (jobs.length === 0) {
    return <p className="px-6 py-10 text-center text-gray-500">No matching roles.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase text-gray-500">
        <tr className="border-b">
          <th className="px-6 py-2">Company</th>
          <th className="px-6 py-2">Title</th>
          <th className="px-6 py-2">Location</th>
          <th className="px-6 py-2">First seen</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((j) => (
          <tr key={j.id} className="border-b hover:bg-gray-50">
            <td className="px-6 py-2 text-gray-700">{j.company_name}</td>
            <td className="px-6 py-2">
              <a
                href={j.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 hover:underline"
              >
                {j.title}
              </a>
              {isNew(j.first_seen_at, now, windowHours) && (
                <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-700">
                  New
                </span>
              )}
              {j.remote && (
                <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                  Remote
                </span>
              )}
            </td>
            <td className="px-6 py-2 text-gray-600">{j.location ?? "—"}</td>
            <td className="px-6 py-2 text-gray-600">
              {new Date(j.first_seen_at).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
