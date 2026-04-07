import { redirect } from "next/navigation";

export default function BookPreviewPage() {
  redirect("/studio?step=preview");
}
