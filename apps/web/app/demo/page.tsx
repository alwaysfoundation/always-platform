'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { startDemo } from '@/lib/demo';

/** Opens the demo account: a made-up church that lives only in this browser. */
export default function Demo() {
  const router = useRouter();
  useEffect(() => { startDemo(); router.replace('/home?welcome=1'); }, [router]);
  return null;
}
