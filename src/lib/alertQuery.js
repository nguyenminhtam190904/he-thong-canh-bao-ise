export function buildAlertQuery({ q, severity, status, from, to } = {}) {
    const query = {};

    if (severity && severity !== 'all') query.severity = severity;
    if (status && status !== 'all') query.status = status;

    const range = {};
    if (from) range.$gte = new Date(`${from}T00:00:00`).toISOString();
    if (to) range.$lte = new Date(`${to}T23:59:59`).toISOString();
    if (Object.keys(range).length) query.detection_time = range;

    const term = (q ?? '').trim();
    if (term) {
        query.$or = [
            { file_name: { $regex: term, $options: 'i' } },
            { device_ip: { $regex: term, $options: 'i' } },
            { device_mac: { $regex: term, $options: 'i' } },
        ];
    }

    return query;
}

export function isFiltered(filters = {}) {
    return Boolean(
        (filters.q ?? '').trim() ||
        (filters.severity && filters.severity !== 'all') ||
        (filters.status && filters.status !== 'all') ||
        filters.from ||
        filters.to
    );
}