'use client';

import React from 'react';
import Link from 'next/link';

export function Footer() {
    return (
        <footer className="border-l border-t border-slate-200 bg-white">
            <div className="flex flex-col gap-4 px-6 py-5 text-xs text-slate-500 md:flex-row md:items-center md:justify-between md:px-7">
                <p>&copy; {new Date().getFullYear()} Court-Easy. All rights reserved.</p>
                <div className="flex gap-7">
                    <Link href="#" className="hover:text-blue-600">이용약관</Link>
                    <Link href="#" className="hover:text-blue-600">개인정보처리방침</Link>
                    <Link href="#" className="hover:text-blue-600">고객지원</Link>
                </div>
            </div>
        </footer>
    );
}
