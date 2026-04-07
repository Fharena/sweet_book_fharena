import { redirect } from "next/navigation";

export default function TripReviewPage() {
  redirect("/studio?step=review");
}
