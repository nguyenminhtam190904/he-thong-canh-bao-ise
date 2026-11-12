const esc = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

function buildSheet({ name, columns, rows = [] }) {
    const header = `<Row>${columns
        .map((c) => `<Cell ss:StyleID="head"><Data ss:Type="String">${esc(c.label)}</Data></Cell>`)
        .join('')}</Row>`;

    const body = rows
        .map((row, index) => {
            const style = index % 2 === 0 ? ' ss:StyleID="even"' : '';
            const cells = columns
                .map((c) => {
                    const value = row[c.key];
                    const isNumber = typeof value === 'number' && Number.isFinite(value);
                    return `<Cell><Data ss:Type="${isNumber ? 'Number' : 'String'}">${esc(
                        isNumber ? value : value ?? ''
                    )}</Data></Cell>`;
                })
                .join('');
            return `<Row${style}>${cells}</Row>`;
        })
        .join('');

    return `<Worksheet ss:Name="${esc(name).slice(0, 31)}"><Table><Column ss:Width="170"/>${header}${body}</Table></Worksheet>`;
}

export function downloadExcel({ filename = 'bao-cao', sheets = [] }) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/></Style>
  <Style ss:ID="head"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1F2933" ss:Pattern="Solid"/></Style>
  <Style ss:ID="even"><Interior ss:Color="#F5F6F7" ss:Pattern="Solid"/></Style>
 </Styles>
 ${sheets.map(buildSheet).join('')}
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}