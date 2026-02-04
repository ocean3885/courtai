import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const stmt = db.prepare('SELECT * FROM standard_median_income ORDER BY year DESC, household_size ASC');
    const data = stmt.all();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch median income data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Check for bulk insert/update
    if (body.year && body.items && Array.isArray(body.items)) {
        const { year, items } = body;
        
        const insertOrUpdate = db.transaction((dataItems: any[]) => {
            const stmt = db.prepare(`
                INSERT INTO standard_median_income (year, household_size, amount) 
                VALUES (?, ?, ?)
                ON CONFLICT(year, household_size) 
                DO UPDATE SET amount = excluded.amount
            `);
            
            for (const item of dataItems) {
                if (item.household_size && item.amount) {
                    stmt.run(year, item.household_size, item.amount);
                }
            }
        });

        insertOrUpdate(items);
        return NextResponse.json({ message: 'Bulk update successful' }, { status: 201 });
    }

    // Single item insert (backward compatibility)
    const { year, household_size, amount } = body;

    if (!year || !household_size || !amount) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const stmt = db.prepare('INSERT INTO standard_median_income (year, household_size, amount) VALUES (?, ?, ?)');
    const result = stmt.run(year, household_size, amount);

    return NextResponse.json({ id: result.lastInsertRowid, year, household_size, amount }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return NextResponse.json({ error: 'Duplicate entry for this year and household size' }, { status: 409 });
    }
    console.error('Failed to create median income entry:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, amount } = body;

        if (!id || !amount) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const stmt = db.prepare('UPDATE standard_median_income SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'); // Note: no updated_at column in my schema, oops. Let's checking schema again.
        // Schema: year, household_size, amount, created_at. No updated_at.
        // I will just update amount.
        
        const updateStmt = db.prepare('UPDATE standard_median_income SET amount = ? WHERE id = ?');
        const result = updateStmt.run(amount, id);

        if (result.changes === 0) {
            return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Updated successfully' });
    } catch (error) {
        console.error('Failed to update median income:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        }

        const stmt = db.prepare('DELETE FROM standard_median_income WHERE id = ?');
        const result = stmt.run(id);

        if (result.changes === 0) {
            return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Deleted successfully' });
    } catch (error) {
        console.error('Failed to delete median income:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
