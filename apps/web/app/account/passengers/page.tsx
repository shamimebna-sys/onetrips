import { redirect } from "next/navigation";

export default function PassengersRedirect() {
  redirect("/account/travelers");
}
