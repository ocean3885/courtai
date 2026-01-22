'use client';

import React from 'react';
import Link from 'next/link';

export function Footer() {
    return (
        <footer className="bg-gray-50 border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 text-left">
                    {/* Logo & Info */}
                    <div className="md:col-span-1 space-y-6">
                        <Link href="/" className="flex items-center space-x-2">
                            <span className="text-2xl font-black tracking-tight text-blue-600">Court-Easy</span>
                        </Link>
                        <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
                            법원 업무의 새로운 기준, 지능형 지원 시스템으로
                            더 빠르고 정확한 법률 실무를 지원합니다.
                        </p>
                        <div className="flex space-x-4 pt-2">
                            {/* Simple Social Placeholders */}
                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer">
                                <span>𝕏</span>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer">
                                <span>f</span>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer">
                                <span>in</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-bold text-gray-900 mb-6 underline-offset-8 decoration-2 decoration-blue-600">서비스</h4>
                        <ul className="space-y-4 text-sm text-gray-600">
                            <li><Link href="#" className="hover:text-blue-600 transition-colors">기타집행 지원</Link></li>
                            <li><Link href="#" className="hover:text-blue-600 transition-colors">이용 안내</Link></li>
                        </ul>
                    </div>

                    {/* Policy */}
                    <div>
                        <h4 className="font-bold text-gray-900 mb-6">법적 고지</h4>
                        <ul className="space-y-4 text-sm text-gray-600">
                            <li><Link href="#" className="hover:text-blue-600 transition-colors">이용약관</Link></li>
                            <li><Link href="#" className="hover:text-blue-600 transition-colors text-blue-600 font-semibold">개인정보처리방침</Link></li>
                            <li><Link href="#" className="hover:text-blue-600 transition-colors">쿠키 정책</Link></li>
                            <li><Link href="#" className="hover:text-blue-600 transition-colors">법적 고지</Link></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="font-bold text-gray-900 mb-6">고객 지원</h4>
                        <div className="space-y-4 text-sm text-gray-600">
                            <p className="flex items-center gap-2">
                                <span className="text-gray-400">📧</span> help@courteasy.kr
                            </p>
                            <p className="flex items-center gap-2">
                                <span className="text-gray-400">📞</span> 1588-0000
                            </p>
                            <p className="flex items-center gap-2">
                                <span className="text-gray-400">📍</span> 서울특별시 서초구 서초대로
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bottom Banner */}
                <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 text-xs tracking-wide">
                    <p className="text-gray-400">
                        &copy; {new Date().getFullYear()} Court-Easy. All rights reserved.
                    </p>
                    <div className="flex space-x-6 text-gray-400">
                        <span className="text-blue-600/60 font-medium tracking-[0.1em]">AI-POWERED COURT SOLUTIONS</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
