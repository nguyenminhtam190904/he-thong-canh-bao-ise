import { downloadRows, fetchAlerts } from '@/api/alerts';

export async function fetchAllAlerts() {
  return fetchAlerts();
}

export function exportAlertList(rows = []) {
  downloadRows('danh-sach-canh-bao.csv', rows);
  return rows.length;
}

export async function exportFullReport() {
  const alerts = await fetchAllAlerts();
  downloadRows('bao-cao-canh-bao.csv', alerts);
  return { alerts: alerts.length };
}
