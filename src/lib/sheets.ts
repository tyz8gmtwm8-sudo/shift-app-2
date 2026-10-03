// =============================================================
// Google スプレッドシートへの保存（要件 F-19）
// 「サービスアカウント」（アプリ専用の Google ロボットアカウント）で書き込みます。
// 保存先のスプレッドシートを、サービスアカウントのメールアドレスに「編集者」で共有しておく必要があります。
// =============================================================
import "server-only";
import { auth, sheets as sheetsApi, type sheets_v4 } from "@googleapis/sheets";
import { countByDay } from "./generate";
import { daysInMonth, formatDay, formatMonth } from "./date";
import { OFF, type Assignments, type Profile, type ShiftType } from "./types";

type SaveInput = {
  month: string;
  employees: Profile[];
  shiftTypes: ShiftType[];
  assignments: Assignments;
};

// "#60a5fa" → Google Sheets 用の色 { red, green, blue }（0〜1）
function hexToColor(hex: string): sheets_v4.Schema$Color {
  const v = hex.replace("#", "");
  return {
    red: parseInt(v.slice(0, 2), 16) / 255,
    green: parseInt(v.slice(2, 4), 16) / 255,
    blue: parseInt(v.slice(4, 6), 16) / 255,
  };
}

export async function saveToSpreadsheet({
  month,
  employees,
  shiftTypes,
  assignments,
}: SaveInput): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // .env では改行が "\n" という文字で保存されるので、本物の改行に戻す
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!email || !key || !spreadsheetId) {
    throw new Error("Google スプレッドシートの環境変数が設定されていません");
  }

  const client = new auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = sheetsApi({ version: "v4", auth: client });

  // ---- 1. 対象月のシート（タブ）を用意する（あれば中身を消して再利用） ----
  const title = formatMonth(month); // 例: "2026年11月"
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  let sheetId = meta.data.sheets?.find((s) => s.properties?.title === title)?.properties?.sheetId;

  if (sheetId === undefined || sheetId === null) {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    sheetId = res.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
  } else {
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${title}'` });
    // 以前の色もリセット
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ repeatCell: { range: { sheetId }, cell: {}, fields: "userEnteredFormat" } }],
      },
    });
  }

  // ---- 2. 書き込む値を作る ----
  const days = daysInMonth(month);
  const typeById = new Map(shiftTypes.map((t) => [t.id, t]));
  const counts = countByDay(assignments, days, shiftTypes);

  const header = ["名前", ...days.map(formatDay)];
  const employeeRows = employees.map((e) => [
    e.name,
    ...days.map((d) => {
      const v = assignments[e.id]?.[d];
      if (v === OFF) return "休";
      return v ? (typeById.get(v)?.name ?? "") : "";
    }),
  ]);
  const summaryRows = shiftTypes.map((t) => [
    `${t.name}（必要${t.required_count}人）`,
    ...days.map((d) => counts[d][t.id]),
  ]);
  const values = [header, ...employeeRows, [], ...summaryRows];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  // ---- 3. 色を付ける（表示名の色、不足は赤） ----
  const cell = (row: number, col: number) => ({
    sheetId,
    startRowIndex: row,
    endRowIndex: row + 1,
    startColumnIndex: col,
    endColumnIndex: col + 1,
  });
  const requests: sheets_v4.Schema$Request[] = [
    // 見出し行を太字に
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: "userEnteredFormat.textFormat.bold",
      },
    },
    // 1行目と1列目を固定
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 } },
        fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
      },
    },
  ];

  employees.forEach((e, r) => {
    days.forEach((d, c) => {
      const v = assignments[e.id]?.[d];
      const type = v && v !== OFF ? typeById.get(v) : undefined;
      if (!type) return;
      requests.push({
        repeatCell: {
          range: cell(r + 1, c + 1),
          cell: { userEnteredFormat: { backgroundColor: hexToColor(type.color) } },
          fields: "userEnteredFormat.backgroundColor",
        },
      });
    });
  });

  const summaryStart = employees.length + 2; // 見出し + 従業員 + 空行
  shiftTypes.forEach((t, r) => {
    days.forEach((d, c) => {
      if (counts[d][t.id] >= t.required_count) return;
      requests.push({
        repeatCell: {
          range: cell(summaryStart + r, c + 1),
          cell: {
            userEnteredFormat: {
              backgroundColor: hexToColor("#fecaca"),
              textFormat: { foregroundColor: hexToColor("#b91c1c"), bold: true },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat)",
        },
      });
    });
  });

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}`;
}
