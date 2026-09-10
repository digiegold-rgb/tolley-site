export const metadata = { robots: { index: false, follow: true } };
export default function CourseWaitlistLayout({ children }: { children: React.ReactNode }) {
  return <><div className="mx-auto max-w-4xl px-5 pt-8 text-center text-sm text-amber-200">These courses are in development. Join a waitlist for launch updates; course access is not available yet.</div>{children}</>;
}
