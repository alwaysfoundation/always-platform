'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getAuth } from '@/lib/auth';

/** Signed in: your home. New here: start. */
export default function Root() {
  const router = useRouter();
  useEffect(() => { router.replace(getAuth() ? '/home' : '/start'); }, [router]);
  return null;
}
