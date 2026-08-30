import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-12">
      {/*
        New accounts land on the optional parent-details step. This prop belongs
        to <SignUp>, so it fires only on registration — signing in goes wherever
        it was already going and a returning user never sees onboarding again.
      */}
      <SignUp forceRedirectUrl="/onboarding" />
    </div>
  );
}
