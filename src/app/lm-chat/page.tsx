'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MainLayout } from '@/components/layout';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function LMChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [isChecking, setIsChecking] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const checkConnection = async (showLoading = false) => {
        if (showLoading) setIsChecking(true);
        try {
            const response = await fetch('/api/lm-proxy', {
                method: 'GET',
                cache: 'no-store' // Force no cache
            });
            const data = await response.json();
            setIsConnected(data.status === 'connected');
        } catch (error) {
            console.error('Connection check failed:', error);
            setIsConnected(false);
        } finally {
            setIsChecking(false);
        }
    };

    useEffect(() => {
        // Initial check triggers immediately with isChecking=true
        checkConnection();
        // Check connection every 30 seconds silently
        const interval = setInterval(() => checkConnection(false), 30000);
        return () => clearInterval(interval);
    }, []);

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        if (messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
        }
    };

    useEffect(() => {
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            // Use 'auto' (instant) for user messages to keep focus on the message list
            scrollToBottom(lastMessage.role === 'user' ? 'auto' : 'smooth');
        }
    }, [messages]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.txt')) {
            alert('TXT 파일만 첨부할 수 있습니다.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setAttachedFile({ name: file.name, content });
            // Reset file input so same file can be selected again if removed
            e.target.value = '';
        };
        reader.readAsText(file);
    };

    const removeFile = () => {
        setAttachedFile(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const originalInput = input;
        let finalInput = input;

        // If file is attached, prepend context
        if (attachedFile) {
            finalInput = `[Context from file: ${attachedFile.name}]\n${attachedFile.content}\n\n[User Question/Instruction]\n${originalInput}`;
        }

        const userMessage: Message = { role: 'user', content: originalInput };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/lm-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [...messages, { role: 'user', content: finalInput }],
                    model: 'local-model', // LM Studio typically ignores this or uses the loaded one
                    temperature: 0.7,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response from LM Studio');
            }

            const data = await response.json();
            let content = data.choices[0].message.content;

            // Remove <think>...</think> blocks and any unclosed <think> content
            content = content.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*/g, '').trim();

            const assistantMessage: Message = {
                role: 'assistant',
                content: content,
            };
            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error: any) {
            console.error('Chat error:', error);
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: `Error: ${error.message}. Please check if LM Studio is running and accessible.` },
            ]);
        } finally {
            setIsLoading(false);
            // Focus the input field after a short delay to ensure UI is ready
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    };

    return (
        <MainLayout wide>
            <div className="flex flex-col h-[calc(100vh-8rem)] w-full mx-auto p-4 md:p-6">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 tracking-tight">
                            LM Studio Chat
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">지능형 로컬 언어 모델 인터페이스 (TXT 파일 지원)</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className={`inline-block w-3 h-3 rounded-full transition-all duration-500 ${isChecking ? 'bg-gray-400 animate-pulse' :
                            isConnected === true ? (isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]') :
                                isConnected === false ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                                    'bg-gray-300'
                            }`}></span>
                        <span className="text-xs font-medium text-gray-600 transition-all">
                            {isChecking ? '연결 확인 중...' :
                                isConnected === true ? (isLoading ? 'AI가 생각 중...' : '연결됨') :
                                    isConnected === false ? '연결 안됨' :
                                        '준비 중'}
                        </span>
                    </div>
                </div>

                {/* Chat Area - Glassmorphism Effect */}
                <div className="flex-1 overflow-y-auto mb-6 p-6 rounded-3xl bg-white/40 backdrop-blur-xl border border-white/20 shadow-2xl space-y-6 custom-scrollbar">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-70">
                            <div className="w-20 h-20 bg-blue-100/50 rounded-full flex items-center justify-center text-4xl animate-bounce">
                                🤖
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">무엇이든 물어보세요</h3>
                                <p className="text-gray-500 max-w-sm mt-2">로컬에서 구동 중인 대형 언어 모델과 대화를 시작할 수 있습니다.<br />TXT 파일을 첨부하면 해당 내용을 바탕으로 대화할 수 있습니다.</p>
                            </div>
                        </div>
                    )}

                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <div
                                className={`max-w-[95%] md:max-w-[85%] px-5 py-3 rounded-2xl shadow-sm transition-all hover:shadow-md ${msg.role === 'user'
                                    ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-none'
                                    : 'bg-white/80 text-gray-800 rounded-tl-none border border-gray-100'
                                    }`}
                            >
                                <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                                {msg.role === 'assistant' && (
                                    <div className="mt-2 text-[10px] opacity-40 uppercase tracking-widest font-bold">LM Studio Assistant</div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start animate-fade-in">
                            <div className="bg-white/80 px-5 py-4 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex space-x-2 items-center">
                                <div className="flex space-x-1">
                                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-12" />
                </div>

                {/* Input Area */}
                <div className="space-y-3">
                    {attachedFile && (
                        <div className="flex items-center space-x-2 animate-fade-in">
                            <div className="flex items-center bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-blue-100 shadow-sm">
                                <span className="mr-2">📄</span>
                                <span className="truncate max-w-[200px]">{attachedFile.name}</span>
                                <button
                                    onClick={removeFile}
                                    className="ml-2 w-4 h-4 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center hover:bg-blue-300 transition-colors"
                                    aria-label="파일 제거"
                                >
                                    &times;
                                </button>
                            </div>
                            <span className="text-[10px] text-gray-400 italic">파일 내용이 질문에 포함됩니다.</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="relative group flex items-center space-x-2">
                        <div className="relative flex-1">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={isLoading}
                                placeholder={attachedFile ? "첨부된 파일에 대해 질문하세요..." : "메시지를 입력하세요..."}
                                className="w-full px-6 py-4 pr-16 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-lg group-hover:shadow-xl disabled:bg-gray-50 disabled:cursor-not-allowed"
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 transition-all active:scale-95 shadow-lg flex items-center justify-center"
                                aria-label="보내기"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>

                        {/* File Upload Trigger */}
                        <div className="shrink-0">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".txt"
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isLoading}
                                className="p-4 bg-white border border-gray-200 text-gray-500 rounded-2xl hover:text-blue-600 hover:border-blue-600 transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center"
                                title="TXT 파일 첨부"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                            </button>
                        </div>
                    </form>
                </div>

                <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.05);
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(0, 0, 0, 0.1);
          }
          @keyframes slide-up {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-slide-up {
            animation: slide-up 0.4s ease-out forwards;
          }
          @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .animate-fade-in {
            animation: fade-in 0.3s ease-out forwards;
          }
        `}</style>
            </div>
        </MainLayout>
    );
}
