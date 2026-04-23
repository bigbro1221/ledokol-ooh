import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

export function GET() {
  const token = randomBytes(32).toString('hex');
  const response = NextResponse.json({ token });
  response.cookies.set('ledokol.csrf', token, {
    httpOnly: false,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 10,
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
