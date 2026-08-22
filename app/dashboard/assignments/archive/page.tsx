import { AssignmentCollection } from "@/components/assignments/assignment-collection";
import { getAssignmentCollection } from "@/lib/assignments/data";

export const metadata = { title: "Archived Assignments" };

export default async function ArchivedAssignmentsPage() {
  const result = await getAssignmentCollection("archived");
  return <AssignmentCollection mode="archive" result={result} />;
}
