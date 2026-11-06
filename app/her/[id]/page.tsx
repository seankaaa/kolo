import { redirect } from "next/navigation";

/** Old provider-id profile URLs now live at /me (mock login). */
export default function Page() {
  redirect("/me");
}
