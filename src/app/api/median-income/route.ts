import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const size = searchParams.get('size');

    if (!year || !size) {
        return NextResponse.json({ error: 'Missing year or size parameters' }, { status: 400 });
    }

    const stmt = db.prepare('SELECT amount FROM standard_median_income WHERE year = ? AND household_size = ?');
    const result = stmt.get(year, size) as { amount: number } | undefined;

    return NextResponse.json({ amount: result ? result.amount : 0 }); // Return 0 if not found
  } catch (error) {
    console.error('Failed to fetch specific median income:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
