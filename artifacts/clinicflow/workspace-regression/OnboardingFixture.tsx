import { NativeAuthProvider } from "../src/auth/native-auth";
import { ClinicRegistration } from "../src/components/ClinicRegistration";
import { ToastHost } from "../src/components/ToastHost";

/** Isolated browser host only. Every API request is supplied by the test's disposable backend. */
export function OnboardingFixture() {
  return <NativeAuthProvider><ToastHost/><ClinicRegistration/></NativeAuthProvider>;
}
