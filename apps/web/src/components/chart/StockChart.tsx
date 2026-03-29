'use client';

/**
 * StockChart — Professional trading chart using TradingView lightweight-charts v5.
 * Features: Candlestick + Line + Area modes, SMA/EMA overlays, Bollinger Bands,
 * volume bars, S/R levels, entry/SL/target overlays, live auto-refresh,
 * OHLC tooltip on crosshair.
 *
 * Reusable for both stocks and commodities — pass any OHLC data + symbol.
 *
 * Lifecycle: A single useEffect owns chart creation and destruction.
 * Data/marker updates use refs to avoid re-creating the chart on every render.
 *
 * @module @stock-assist/web/components/chart/StockChart
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
    createChart,
    CandlestickSeries,
    HistogramSeries,
    LineSeries,
    AreaSeries,
    type IChartApi,
    type ISeriesApi,
    type CandlestickData,
    type Time,
    ColorType,
    LineStyle,
    LineType,
    CrosshairMode,
} from 'lightweight-charts';
import { CHART_COLORS, CHART_RANGES } from '@/constants';
import type { OHLCBar, ChartRange, ChartMarker, PriceProjection } from '@/types';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type ChartMode = 'candle' | 'line' | 'area';

interface Indicator {
    key: string;
    label: string;
    color: string;
    enabled: boolean;
}

interface StockChartProps {
    data: OHLCBar[];
    symbol: string;
    range: ChartRange;
    onRangeChange: (range: ChartRange) => void;
    loading?: boolean;
    markers?: ChartMarker[];
    height?: number;
    /** Currency symbol for tooltip (default: ₹) */
    currencySymbol?: string;
    /** Auto-refresh interval in seconds (0 = disabled) */
    autoRefreshInterval?: number;
    /** Callback for live refresh */
    onRefresh?: () => void;
    /** Show indicator toggles (SMA/EMA/BB) */
    showIndicators?: boolean;
    /** Future price projections (bullish/bearish scenarios) */
    projections?: PriceProjection[];
}

// ═══════════════════════════════════════════════════════════════
// PROJECTION HELPERS
// ═══════════════════════════════════════════════════════════════

/** Generate future trading dates from last bar date */
function generateFutureDates(lastDate: string, count: number): string[] {
    const dates: string[] = [];
    const d = new Date(lastDate);
    let added = 0;
    while (added < count) {
        d.setDate(d.getDate() + 1);
        const day = d.getDay();
        if (day === 0 || day === 6) continue; // skip weekends
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dates.push(`${yyyy}-${mm}-${dd}`);
        added++;
    }
    return dates;
}

/** Build a smooth curved path from current price to target */
function buildProjectionPath(
    lastDate: string,
    currentPrice: number,
    targetPrice: number,
    daysAhead: number,
    waypoints?: number[],
): { time: Time; value: number }[] {
    const futureDates = generateFutureDates(lastDate, daysAhead);
    const points: { time: Time; value: number }[] = [
        { time: lastDate as Time, value: currentPrice },
    ];

    if (waypoints && waypoints.length > 0) {
        // Use waypoints for intermediate stops
        const totalSegments = waypoints.length + 1;
        const datesPerSegment = Math.floor(futureDates.length / totalSegments);

        let dateIdx = 0;
        for (let w = 0; w < waypoints.length; w++) {
            dateIdx = Math.min((w + 1) * datesPerSegment - 1, futureDates.length - 1);
            points.push({ time: futureDates[dateIdx] as Time, value: waypoints[w] });
        }
        // Final target
        points.push({ time: futureDates[futureDates.length - 1] as Time, value: targetPrice });
    } else {
        // Smooth ease-out curve from current to target
        for (let i = 0; i < futureDates.length; i++) {
            const t = (i + 1) / futureDates.length;
            // Ease-out cubic for natural-looking projection
            const eased = 1 - Math.pow(1 - t, 3);
            const price = currentPrice + (targetPrice - currentPrice) * eased;
            points.push({ time: futureDates[i] as Time, value: price });
        }
    }

    return points;
}

const PROJECTION_COLORS = {
    bullish: { line: 'rgba(16, 185, 129, 0.7)' },
    bearish: { line: 'rgba(244, 63, 94, 0.7)' },
    neutral: { line: 'rgba(161, 161, 170, 0.5)' },
} as const;

// ═══════════════════════════════════════════════════════════════
// INDICATOR CALCULATION HELPERS
// ═══════════════════════════════════════════════════════════════

function calcSMA(data: OHLCBar[], period: number): { time: Time; value: number }[] {
    const result: { time: Time; value: number }[] = [];
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
        result.push({ time: data[i].date as Time, value: sum / period });
    }
    return result;
}

function calcEMA(data: OHLCBar[], period: number): { time: Time; value: number }[] {
    if (data.length < period) return [];
    const k = 2 / (period + 1);
    const result: { time: Time; value: number }[] = [];

    // Seed with SMA
    let sum = 0;
    for (let i = 0; i < period; i++) sum += data[i].close;
    let ema = sum / period;
    result.push({ time: data[period - 1].date as Time, value: ema });

    for (let i = period; i < data.length; i++) {
        ema = data[i].close * k + ema * (1 - k);
        result.push({ time: data[i].date as Time, value: ema });
    }
    return result;
}

function calcBollingerBands(data: OHLCBar[], period: number = 20, mult: number = 2) {
    const upper: { time: Time; value: number }[] = [];
    const middle: { time: Time; value: number }[] = [];
    const lower: { time: Time; value: number }[] = [];

    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
        const sma = sum / period;

        let variance = 0;
        for (let j = i - period + 1; j <= i; j++) variance += (data[j].close - sma) ** 2;
        const stdDev = Math.sqrt(variance / period);

        const t = data[i].date as Time;
        upper.push({ time: t, value: sma + mult * stdDev });
        middle.push({ time: t, value: sma });
        lower.push({ time: t, value: sma - mult * stdDev });
    }

    return { upper, middle, lower };
}

function calcVWAP(data: OHLCBar[]): { time: Time; value: number }[] {
    const result: { time: Time; value: number }[] = [];
    let cumulativeTPV = 0;
    let cumulativeVol = 0;

    for (const bar of data) {
        const tp = (bar.high + bar.low + bar.close) / 3;
        cumulativeTPV += tp * bar.volume;
        cumulativeVol += bar.volume;
        if (cumulativeVol > 0) {
            result.push({ time: bar.date as Time, value: cumulativeTPV / cumulativeVol });
        }
    }
    return result;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function toChartTime(dateStr: string): Time {
    return dateStr as Time;
}

function toCandlestickData(bars: OHLCBar[]): CandlestickData<Time>[] {
    return bars.map((bar) => ({
        time: toChartTime(bar.date),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
    }));
}

function toLineData(bars: OHLCBar[]) {
    return bars.map((bar) => ({
        time: toChartTime(bar.date),
        value: bar.close,
    }));
}

function toVolumeData(bars: OHLCBar[]) {
    return bars.map((bar) => ({
        time: toChartTime(bar.date),
        value: bar.volume,
        color: bar.close >= bar.open
            ? CHART_COLORS.VOLUME.up
            : CHART_COLORS.VOLUME.down,
    }));
}

function formatVolume(vol: number): string {
    if (vol >= 10_000_000) return `${(vol / 10_000_000).toFixed(2)}Cr`;
    if (vol >= 100_000) return `${(vol / 100_000).toFixed(2)}L`;
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
    return vol.toString();
}

// ═══════════════════════════════════════════════════════════════
// INDICATOR CONFIG
// ═══════════════════════════════════════════════════════════════

const INDICATOR_COLORS = {
    SMA20: '#f59e0b',    // amber
    SMA50: '#3b82f6',    // blue
    EMA20: '#a855f7',    // purple
    VWAP: '#ec4899',     // pink
    BB_UPPER: 'rgba(107, 114, 128, 0.5)',
    BB_MIDDLE: 'rgba(107, 114, 128, 0.7)',
    BB_LOWER: 'rgba(107, 114, 128, 0.5)',
    BB_FILL: 'rgba(107, 114, 128, 0.06)',
} as const;

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export function StockChart({
    data,
    symbol,
    range,
    onRangeChange,
    loading = false,
    markers = [],
    height = 420,
    currencySymbol = '₹',
    autoRefreshInterval = 0,
    onRefresh,
    showIndicators = true,
    projections = [],
}: StockChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const indicatorSeriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
    const projectionSeriesRefs = useRef<Map<string, ISeriesApi<'Line'> | ISeriesApi<'Area'>>>(new Map());
    const priceLineRefs = useRef<any[]>([]);

    // Keep latest data/markers in refs so the crosshair callback never goes stale
    const dataRef = useRef(data);
    dataRef.current = data;
    const markersRef = useRef(markers);
    markersRef.current = markers;

    const [chartMode, setChartMode] = useState<ChartMode>('candle');
    const [tooltip, setTooltip] = useState<{
        visible: boolean;
        data?: OHLCBar;
    }>({ visible: false });

    // Indicator toggle state
    const [indicators, setIndicators] = useState<Indicator[]>([
        { key: 'SMA20', label: 'SMA 20', color: INDICATOR_COLORS.SMA20, enabled: false },
        { key: 'SMA50', label: 'SMA 50', color: INDICATOR_COLORS.SMA50, enabled: false },
        { key: 'EMA20', label: 'EMA 20', color: INDICATOR_COLORS.EMA20, enabled: false },
        { key: 'BB', label: 'Bollinger', color: INDICATOR_COLORS.BB_MIDDLE, enabled: false },
        { key: 'VWAP', label: 'VWAP', color: INDICATOR_COLORS.VWAP, enabled: false },
    ]);

    // Projection toggle
    const [showProjections, setShowProjections] = useState(projections.length > 0);

    // Live refresh state
    const [isLive, setIsLive] = useState(autoRefreshInterval > 0);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const toggleIndicator = useCallback((key: string) => {
        setIndicators(prev => prev.map(ind =>
            ind.key === key ? { ...ind, enabled: !ind.enabled } : ind
        ));
    }, []);

    // ── Live auto-refresh ──
    useEffect(() => {
        if (liveTimerRef.current) {
            clearInterval(liveTimerRef.current);
            liveTimerRef.current = null;
        }

        if (isLive && onRefresh && autoRefreshInterval > 0) {
            liveTimerRef.current = setInterval(() => {
                onRefresh();
                setLastRefresh(new Date());
            }, autoRefreshInterval * 1000);
        }

        return () => {
            if (liveTimerRef.current) clearInterval(liveTimerRef.current);
        };
    }, [isLive, autoRefreshInterval, onRefresh]);

    // ── Single lifecycle effect: create chart on mount, destroy on unmount ──
    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container) return;

        let disposed = false;

        const chart = createChart(container, {
            width: container.clientWidth,
            height,
            layout: {
                background: { type: ColorType.Solid, color: CHART_COLORS.BACKGROUND },
                textColor: CHART_COLORS.TEXT,
                fontFamily: "'Inter', -apple-system, sans-serif",
                fontSize: 11,
            },
            grid: {
                vertLines: { color: CHART_COLORS.GRID },
                horzLines: { color: CHART_COLORS.GRID },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: { color: CHART_COLORS.CROSSHAIR, labelBackgroundColor: '#27272a' },
                horzLine: { color: CHART_COLORS.CROSSHAIR, labelBackgroundColor: '#27272a' },
            },
            rightPriceScale: {
                borderColor: CHART_COLORS.GRID,
                scaleMargins: { top: 0.1, bottom: 0.25 },
            },
            timeScale: {
                borderColor: CHART_COLORS.GRID,
                timeVisible: false,
                rightOffset: 5,
                barSpacing: 8,
            },
        });

        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        chartRef.current = chart;
        volumeSeriesRef.current = volumeSeries;

        // Responsive resize
        const resizeObserver = new ResizeObserver((entries) => {
            if (disposed) return;
            for (const entry of entries) {
                chart.applyOptions({ width: entry.contentRect.width });
            }
        });
        resizeObserver.observe(container);

        // Crosshair tooltip
        chart.subscribeCrosshairMove((param) => {
            if (disposed) return;
            if (!param.time || !param.point) {
                setTooltip({ visible: false });
                return;
            }

            const bar = dataRef.current.find((b) => b.date === (param.time as string));
            if (!bar) return;

            setTooltip({ visible: true, data: bar });
        });

        // Cleanup
        return () => {
            disposed = true;
            resizeObserver.disconnect();
            chartRef.current = null;
            mainSeriesRef.current = null;
            volumeSeriesRef.current = null;
            indicatorSeriesRefs.current.clear();
            projectionSeriesRefs.current.clear();
            priceLineRefs.current = [];
            chart.remove();
        };
    }, [height]);

    // ── Update main series based on chart mode ──
    useEffect(() => {
        const chart = chartRef.current;
        const vs = volumeSeriesRef.current;
        if (!chart || !vs || data.length === 0) return;

        // Remove existing main series
        if (mainSeriesRef.current) {
            try { chart.removeSeries(mainSeriesRef.current); } catch { /* ok */ }
            mainSeriesRef.current = null;
        }

        // Create new series based on mode
        let mainSeries: any;
        if (chartMode === 'candle') {
            mainSeries = chart.addSeries(CandlestickSeries, {
                upColor: CHART_COLORS.BULLISH.body,
                downColor: CHART_COLORS.BEARISH.body,
                borderUpColor: CHART_COLORS.BULLISH.border,
                borderDownColor: CHART_COLORS.BEARISH.border,
                wickUpColor: CHART_COLORS.BULLISH.wick,
                wickDownColor: CHART_COLORS.BEARISH.wick,
            });
            mainSeries.setData(toCandlestickData(data));
        } else if (chartMode === 'line') {
            mainSeries = chart.addSeries(LineSeries, {
                color: '#3b82f6',
                lineWidth: 2,
                lineType: LineType.Curved,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
            });
            mainSeries.setData(toLineData(data));
        } else {
            mainSeries = chart.addSeries(AreaSeries, {
                topColor: 'rgba(59, 130, 246, 0.4)',
                bottomColor: 'rgba(59, 130, 246, 0.02)',
                lineColor: '#3b82f6',
                lineWidth: 2,
                lineType: LineType.Curved,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
            });
            mainSeries.setData(toLineData(data));
        }

        mainSeriesRef.current = mainSeries;

        // Update volume
        vs.setData(toVolumeData(data));
        chart.timeScale().fitContent();
    }, [data, chartMode]);

    // ── Update indicator overlays ──
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart || data.length === 0) return;

        // Remove old indicator series
        for (const [key, series] of indicatorSeriesRefs.current) {
            try { chart.removeSeries(series); } catch { /* ok */ }
        }
        indicatorSeriesRefs.current.clear();

        for (const ind of indicators) {
            if (!ind.enabled) continue;

            if (ind.key === 'SMA20') {
                const smaData = calcSMA(data, 20);
                if (smaData.length > 0) {
                    const s = chart.addSeries(LineSeries, {
                        color: ind.color,
                        lineWidth: 1,
                        priceLineVisible: false,
                        lastValueVisible: false,
                    });
                    s.setData(smaData);
                    indicatorSeriesRefs.current.set('SMA20', s);
                }
            }

            if (ind.key === 'SMA50') {
                const smaData = calcSMA(data, 50);
                if (smaData.length > 0) {
                    const s = chart.addSeries(LineSeries, {
                        color: ind.color,
                        lineWidth: 1,
                        priceLineVisible: false,
                        lastValueVisible: false,
                    });
                    s.setData(smaData);
                    indicatorSeriesRefs.current.set('SMA50', s);
                }
            }

            if (ind.key === 'EMA20') {
                const emaData = calcEMA(data, 20);
                if (emaData.length > 0) {
                    const s = chart.addSeries(LineSeries, {
                        color: ind.color,
                        lineWidth: 1,
                        priceLineVisible: false,
                        lastValueVisible: false,
                    });
                    s.setData(emaData);
                    indicatorSeriesRefs.current.set('EMA20', s);
                }
            }

            if (ind.key === 'VWAP') {
                const vwapData = calcVWAP(data);
                if (vwapData.length > 0) {
                    const s = chart.addSeries(LineSeries, {
                        color: ind.color,
                        lineWidth: 1,
                        lineStyle: LineStyle.Dotted,
                        priceLineVisible: false,
                        lastValueVisible: false,
                    });
                    s.setData(vwapData);
                    indicatorSeriesRefs.current.set('VWAP', s);
                }
            }

            if (ind.key === 'BB') {
                const bb = calcBollingerBands(data);
                if (bb.upper.length > 0) {
                    const sUpper = chart.addSeries(LineSeries, {
                        color: INDICATOR_COLORS.BB_UPPER,
                        lineWidth: 1,
                        lineStyle: LineStyle.Dashed,
                        priceLineVisible: false,
                        lastValueVisible: false,
                    });
                    sUpper.setData(bb.upper);
                    indicatorSeriesRefs.current.set('BB_UPPER', sUpper);

                    const sMiddle = chart.addSeries(LineSeries, {
                        color: INDICATOR_COLORS.BB_MIDDLE,
                        lineWidth: 1,
                        priceLineVisible: false,
                        lastValueVisible: false,
                    });
                    sMiddle.setData(bb.middle);
                    indicatorSeriesRefs.current.set('BB_MIDDLE', sMiddle);

                    const sLower = chart.addSeries(LineSeries, {
                        color: INDICATOR_COLORS.BB_LOWER,
                        lineWidth: 1,
                        lineStyle: LineStyle.Dashed,
                        priceLineVisible: false,
                        lastValueVisible: false,
                    });
                    sLower.setData(bb.lower);
                    indicatorSeriesRefs.current.set('BB_LOWER', sLower);
                }
            }
        }
    }, [data, indicators]);

    // ── Update projection overlays (future price paths) ──
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart || data.length === 0) return;

        // Remove old projection series
        for (const [, series] of projectionSeriesRefs.current) {
            try { chart.removeSeries(series); } catch { /* ok */ }
        }
        projectionSeriesRefs.current.clear();

        if (!showProjections || projections.length === 0) return;

        const lastBar = data[data.length - 1];
        const currentPrice = lastBar.close;

        // Collect marker prices so we don't duplicate labels on the axis
        const markerPrices = new Set(markers.map(m => Math.round(m.price * 100)));

        for (let i = 0; i < projections.length; i++) {
            const proj = projections[i];
            const colors = PROJECTION_COLORS[proj.type];
            const pathData = buildProjectionPath(
                lastBar.date,
                currentPrice,
                proj.targetPrice,
                proj.daysAhead,
                proj.waypoints,
            );

            // Check if this target is already shown as a marker (within 0.5% tolerance)
            const targetRounded = Math.round(proj.targetPrice * 100);
            const isDuplicate = markerPrices.has(targetRounded);

            // Clean dashed line — thin, subtle, no axis clutter
            const isSecondary = proj.probability < 40;
            const lineSeries = chart.addSeries(LineSeries, {
                color: colors.line,
                lineWidth: isSecondary ? 1 : 2,
                lineStyle: isSecondary ? LineStyle.Dotted : LineStyle.Dashed,
                lineType: LineType.Curved,
                crosshairMarkerVisible: false,
                priceLineVisible: false,
                lastValueVisible: !isDuplicate,
                title: isDuplicate ? '' : `${proj.label} ${proj.probability}%`,
            });
            lineSeries.setData(pathData);
            projectionSeriesRefs.current.set(`proj_${i}`, lineSeries);
        }
    }, [data, projections, showProjections]);

    // ── Update price line markers ──
    useEffect(() => {
        const series = mainSeriesRef.current;
        if (!series) return;

        // Remove old lines
        for (const line of priceLineRefs.current) {
            try { series.removePriceLine(line); } catch { /* disposed */ }
        }
        priceLineRefs.current = [];

        // Add new lines
        for (const marker of markers) {
            const line = series.createPriceLine({
                price: marker.price,
                color: marker.color,
                lineWidth: 1,
                lineStyle: marker.lineStyle === 'dashed' ? LineStyle.Dashed : LineStyle.Solid,
                axisLabelVisible: true,
                title: marker.label,
            });
            priceLineRefs.current.push(line);
        }
    }, [markers, data, chartMode]);

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════

    const chartModes: { mode: ChartMode; label: string }[] = [
        { mode: 'candle', label: 'Candle' },
        { mode: 'line', label: 'Line' },
        { mode: 'area', label: 'Area' },
    ];

    return (
        <div className="relative border border-border rounded-xl overflow-hidden bg-zinc-950">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-border bg-zinc-900/50 gap-2 flex-wrap">
                {/* Left: Symbol + Chart Mode */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        {symbol}
                    </span>
                    <div className="flex bg-zinc-800/50 rounded-md p-0.5">
                        {chartModes.map((m) => (
                            <button
                                key={m.mode}
                                onClick={() => setChartMode(m.mode)}
                                className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all ${
                                    chartMode === m.mode
                                        ? 'bg-zinc-700 text-foreground shadow-sm'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>

                    {/* Live toggle */}
                    {autoRefreshInterval > 0 && (
                        <button
                            onClick={() => setIsLive(!isLive)}
                            className={`flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all ${
                                isLive
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                            LIVE
                        </button>
                    )}

                    {/* Forecast toggle */}
                    {projections.length > 0 && (
                        <button
                            onClick={() => setShowProjections(!showProjections)}
                            className={`flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all ${
                                showProjections
                                    ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                                    : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                            }`}
                        >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-80">
                                <path d="M1 8 L4 5 L6 6 L9 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.5 1.5"/>
                                <circle cx="9" cy="2" r="1.2" fill="currentColor"/>
                            </svg>
                            Forecast
                        </button>
                    )}
                </div>

                {/* Right: Range Selector */}
                <div className="flex gap-1">
                    {CHART_RANGES.map((r) => (
                        <button
                            key={r.value}
                            onClick={() => onRangeChange(r.value as ChartRange)}
                            disabled={loading}
                            className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${
                                range === r.value
                                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                                    : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                            } disabled:opacity-50`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Indicator Toggles */}
            {showIndicators && (
                <div className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 border-b border-border bg-zinc-900/30 flex-wrap">
                    <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mr-1">Indicators:</span>
                    {indicators.map((ind) => (
                        <button
                            key={ind.key}
                            onClick={() => toggleIndicator(ind.key)}
                            className={`flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded transition-all ${
                                ind.enabled
                                    ? 'bg-zinc-800 text-foreground border border-zinc-600'
                                    : 'text-zinc-600 hover:text-zinc-400 border border-transparent'
                            }`}
                        >
                            <span
                                className="w-2 h-0.5 rounded-full"
                                style={{ backgroundColor: ind.enabled ? ind.color : '#52525b' }}
                            />
                            {ind.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Chart Container */}
            <div className="relative">
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                Loading chart...
                            </span>
                        </div>
                    </div>
                )}

                <div ref={chartContainerRef} />

                {/* OHLC Tooltip */}
                {tooltip.visible && tooltip.data && (
                    <div className="absolute top-2 left-3 sm:left-4 z-20 pointer-events-none">
                        <div className="flex items-center gap-2 sm:gap-4 text-[9px] sm:text-[10px] font-bold flex-wrap">
                            <span className="text-muted-foreground">{tooltip.data.date}</span>
                            {chartMode === 'candle' ? (
                                <>
                                    <span className="text-zinc-400">
                                        O <span className="text-foreground">{currencySymbol}{tooltip.data.open.toFixed(2)}</span>
                                    </span>
                                    <span className="text-zinc-400">
                                        H <span className="text-foreground">{currencySymbol}{tooltip.data.high.toFixed(2)}</span>
                                    </span>
                                    <span className="text-zinc-400">
                                        L <span className="text-foreground">{currencySymbol}{tooltip.data.low.toFixed(2)}</span>
                                    </span>
                                    <span className="text-zinc-400">
                                        C <span className={tooltip.data.close >= tooltip.data.open ? 'text-emerald-400' : 'text-rose-400'}>
                                            {currencySymbol}{tooltip.data.close.toFixed(2)}
                                        </span>
                                    </span>
                                </>
                            ) : (
                                <span className="text-zinc-400">
                                    Price <span className={tooltip.data.close >= tooltip.data.open ? 'text-emerald-400' : 'text-rose-400'}>
                                        {currencySymbol}{tooltip.data.close.toFixed(2)}
                                    </span>
                                </span>
                            )}
                            <span className="text-zinc-400">
                                V <span className="text-foreground">{formatVolume(tooltip.data.volume)}</span>
                            </span>
                        </div>
                    </div>
                )}

                {/* Projection legend — compact bottom-left pill */}
                {showProjections && projections.length > 0 && (
                    <div className="absolute bottom-2 left-3 z-20 pointer-events-none">
                        <div className="inline-flex items-center gap-2 bg-zinc-900/90 backdrop-blur-sm rounded-full px-3 py-1 border border-zinc-800/60">
                            {projections.map((proj, i) => (
                                <span key={i} className="flex items-center gap-1">
                                    <span
                                        className="w-4 h-[2px]"
                                        style={{
                                            backgroundColor: PROJECTION_COLORS[proj.type].line,
                                            borderRadius: 1,
                                        }}
                                    />
                                    <span className="text-[8px] font-bold" style={{ color: PROJECTION_COLORS[proj.type].line }}>
                                        {proj.label}
                                    </span>
                                    <span className="text-[8px] text-zinc-500 font-bold">
                                        {proj.probability}%
                                    </span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Live indicator */}
                {isLive && lastRefresh && (
                    <div className="absolute bottom-2 right-3 z-20 pointer-events-none">
                        <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">
                            Updated {lastRefresh.toLocaleTimeString()}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
