import { redirect } from "next/navigation";

export default function TripImportPage() {
  redirect("/studio?step=upload");
}
