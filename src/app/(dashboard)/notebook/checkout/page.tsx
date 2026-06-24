import { redirect } from "next/navigation";

export default function NotebookCheckoutRedirect() {
  redirect("/checkout");
}
