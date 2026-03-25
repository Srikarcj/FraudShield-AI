const FLASK_BASE_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || "http://127.0.0.1:5000";

async function parseResponse(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("Invalid backend response.");
  }

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "Request failed.");
  }
  return payload;
}

export async function predict(data) {
  const response = await fetch(`${FLASK_BASE_URL}/api/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return parseResponse(response);
}

export async function predictRow(rowId) {
  const response = await fetch(`${FLASK_BASE_URL}/api/predict_row`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ row_id: rowId })
  });
  return parseResponse(response);
}

export async function randomTest() {
  const response = await fetch(`${FLASK_BASE_URL}/api/random_test`, {
    method: "GET"
  });
  return parseResponse(response);
}

export async function uploadCsv(file) {
  const formData = new FormData();
  formData.append("csv_file", file);

  const response = await fetch(`${FLASK_BASE_URL}/api/upload_csv`, {
    method: "POST",
    body: formData
  });
  return parseResponse(response);
}

export async function evaluateModel() {
  const response = await fetch(`${FLASK_BASE_URL}/api/evaluate`, {
    method: "GET"
  });
  return parseResponse(response);
}

export async function modelComparison() {
  const response = await fetch(`${FLASK_BASE_URL}/api/model_comparison`, {
    method: "GET"
  });
  return parseResponse(response);
}

export async function getApiStatus() {
  const response = await fetch(`${FLASK_BASE_URL}/api/status`, {
    method: "GET"
  });
  return parseResponse(response);
}
export function parseCsvRowText(rawText) {
  const tokens = String(rawText || "")
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length !== 28 && tokens.length !== 29) {
    throw new Error("CSV row must contain 28 feature values, with optional Amount as 29th value.");
  }

  const values = tokens.slice(0, 28).map((item) => {
    const num = Number(item);
    if (!Number.isFinite(num)) {
      throw new Error("CSV row contains non-numeric values.");
    }
    return num;
  });

  const amount = tokens.length === 29 ? Number(tokens[28]) : 0;
  if (!Number.isFinite(amount)) {
    throw new Error("Amount must be numeric.");
  }

  return { values, amount };
}
