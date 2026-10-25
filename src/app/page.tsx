import { redirect } from "next/navigation";

// The member panel is the app; the proxy sends signed-out visitors to /login.
export default function Home() {
  redirect("/dashboard");
}
