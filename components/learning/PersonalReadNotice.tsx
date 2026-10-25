import Link from "next/link";
import type { AccountResource } from "./useAccountResource";
import styles from "./PersonalReadNotice.module.css";

type PersonalReadKind = "campaign" | "learning";
type NoticeProps = Pick<AccountResource<unknown>, "status" | "needsSignIn" | "refresh"> & {
  kind: PersonalReadKind;
};

export default function PersonalReadNotice({ kind, status, needsSignIn, refresh }: NoticeProps) {
  const subject = kind === "campaign" ? "campaign progress" : "learning summary";
  const saved = kind === "campaign" ? "Your saved chapters are unchanged." : "Your learning records are unchanged.";
  const message = status === "guest"
    ? `Sign in to see your own ${subject}. You can explore and practise as a guest.`
    : status === "loading"
      ? `Loading your saved ${subject}…`
      : needsSignIn
        ? `Sign in again to see your saved ${subject}.`
        : `Your ${subject} is unavailable. ${saved}`;

  return <div className={styles.notice} role={status === "error" ? "alert" : "status"}>
    <p>{message}</p>
    <div className={styles.actions}>
      {(status === "guest" || needsSignIn) && <Link className={styles.action} href="/account">
        {needsSignIn ? "Sign in again" : `Sign in for ${subject}`}
      </Link>}
      {status === "error" && <button type="button" className={styles.action} onClick={refresh}>
        {kind === "campaign" ? "Retry loading campaign" : "Retry loading learning summary"}
      </button>}
    </div>
  </div>;
}

export function PersonalReadRefresh({ kind, refresh }: {
  kind: PersonalReadKind;
  refresh: () => void;
}) {
  return <button type="button" className={styles.action} onClick={refresh}>
    {kind === "campaign" ? "Refresh campaign progress" : "Refresh learning summary"}
  </button>;
}
