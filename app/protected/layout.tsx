import { redirect } from "next/navigation";

export default function ProtectedLayout() {
  redirect("/dashboard");
}
