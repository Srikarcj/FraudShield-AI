from pathlib import Path
import pickle
import random
import time
import warnings

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split

from arima_model import score_anomaly_batch, score_anomaly_single
from evaluation import evaluate_model

app = Flask(__name__)
FEATURE_COLUMNS = [f"V{i}" for i in range(1, 29)]
MODELS_DIR = Path("models")
LEGACY_MODEL_PATH = Path("model.pkl")
DEFAULT_DATASET_PATH = Path("dataset") / "creditcard.csv"
UPLOAD_DATASET_DIR = Path("dataset") / "uploads"
ACTIVE_UPLOAD_DATASET = UPLOAD_DATASET_DIR / "active_uploaded.csv"
DEFAULT_COMPONENT_ORDER = ["RF", "LR", "XGB", "ARIMA", "LSTM", "CNN", "Transformer"]


class HybridInferenceEngine:
    def __init__(self):
        self.ready = False
        self.message = "Hybrid model not loaded"
        self.rf = None
        self.lr = None
        self.xgb = None
        self.meta = None
        self.meta_threshold = 0.5
        self.meta_scaler = None
        self.arima = None
        self.scaler = None
        self.lstm = None
        self.cnn = None
        self.transformer = None
        self.meta_components = list(DEFAULT_COMPONENT_ORDER)

    def load(self):
        required = [
            MODELS_DIR / "rf.pkl",
            MODELS_DIR / "lr.pkl",
            MODELS_DIR / "xgb.pkl",
            MODELS_DIR / "meta.pkl",
            MODELS_DIR / "arima.pkl",
            MODELS_DIR / "scaler.pkl",
            MODELS_DIR / "lstm.h5",
            MODELS_DIR / "cnn.h5",
            MODELS_DIR / "transformer.h5",
        ]

        missing = [str(p) for p in required if not p.exists()]
        if missing:
            self.ready = False
            self.message = "Missing hybrid model files. Run train_model.py first."
            return

        try:
            from tensorflow.keras.models import load_model
        except ModuleNotFoundError:
            self.ready = False
            self.message = "TensorFlow missing. Install TensorFlow to load deep models."
            return

        self.rf = joblib.load(MODELS_DIR / "rf.pkl")
        self.lr = joblib.load(MODELS_DIR / "lr.pkl")
        self.xgb = joblib.load(MODELS_DIR / "xgb.pkl")
        meta_payload = joblib.load(MODELS_DIR / "meta.pkl")
        if isinstance(meta_payload, dict) and "model" in meta_payload:
            self.meta = meta_payload["model"]
            self.meta_threshold = float(meta_payload.get("threshold", 0.5))
            loaded_components = meta_payload.get("components")
            if isinstance(loaded_components, list) and loaded_components:
                self.meta_components = [str(name) for name in loaded_components]
            else:
                self.meta_components = list(DEFAULT_COMPONENT_ORDER)
        else:
            self.meta = meta_payload
            self.meta_threshold = 0.5
            self.meta_components = list(DEFAULT_COMPONENT_ORDER)

        self.arima = joblib.load(MODELS_DIR / "arima.pkl")
        self.scaler = joblib.load(MODELS_DIR / "scaler.pkl")
        meta_scaler_path = MODELS_DIR / "meta_scaler.pkl"
        if meta_scaler_path.exists():
            self.meta_scaler = joblib.load(meta_scaler_path)
        else:
            self.meta_scaler = None
        self.lstm = load_model(MODELS_DIR / "lstm.h5")
        self.cnn = load_model(MODELS_DIR / "cnn.h5")
        self.transformer = load_model(MODELS_DIR / "transformer.h5")

        self.ready = True
        self.message = "Hybrid stack loaded"

    def predict(self, feature_values, amount_value):
        x = np.array(feature_values, dtype=float).reshape(1, -1)
        expected_features = int(getattr(self.scaler, "n_features_in_", x.shape[1]))
        if expected_features == x.shape[1] + 1:
            amount_feature = np.log1p(max(float(amount_value), 0.0))
            x = np.concatenate([x, np.array([[amount_feature]], dtype=float)], axis=1)
        x_scaled = self.scaler.transform(x)
        x_seq = x_scaled.reshape((x_scaled.shape[0], x_scaled.shape[1], 1))

        rf_prob = float(self.rf.predict_proba(x_scaled)[0][1])
        lr_prob = float(self.lr.predict_proba(x_scaled)[0][1])
        xgb_prob = float(self.xgb.predict_proba(x_scaled)[0][1])
        arima_score = float(score_anomaly_single(amount_value, self.arima, context_features=x_scaled))

        lstm_prob = float(self.lstm.predict(x_seq, verbose=0).reshape(-1)[0])
        cnn_prob = float(self.cnn.predict(x_seq, verbose=0).reshape(-1)[0])
        transformer_prob = float(self.transformer.predict(x_seq, verbose=0).reshape(-1)[0])

        component_scores = {
            "RF": rf_prob,
            "LR": lr_prob,
            "XGB": xgb_prob,
            "ARIMA": arima_score,
            "LSTM": lstm_prob,
            "CNN": cnn_prob,
            "Transformer": transformer_prob,
        }

        meta_values = []
        for name in self.meta_components:
            if name not in component_scores:
                raise ValueError(f"Meta component '{name}' is missing from inference outputs.")
            meta_values.append(component_scores[name])

        meta_input = np.array([meta_values], dtype=float)
        if self.meta_scaler is not None:
            meta_input = self.meta_scaler.transform(meta_input)

        final_prob = float(self.meta.predict_proba(meta_input)[0][1])
        return {
            "final_prob": final_prob,
            "threshold": self.meta_threshold,
            "active_components": list(self.meta_components),
            "component_scores": component_scores,
        }


hybrid_engine = HybridInferenceEngine()
hybrid_engine.load()

legacy_model = None
legacy_load_attempted = False
active_uploaded_dataset_path = None
HOME_METRICS_CACHE = {"payload": None, "ts": 0.0}


def get_legacy_model():
    global legacy_model
    global legacy_load_attempted

    if legacy_load_attempted:
        return legacy_model

    legacy_load_attempted = True
    if not LEGACY_MODEL_PATH.exists():
        legacy_model = None
        return legacy_model

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with open(LEGACY_MODEL_PATH, "rb") as f:
                legacy_model = pickle.load(f)
    except Exception:
        legacy_model = None

    return legacy_model


@app.after_request
def add_api_cors_headers(response):
    path = str(getattr(request, "path", ""))
    if path.startswith("/api/"):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


def get_active_uploaded_dataset_path():
    global active_uploaded_dataset_path

    if active_uploaded_dataset_path is not None and active_uploaded_dataset_path.exists():
        return active_uploaded_dataset_path

    raise FileNotFoundError("Please upload a CSV file first for row-based testing.")


def load_uploaded_dataset():
    dataset_path = get_active_uploaded_dataset_path()
    return pd.read_csv(dataset_path)


def validate_dataset_columns(dataframe):
    missing = [f"V{i}" for i in range(1, 29) if f"V{i}" not in dataframe.columns]
    if missing:
        raise ValueError(f"Uploaded CSV is missing required columns: {missing}")


def extract_model_input_from_row(row):
    row_without_class = row.drop(labels=["Class"], errors="ignore")
    values = [float(row_without_class[f"V{i}"]) for i in range(1, 29)]
    amount = float(row_without_class.get("Amount", 0.0) or 0.0)
    return values, amount


def serialize_row_for_form(row):
    row_without_class = row.drop(labels=["Class"], errors="ignore")
    payload = {f"V{i}": float(row_without_class[f"V{i}"]) for i in range(1, 29)}
    payload["Amount"] = float(row_without_class.get("Amount", 0.0) or 0.0)
    return payload


def load_test_data():
    dataset_path = None
    if active_uploaded_dataset_path is not None and active_uploaded_dataset_path.exists():
        dataset_path = active_uploaded_dataset_path
    elif DEFAULT_DATASET_PATH.exists():
        dataset_path = DEFAULT_DATASET_PATH
    else:
        raise FileNotFoundError("No dataset available for evaluation.")

    data = pd.read_csv(dataset_path)
    validate_dataset_columns(data)
    if "Class" not in data.columns:
        raise ValueError("Evaluation dataset must include 'Class' column.")

    feature_columns = list(FEATURE_COLUMNS)
    if "Amount" in data.columns:
        feature_columns.append("Amount")

    x = data[feature_columns].astype(float)
    y = data["Class"].astype(int)

    stratify = y if y.nunique() > 1 and int(y.value_counts().min()) > 1 else None
    _, x_test, _, y_test = train_test_split(
        x,
        y,
        test_size=0.20,
        random_state=42,
        stratify=stratify,
    )
    return x_test, y_test


def _to_eval_frame(x_values):
    if isinstance(x_values, pd.DataFrame):
        return x_values.copy()

    arr = np.asarray(x_values, dtype=float)
    if arr.ndim == 1:
        arr = arr.reshape(1, -1)
    return pd.DataFrame(arr)


def _extract_hybrid_inputs(row):
    if all(f"V{i}" in row.index for i in range(1, 29)):
        values = [float(row[f"V{i}"]) for i in range(1, 29)]
        amount = float(row.get("Amount", 0.0) or 0.0)
        return values, amount

    row_values = np.asarray(row.values, dtype=float).reshape(-1)
    if len(row_values) < 28:
        raise ValueError("Evaluation input row must contain at least 28 feature values.")
    values = row_values[:28].astype(float).tolist()
    amount = float(row_values[28]) if len(row_values) > 28 else 0.0
    return values, amount


def _to_legacy_feature_matrix(x_values):
    frame = _to_eval_frame(x_values)
    if all(f"V{i}" in frame.columns for i in range(1, 29)):
        return frame[[f"V{i}" for i in range(1, 29)]].astype(float).to_numpy()

    arr = np.asarray(frame.values, dtype=float)
    if arr.shape[1] < 28:
        raise ValueError("Legacy evaluation input requires at least 28 features.")
    return arr[:, :28]


class HybridEvaluationModel:
    def __init__(self, engine):
        self.engine = engine

    def predict(self, x_values):
        frame = _to_eval_frame(x_values)

        if all(f"V{i}" in frame.columns for i in range(1, 29)):
            v_values = frame[[f"V{i}" for i in range(1, 29)]].astype(float).to_numpy()
            amount_values = (
                frame["Amount"].astype(float).fillna(0.0).to_numpy()
                if "Amount" in frame.columns
                else np.zeros(len(frame), dtype=float)
            )
        else:
            arr = np.asarray(frame.values, dtype=float)
            if arr.shape[1] < 28:
                raise ValueError("Evaluation input row must contain at least 28 feature values.")
            v_values = arr[:, :28]
            amount_values = arr[:, 28] if arr.shape[1] > 28 else np.zeros(len(arr), dtype=float)

        expected_features = int(getattr(self.engine.scaler, "n_features_in_", v_values.shape[1]))
        x_input = v_values
        if expected_features == v_values.shape[1] + 1:
            log_amount = np.log1p(np.clip(amount_values.astype(float), 0.0, None)).reshape(-1, 1)
            x_input = np.hstack([v_values, log_amount])

        x_scaled = self.engine.scaler.transform(x_input)
        x_seq = x_scaled.reshape((x_scaled.shape[0], x_scaled.shape[1], 1))

        rf_prob = self.engine.rf.predict_proba(x_scaled)[:, 1]
        lr_prob = self.engine.lr.predict_proba(x_scaled)[:, 1]
        xgb_prob = self.engine.xgb.predict_proba(x_scaled)[:, 1]
        arima_prob = score_anomaly_batch(amount_values, self.engine.arima, context_features=x_scaled)
        lstm_prob = self.engine.lstm.predict(x_seq, verbose=0).reshape(-1)
        cnn_prob = self.engine.cnn.predict(x_seq, verbose=0).reshape(-1)
        transformer_prob = self.engine.transformer.predict(x_seq, verbose=0).reshape(-1)

        component_scores = {
            "RF": rf_prob,
            "LR": lr_prob,
            "XGB": xgb_prob,
            "ARIMA": arima_prob,
            "LSTM": lstm_prob,
            "CNN": cnn_prob,
            "Transformer": transformer_prob,
        }

        meta_values = []
        for name in self.engine.meta_components:
            if name not in component_scores:
                raise ValueError(f"Meta component '{name}' is missing from evaluation outputs.")
            meta_values.append(np.asarray(component_scores[name], dtype=float))

        meta_input = np.column_stack(meta_values)
        if self.engine.meta_scaler is not None:
            meta_input = self.engine.meta_scaler.transform(meta_input)

        final_prob = self.engine.meta.predict_proba(meta_input)[:, 1]
        threshold = float(getattr(self.engine, "meta_threshold", 0.5))
        return (final_prob >= threshold).astype(int)


class LegacyEvaluationModel:
    def __init__(self, model):
        self.model = model

    def predict(self, x_values):
        x_legacy = _to_legacy_feature_matrix(x_values)
        if hasattr(self.model, "predict_proba"):
            y_prob = self.model.predict_proba(x_legacy)[:, 1]
            return (y_prob >= 0.5).astype(int)
        y_pred = self.model.predict(x_legacy)
        return np.asarray(y_pred, dtype=int).reshape(-1)


def _format_metrics(metrics, y_true=None, y_pred=None):
    response = {
        "accuracy": round(float(metrics["accuracy"]), 4),
        "precision": round(float(metrics["precision"]), 4),
        "recall": round(float(metrics["recall"]), 4),
        "f1_score": round(float(metrics["f1_score"]), 4),
        "confusion_matrix": metrics["confusion_matrix"],
    }

    cm = metrics.get("confusion_matrix", [])
    if isinstance(cm, list) and len(cm) == 2 and all(isinstance(row, list) and len(row) == 2 for row in cm):
        response["confusion_labels"] = {
            "tn": int(cm[0][0]),
            "fp": int(cm[0][1]),
            "fn": int(cm[1][0]),
            "tp": int(cm[1][1]),
        }

    if y_true is not None and y_pred is not None:
        try:
            from sklearn.metrics import classification_report

            response["classification_report"] = classification_report(
                y_true,
                y_pred,
                output_dict=True,
                zero_division=0,
            )
        except Exception:
            pass

    return response


@app.route("/upload_csv", methods=["POST"])
def upload_csv():
    global active_uploaded_dataset_path

    try:
        uploaded_file = request.files.get("csv_file")
        if uploaded_file is None or uploaded_file.filename is None or uploaded_file.filename.strip() == "":
            return jsonify({"ok": False, "message": "Please choose a CSV file to upload."}), 400

        if not uploaded_file.filename.lower().endswith(".csv"):
            return jsonify({"ok": False, "message": "Only .csv files are supported."}), 400

        uploaded_df = pd.read_csv(uploaded_file)
        validate_dataset_columns(uploaded_df)

        UPLOAD_DATASET_DIR.mkdir(parents=True, exist_ok=True)
        uploaded_df.to_csv(ACTIVE_UPLOAD_DATASET, index=False)
        active_uploaded_dataset_path = ACTIVE_UPLOAD_DATASET

        return jsonify(
            {
                "ok": True,
                "message": "CSV uploaded successfully.",
                "rows": int(len(uploaded_df)),
                "columns": list(uploaded_df.columns),
            }
        )
    except Exception as e:
        return jsonify({"ok": False, "message": str(e)}), 400


@app.route("/get_rows", methods=["GET"])
def get_rows():
    try:
        data = load_uploaded_dataset()
        validate_dataset_columns(data)
        rows = []
        max_rows = min(50, len(data))
        for row_id in range(max_rows):
            row = data.iloc[row_id]
            amount = float(row.get("Amount", 0.0))
            rows.append(
                {
                    "id": row_id,
                    "label": f"Row {row_id} - Amount: {amount:.2f}",
                }
            )
        return jsonify({"rows": rows})
    except FileNotFoundError as e:
        return jsonify({"rows": [], "error": str(e)}), 400
    except Exception as e:
        return jsonify({"rows": [], "error": str(e)}), 500


@app.route("/get_row_data", methods=["GET"])
def get_row_data():
    try:
        row_value = request.args.get("row_id", "").strip()
        if row_value == "":
            return jsonify({"ok": False, "error": "row_id is required."}), 400

        row_id = int(row_value)
        data = load_uploaded_dataset()
        validate_dataset_columns(data)

        if row_id < 0 or row_id >= len(data):
            return jsonify(
                {"ok": False, "error": f"Invalid row index. Use 0 to {len(data) - 1}."}
            ), 400

        row = data.iloc[row_id]
        return jsonify(
            {
                "ok": True,
                "row_id": row_id,
                "form_values": serialize_row_for_form(row),
            }
        )
    except ValueError:
        return jsonify({"ok": False, "error": "Invalid row number."}), 400
    except FileNotFoundError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/evaluate", methods=["GET"])
def evaluate():
    try:
        x_test, y_test = load_test_data()

        if hybrid_engine.ready:
            eval_model = HybridEvaluationModel(hybrid_engine)
        else:
            legacy = get_legacy_model()
            if legacy is None:
                return jsonify({"ok": False, "message": "No usable model found for evaluation."}), 400
            eval_model = LegacyEvaluationModel(legacy)

        metrics = evaluate_model(eval_model, x_test, y_test)
        y_pred = eval_model.predict(x_test)

        response = _format_metrics(metrics, y_true=y_test, y_pred=y_pred)
        response["ok"] = True
        response["test_size"] = int(len(y_test))
        return jsonify(response)
    except Exception as e:
        return jsonify({"ok": False, "message": f"Evaluation failed: {str(e)}"}), 400


def _api_error(message, status_code=400):
    return jsonify({"ok": False, "message": str(message)}), int(status_code)


def _api_success(payload):
    body = {"ok": True}
    body.update(payload)
    return jsonify(body)


def _parse_api_manual_input(raw_payload):
    if raw_payload is None:
        raise ValueError("Missing payload.")

    if isinstance(raw_payload, dict) and "values" in raw_payload:
        values = raw_payload.get("values", [])
        if not isinstance(values, list) or len(values) != 28:
            raise ValueError("Expected 'values' list with 28 entries.")
        amount = float(raw_payload.get("amount", 0.0) or 0.0)
        return [float(v) for v in values], amount

    values = []
    for i in range(1, 29):
        key = f"V{i}"
        if key not in raw_payload:
            raise ValueError(f"Missing field: {key}")
        values.append(float(raw_payload[key]))
    amount = float(raw_payload.get("Amount", raw_payload.get("amount", 0.0)) or 0.0)
    return values, amount


def _risk_bucket(probability):
    score = int(round(float(np.clip(probability, 0.0, 1.0)) * 100))
    if score < 30:
        level = "safe"
    elif score < 70:
        level = "suspicious"
    else:
        level = "fraud"
    return score, level


def _build_explainability(values, amount, component_scores):
    values_arr = np.asarray(values, dtype=float).reshape(-1)
    top_feature_indices = np.argsort(np.abs(values_arr))[::-1][:3]

    risky_features = []
    top_reasons = []
    for idx in top_feature_indices:
        feature_name = f"V{int(idx) + 1}"
        feature_value = float(values_arr[idx])
        risky_features.append(
            {
                "feature": feature_name,
                "value": round(feature_value, 4),
                "abs_value": round(abs(feature_value), 4),
            }
        )
        top_reasons.append(f"{feature_name} high anomaly ({feature_value:.2f})")

    if float(amount) > 1000:
        top_reasons.append("Amount deviation detected")

    if isinstance(component_scores, dict) and component_scores:
        max_model = max(component_scores.items(), key=lambda item: float(item[1]))
        top_reasons.append(f"{max_model[0]} signaled elevated risk")

    return {
        "top_reasons": top_reasons[:4],
        "risky_features": risky_features,
    }


def _predict_json_payload(values, amount, input_type):
    if hybrid_engine.ready:
        prediction_payload = hybrid_engine.predict(values, amount)
        final_prob = float(prediction_payload["final_prob"])
        threshold = float(prediction_payload.get("threshold", 0.5))
        fraud_value = int(final_prob >= threshold)
        prediction_label = "Fraud Transaction Detected" if fraud_value == 1 else "Safe Transaction"
        confidence = round(max(final_prob, 1 - final_prob) * 100, 2)
        risk_score, risk_level = _risk_bucket(final_prob)
        component_scores = prediction_payload.get("component_scores", {})
        explainability = _build_explainability(values, amount, component_scores)
        return {
            "input_type": str(input_type),
            "prediction": fraud_value,
            "prediction_label": prediction_label,
            "confidence": confidence,
            "probability": round(final_prob, 6),
            "threshold": threshold,
            "model_used": "Hybrid Stacking",
            "component_scores": component_scores,
            "individual_model_outputs": {k: round(float(v), 6) for k, v in component_scores.items()},
            "active_components": prediction_payload.get("active_components", []),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "explainability": explainability,
        }

    legacy = get_legacy_model()
    if legacy is None:
        raise RuntimeError("No usable model found. Train upgraded models with train_model.py.")

    x = np.array(values, dtype=float).reshape(1, -1)
    prediction = legacy.predict(x)
    if hasattr(legacy, "predict_proba"):
        probability = float(legacy.predict_proba(x)[0][1])
    else:
        probability = float(prediction[0])

    fraud_value = int(int(prediction[0]) == 1 or probability > 0.40)
    prediction_label = "Fraud Transaction Detected" if fraud_value == 1 else "Safe Transaction"
    confidence = round(max(probability, 1 - probability) * 100, 2)
    risk_score, risk_level = _risk_bucket(probability)
    component_scores = {"LegacyModel": probability}
    explainability = _build_explainability(values, amount, component_scores)
    return {
        "input_type": str(input_type),
        "prediction": fraud_value,
        "prediction_label": prediction_label,
        "confidence": confidence,
        "probability": round(probability, 6),
        "threshold": 0.40,
        "model_used": "Legacy Model",
        "component_scores": component_scores,
        "individual_model_outputs": {"LegacyModel": round(float(probability), 6)},
        "active_components": ["LegacyModel"],
        "risk_score": risk_score,
        "risk_level": risk_level,
        "explainability": explainability,
    }


def _load_api_row_dataset():
    if active_uploaded_dataset_path is not None and active_uploaded_dataset_path.exists():
        return pd.read_csv(active_uploaded_dataset_path)
    if DEFAULT_DATASET_PATH.exists():
        return pd.read_csv(DEFAULT_DATASET_PATH)
    raise FileNotFoundError("No dataset available. Upload a CSV first or add dataset/creditcard.csv.")


def _compute_live_stats():
    data = _load_api_row_dataset()
    total_transactions = int(len(data))
    has_class_column = "Class" in data.columns

    fraud_count = 0
    if has_class_column:
        class_values = pd.to_numeric(data["Class"], errors="coerce").fillna(0).astype(int)
        fraud_count = int((class_values == 1).sum())

    safe_count = int(max(total_transactions - fraud_count, 0))
    fraud_rate = round((fraud_count / total_transactions) * 100, 2) if total_transactions else 0.0
    source = "uploaded_dataset" if active_uploaded_dataset_path is not None and active_uploaded_dataset_path.exists() else "default_dataset"

    return {
        "total_transactions": total_transactions,
        "fraud_count": fraud_count,
        "safe_count": safe_count,
        "fraud_rate": fraud_rate,
        "source": source,
        "label_column_present": bool(has_class_column),
        "updated_at": pd.Timestamp.utcnow().isoformat(),
    }


def _compute_home_metrics():
    stats = _compute_live_stats()

    best_model = "Unavailable"
    best_f1 = None
    test_size = 0

    try:
        x_test, y_test = load_test_data()
        test_size = int(len(y_test))

        if hybrid_engine.ready:
            comparison = _hybrid_model_comparison_payload(x_test, y_test)
            models = comparison.get("models", [])
            if models:
                best_model = str(models[0].get("name", "Hybrid"))
                best_f1 = float(models[0].get("f1_score", 0.0))
        else:
            legacy = get_legacy_model()
            if legacy is not None:
                eval_model = LegacyEvaluationModel(legacy)
                y_pred = eval_model.predict(x_test)
                metrics = _metric_summary_from_binary(y_test, y_pred)
                best_model = "LegacyModel"
                best_f1 = float(metrics.get("f1_score", 0.0))
    except Exception:
        # Keep home metrics endpoint resilient; stats cards should still render.
        pass

    return {
        "total_transactions": int(stats.get("total_transactions", 0)),
        "source": stats.get("source", "default_dataset"),
        "best_model": best_model,
        "best_f1": round(float(best_f1), 4) if best_f1 is not None else None,
        "test_size": test_size,
        "hybrid_ready": bool(hybrid_engine.ready),
        "model_message": str(hybrid_engine.message),
        "updated_at": pd.Timestamp.utcnow().isoformat(),
    }


def _get_cached_home_metrics(ttl_seconds=45):
    now = time.time()
    cached_payload = HOME_METRICS_CACHE.get("payload")
    cached_ts = float(HOME_METRICS_CACHE.get("ts", 0.0))

    if cached_payload is not None and (now - cached_ts) < float(ttl_seconds):
        return cached_payload

    payload = _compute_home_metrics()
    HOME_METRICS_CACHE["payload"] = payload
    HOME_METRICS_CACHE["ts"] = now
    return payload


def _metric_summary_from_binary(y_true, y_pred):
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "f1_score": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
    }


def _hybrid_model_comparison_payload(x_test, y_test):
    frame = _to_eval_frame(x_test)

    if all(f"V{i}" in frame.columns for i in range(1, 29)):
        v_values = frame[[f"V{i}" for i in range(1, 29)]].astype(float).to_numpy()
        amount_values = (
            frame["Amount"].astype(float).fillna(0.0).to_numpy()
            if "Amount" in frame.columns
            else np.zeros(len(frame), dtype=float)
        )
    else:
        arr = np.asarray(frame.values, dtype=float)
        if arr.shape[1] < 28:
            raise ValueError("Evaluation input row must contain at least 28 feature values.")
        v_values = arr[:, :28]
        amount_values = arr[:, 28] if arr.shape[1] > 28 else np.zeros(len(arr), dtype=float)

    expected_features = int(getattr(hybrid_engine.scaler, "n_features_in_", v_values.shape[1]))
    x_input = v_values
    if expected_features == v_values.shape[1] + 1:
        log_amount = np.log1p(np.clip(amount_values.astype(float), 0.0, None)).reshape(-1, 1)
        x_input = np.hstack([v_values, log_amount])

    x_scaled = hybrid_engine.scaler.transform(x_input)
    x_seq = x_scaled.reshape((x_scaled.shape[0], x_scaled.shape[1], 1))

    rf_prob = hybrid_engine.rf.predict_proba(x_scaled)[:, 1]
    lr_prob = hybrid_engine.lr.predict_proba(x_scaled)[:, 1]
    xgb_prob = hybrid_engine.xgb.predict_proba(x_scaled)[:, 1]
    arima_prob = score_anomaly_batch(amount_values, hybrid_engine.arima, context_features=x_scaled)
    lstm_prob = hybrid_engine.lstm.predict(x_seq, verbose=0).reshape(-1)
    cnn_prob = hybrid_engine.cnn.predict(x_seq, verbose=0).reshape(-1)
    transformer_prob = hybrid_engine.transformer.predict(x_seq, verbose=0).reshape(-1)

    model_probabilities = {
        "RF": rf_prob,
        "LR": lr_prob,
        "XGB": xgb_prob,
        "ARIMA": arima_prob,
        "LSTM": lstm_prob,
        "CNN": cnn_prob,
        "Transformer": transformer_prob,
    }

    meta_values = []
    for name in hybrid_engine.meta_components:
        if name not in model_probabilities:
            raise ValueError(f"Meta component '{name}' is missing from comparison payload.")
        meta_values.append(np.asarray(model_probabilities[name], dtype=float))

    meta_input = np.column_stack(meta_values)
    if hybrid_engine.meta_scaler is not None:
        meta_input = hybrid_engine.meta_scaler.transform(meta_input)
    hybrid_prob = hybrid_engine.meta.predict_proba(meta_input)[:, 1]
    model_probabilities["Hybrid"] = hybrid_prob

    models = []
    for model_name, probs in model_probabilities.items():
        threshold = hybrid_engine.meta_threshold if model_name == "Hybrid" else 0.5
        y_pred = (np.asarray(probs, dtype=float) >= float(threshold)).astype(int)
        metrics = _metric_summary_from_binary(y_test, y_pred)
        models.append(
            {
                "name": model_name,
                **metrics,
            }
        )

    models = sorted(models, key=lambda item: (item["f1_score"], item["accuracy"]), reverse=True)
    return {
        "models": models,
        "best_model": models[0]["name"] if models else None,
        "test_size": int(len(y_test)),
    }


@app.route("/api/predict", methods=["POST", "OPTIONS"])
def api_predict():
    if request.method == "OPTIONS":
        return _api_success({})

    try:
        payload = request.get_json(silent=True)
        if payload is None:
            payload = request.form.to_dict()
        values, amount = _parse_api_manual_input(payload)
        result = _predict_json_payload(values, amount, input_type="manual")
        return _api_success(result)
    except Exception as e:
        return _api_error(f"Prediction failed: {str(e)}")


@app.route("/api/predict_row", methods=["POST", "OPTIONS"])
def api_predict_row():
    if request.method == "OPTIONS":
        return _api_success({})

    try:
        payload = request.get_json(silent=True) or request.form.to_dict()
        row_value = payload.get("row_id") if isinstance(payload, dict) else None
        if row_value is None or str(row_value).strip() == "":
            raise ValueError("row_id is required.")

        row_id = int(str(row_value).strip())
        data = _load_api_row_dataset()
        validate_dataset_columns(data)

        if row_id < 0 or row_id >= len(data):
            raise ValueError(f"Invalid row index. Use 0 to {len(data) - 1}.")

        row = data.iloc[row_id]
        values, amount = extract_model_input_from_row(row)
        result = _predict_json_payload(values, amount, input_type="row")
        result["row_id"] = row_id
        return _api_success(result)
    except Exception as e:
        return _api_error(f"Row prediction failed: {str(e)}")


@app.route("/api/random_test", methods=["GET", "OPTIONS"])
def api_random_test():
    if request.method == "OPTIONS":
        return _api_success({})

    try:
        data = _load_api_row_dataset()
        validate_dataset_columns(data)
        if len(data) == 0:
            raise ValueError("Dataset is empty.")

        row_id = random.randint(0, len(data) - 1)
        row = data.iloc[row_id]
        values, amount = extract_model_input_from_row(row)
        result = _predict_json_payload(values, amount, input_type="random")
        result["row_id"] = row_id
        return _api_success(result)
    except Exception as e:
        return _api_error(f"Random test failed: {str(e)}")


@app.route("/api/upload_csv", methods=["POST", "OPTIONS"])
def api_upload_csv():
    if request.method == "OPTIONS":
        return _api_success({})
    return upload_csv()


@app.route("/api/evaluate", methods=["GET", "OPTIONS"])
def api_evaluate():
    if request.method == "OPTIONS":
        return _api_success({})
    return evaluate()


@app.route("/api/model_comparison", methods=["GET", "OPTIONS"])
def api_model_comparison():
    if request.method == "OPTIONS":
        return _api_success({})

    try:
        x_test, y_test = load_test_data()
        if hybrid_engine.ready:
            payload = _hybrid_model_comparison_payload(x_test, y_test)
            return _api_success(payload)

        legacy = get_legacy_model()
        if legacy is None:
            raise RuntimeError("No usable model found for comparison.")

        eval_model = LegacyEvaluationModel(legacy)
        y_pred = eval_model.predict(x_test)
        metrics = _metric_summary_from_binary(y_test, y_pred)
        payload = {
            "models": [{"name": "LegacyModel", **metrics}],
            "best_model": "LegacyModel",
            "test_size": int(len(y_test)),
        }
        return _api_success(payload)
    except Exception as e:
        return _api_error(f"Model comparison failed: {str(e)}")


@app.route("/api/stats", methods=["GET", "OPTIONS"])
def api_stats():
    if request.method == "OPTIONS":
        return _api_success({})

    try:
        payload = _compute_live_stats()
        return _api_success(payload)
    except Exception as e:
        return _api_error(f"Stats unavailable: {str(e)}", status_code=500)


@app.route("/api/home_metrics", methods=["GET", "OPTIONS"])
def api_home_metrics():
    if request.method == "OPTIONS":
        return _api_success({})

    try:
        payload = _get_cached_home_metrics(ttl_seconds=45)
        return _api_success(payload)
    except Exception as e:
        return _api_error(f"Home metrics unavailable: {str(e)}", status_code=500)


@app.route("/api/status", methods=["GET", "OPTIONS"])
def api_status():
    if request.method == "OPTIONS":
        return _api_success({})

    return _api_success(
        {
            "api": "online",
            "hybrid_ready": bool(hybrid_engine.ready),
            "model_message": str(hybrid_engine.message),
        }
    )


if __name__ == "__main__":
    app.run(debug=True)
