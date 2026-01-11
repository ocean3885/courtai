import { useState, useCallback, useEffect } from 'react';

export type OpType = 'add' | 'sub' | 'mul' | 'div';

export interface CalcItem {
    id: string;
    type: 'cell' | 'manual' | 'history';
    value: number;
    text: string;
    op: OpType;
}

export interface SavedResult {
    id: string;
    value: number;
    timestamp: number;
}

export const useCalculator = () => {
    const [calcItems, setCalcItems] = useState<CalcItem[]>([]);
    const [buffer, setBuffer] = useState('');
    const [nextOp, setNextOp] = useState<OpType>('add');
    const [savedResults, setSavedResults] = useState<SavedResult[]>([]);

    const calculateResult = useCallback((items: CalcItem[], currentBuffer: string, op: OpType) => {
        let itemsToProcess = [...items];

        if (currentBuffer) {
            const val = parseFloat(currentBuffer.replace(/,/g, ''));
            if (!isNaN(val)) {
                itemsToProcess.push({
                    id: 'buffer',
                    type: 'manual',
                    value: val,
                    text: currentBuffer,
                    op: op
                });
            }
        }

        if (itemsToProcess.length === 0) return 0;

        let result = itemsToProcess[0].value;

        for (let i = 1; i < itemsToProcess.length; i++) {
            const item = itemsToProcess[i];
            switch (item.op) {
                case 'add': result += item.value; break;
                case 'sub': result -= item.value; break;
                case 'mul': result *= item.value; break;
                case 'div':
                    if (item.value !== 0) result /= item.value;
                    break;
            }
        }
        return result;
    }, []);

    const currentResult = calculateResult(calcItems, buffer, nextOp);

    const commitBuffer = useCallback(() => {
        if (!buffer) return;
        const val = parseFloat(buffer.replace(/,/g, ''));
        if (!isNaN(val)) {
            const id = `manual-${Date.now()}`;
            setCalcItems(prev => [
                ...prev,
                { id, type: 'manual', value: val, text: val.toLocaleString(), op: nextOp }
            ]);
            setBuffer('');
            setNextOp('add');
        }
    }, [buffer, nextOp]);

    const addCellItems = useCallback((items: { id: string, value: number, text: string }[], forceAdd: boolean = false) => {
        const valFromBuffer = parseFloat(buffer.replace(/,/g, ''));

        setCalcItems(prev => {
            let nextItems = [...prev];

            // 버퍼 처리
            if (!isNaN(valFromBuffer) && buffer) {
                nextItems.push({
                    id: `manual-${Date.now()}`,
                    type: 'manual',
                    value: valFromBuffer,
                    text: valFromBuffer.toLocaleString(),
                    op: nextOp
                });
                setBuffer('');
            }

            // 전달받은 아이템들 일괄 추가 및 토글 (forceAdd가 true면 이미 있는 경우 건너뜀)
            items.forEach(item => {
                const exists = nextItems.find(it => it.id === item.id);
                if (exists) {
                    if (!forceAdd) {
                        nextItems = nextItems.filter(it => it.id !== item.id);
                    }
                } else {
                    nextItems.push({ ...item, type: 'cell', op: nextOp });
                }
            });

            setNextOp('add');
            return nextItems;
        });
    }, [buffer, nextOp]);

    const addCellItem = useCallback((id: string, value: number, text: string) => {
        addCellItems([{ id, value, text }]);
    }, [addCellItems]);

    const saveResult = useCallback(() => {
        const value = currentResult;
        if (value === 0 && calcItems.length === 0 && !buffer) return;

        setSavedResults(prev => {
            const newResult: SavedResult = {
                id: `result-${Date.now()}`,
                value,
                timestamp: Date.now()
            };
            const updated = [newResult, ...prev];
            return updated.slice(0, 5); // 최대 5개 유지 (최근 데이터가 앞)
        });

        // 현재 계산 초기화
        setCalcItems([]);
        setBuffer('');
        setNextOp('add');
    }, [currentResult, calcItems.length, buffer]);

    const reuseResult = useCallback((value: number) => {
        // 버퍼가 있으면 확정
        if (buffer) commitBuffer();

        const id = `reuse-${Date.now()}`;
        setCalcItems(prev => [
            ...prev,
            { id, type: 'history', value, text: value.toLocaleString(), op: nextOp }
        ]);
        setNextOp('add');
    }, [buffer, nextOp, commitBuffer]);

    const removeItem = useCallback((id: string) => {
        setCalcItems(prev => prev.filter(item => item.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setCalcItems([]);
        setBuffer('');
        setNextOp('add');
    }, []);

    const fullReset = useCallback(() => {
        setCalcItems([]);
        setBuffer('');
        setNextOp('add');
        setSavedResults([]);
    }, []);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'TEXTAREA' ||
            (target.tagName === 'INPUT' && !target.dataset.calculatorInput) ||
            target.isContentEditable) {
            return;
        }

        if (e.key >= '0' && e.key <= '9' || e.key === '.') {
            setBuffer(prev => prev + e.key);
        } else if (e.key === 'Backspace') {
            setBuffer(prev => prev.slice(0, -1));
        } else if (['+', '-', '*', '/'].includes(e.key)) {
            e.preventDefault();
            commitBuffer();
            const opMap: Record<string, OpType> = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div' };
            setNextOp(opMap[e.key]);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            commitBuffer();
        } else if (e.key === 'Escape') {
            clearAll();
        }
    }, [commitBuffer, clearAll]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return {
        calcItems,
        buffer,
        nextOp,
        savedResults,
        setNextOp,
        addCellItem,
        addCellItems,
        removeItem,
        clearAll,
        fullReset,
        saveResult,
        reuseResult,
        result: currentResult,
    };
};
