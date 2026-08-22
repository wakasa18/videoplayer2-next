import { AssignmentCollection } from "@/components/assignments/assignment-collection";
import { getAssignmentCollection } from "@/lib/assignments/data";

export const metadata = { title: "Assignment Recycle Bin" };

export default async function AssignmentRecyclePage() {
  const result = await getAssignmentCollection("recycle");
  return <AssignmentCollection mode="recycle" result={result} />;
}
