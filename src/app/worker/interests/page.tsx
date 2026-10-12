import { redirect } from "next/navigation";

export default function WorkerInterestsRedirectPage(): never {
  redirect("/worker/requests");
}
