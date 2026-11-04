import { notFound } from "next/navigation";
import { canSendEmail } from "@/lib/email";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  if (!canSendEmail()) notFound();
  return <ForgotForm />;
}
