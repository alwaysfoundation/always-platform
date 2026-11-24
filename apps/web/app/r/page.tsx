import { SharedReport } from '@/lib/shared-report';

/** What a funder sees from a share link (/r/<token>): a frozen, de-identified report. No sign-in. */
export default function Shared() {
  return <SharedReport />;
}
