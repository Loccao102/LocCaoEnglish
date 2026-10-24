import Link from "next/link";

export default function ProgressionNotice({ status, needsSignIn, refresh, signInLabel = "Sign in for personal progress" }: {
  status: "loading" | "guest" | "ready" | "error";
  needsSignIn: boolean;
  refresh: () => void;
  signInLabel?: string;
}) {
  return <div className="village-connection progression-notice" role={status === "error" ? "alert" : "status"}>
    <p>{status === "guest" ? "Sign in to see your own worlds and rewards. You can explore and practise as a guest." : status === "loading" ? "Loading your saved worlds and rewards…" : needsSignIn ? "Sign in again to see your saved worlds and rewards." : "Your progress is unavailable. Your saved worlds and rewards are unchanged."}</p>
    {(status === "guest" || needsSignIn) && <Link className="button ghost" href="/account">{needsSignIn ? "Sign in again" : signInLabel}</Link>}
    {status === "error" && <button className="button ghost" onClick={refresh}>Retry loading progress</button>}
  </div>;
}
