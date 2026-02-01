export const formatCurrency = (value: number): string => {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export const parseCurrency = (value: string): number => {
    return parseInt(value.replace(/[^0-9]/g, '') || '0', 10);
};
