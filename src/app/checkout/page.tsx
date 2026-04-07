import { redirect } from "next/navigation";

export default function CheckoutPage() {
  redirect("/studio?step=publish");
}
