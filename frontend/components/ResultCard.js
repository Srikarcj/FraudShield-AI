import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function riskBadgeVariant(level) {
  if (level === "fraud") return "destructive";
  if (level === "suspicious") return "secondary";
  return "default";
}

function riskEmoji(level) {
  if (level === "fraud") return "[HIGH]";
  if (level === "suspicious") return "[MEDIUM]";
  return "[LOW]";
}

export default function ResultCard({ result }) {
  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Latest Prediction</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-300">Run any test from the dashboard to view results.</p>
        </CardContent>
      </Card>
    );
  }

  const isFraud = Number(result.prediction) === 1;
  const riskLevel = String(result.risk_level || "safe").toLowerCase();
  const riskScore = Number(result.risk_score || Math.round(Number(result.probability || 0) * 100));
  const explainability = result.explainability || {};
  const topReasons = Array.isArray(explainability.top_reasons) ? explainability.top_reasons : [];

  const modelOutputs = Object.entries(result.individual_model_outputs || result.component_scores || {})
    .map(([name, value]) => ({ name, value: Number(value) }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest Prediction</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isFraud ? "destructive" : "default"}>{isFraud ? "Fraud" : "Safe"}</Badge>
          <span className="text-sm text-slate-300">{result.prediction_label}</span>
          <Badge variant={riskBadgeVariant(riskLevel)}>
            Risk Score: {riskScore}/100 {riskEmoji(riskLevel)}
          </Badge>
        </div>

        <div className="grid gap-2 text-sm text-slate-200 sm:grid-cols-2 lg:grid-cols-3">
          <p><span className="text-slate-400">Confidence:</span> {Number(result.confidence || 0).toFixed(2)}%</p>
          <p><span className="text-slate-400">Model:</span> {result.model_used}</p>
          <p><span className="text-slate-400">Input:</span> {result.input_type}</p>
        </div>

        {topReasons.length > 0 ? (
          <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
            <p className="mb-2 text-sm font-medium text-white">Top Reasons</p>
            <ul className="space-y-1 text-sm text-slate-300">
              {topReasons.map((reason, idx) => (
                <li key={`${reason}-${idx}`}>- {reason}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {modelOutputs.length > 0 ? (
          <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
            <p className="mb-2 text-sm font-medium text-white">Hybrid Model Outputs</p>
            <div className="space-y-1 text-sm text-slate-300">
              {modelOutputs.map((item) => (
                <p key={item.name}>
                  <span className="text-slate-400">{item.name}:</span> {item.value.toFixed(4)}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

