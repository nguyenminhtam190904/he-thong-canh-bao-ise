import { format, startOfDay, startOfHour, subDays, subHours } from 'date-fns';

export function buildTrendSeries(alerts = [], range = '7d') {
    const hourly = range === '24h';
    const count = hourly ? 24 : range === '7d' ? 7 : 30;
    const step = hourly ? 3600000 : 86400000;
    const now = new Date();
    const firstStart = (
        hourly ? startOfHour(subHours(now, count - 1)) : startOfDay(subDays(now, count - 1))
    ).getTime();

    const buckets = Array.from({ length: count }, (_, i) => {
        const point = new Date(firstStart + i * step);
        return {
            label: format(point, hourly ? 'HH:00' : 'dd/MM'),
            total: 0,
            critical: 0,
        };
    });

    alerts.forEach((alert) => {
        if (!alert.detection_time) return;
        const index = Math.floor(
            (new Date(alert.detection_time).getTime() - firstStart) / step
        );
        if (index >= 0 && index < count) {
            buckets[index].total += 1;
            if (alert.severity === 'critical') buckets[index].critical += 1;
        }
    });

    return buckets;
}

export function countBy(alerts = [], key) {
    return alerts.reduce((acc, item) => {
        const value = item[key] ?? 'Other';
        acc[value] = (acc[value] ?? 0) + 1;
        return acc;
    }, {});
}