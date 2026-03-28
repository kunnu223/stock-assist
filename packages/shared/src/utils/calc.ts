export const calcWinRate = (wins: number, total: number): number => {
    return total === 0 ? 0 : parseFloat(((wins / total) * 100).toFixed(2));
};

export const calcProfitFactor = (gross: number, losses: number): number => {
    return losses === 0 ? (gross > 0 ? Infinity : 0) : parseFloat((gross / Math.abs(losses)).toFixed(2));
};
