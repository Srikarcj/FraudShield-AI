from pathlib import Path
import json
import os

import joblib
import numpy as np
import pandas as pd

try:
    from imblearn.over_sampling import SMOTE
except ModuleNotFoundError as exc:
    raise ModuleNotFoundError("Missing dependency: imbalanced-learn. Install with: pip install imbalanced-learn") from exc

from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, fbeta_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

try:
    from xgboost import XGBClassifier
except ModuleNotFoundError as exc:
    raise ModuleNotFoundError("Missing dependency: xgboost. Install with: pip install xgboost") from exc

from arima_model import score_anomaly_batch, train_arima_model

try:
    from cnn_model import predict_cnn_proba, train_cnn_model
    from lstm_model import predict_lstm_proba, train_lstm_model
    from transformer_model import predict_transformer_proba, train_transformer_model
except ModuleNotFoundError as exc:
    raise ModuleNotFoundError(
        "Missing dependency for deep models. Install TensorFlow with: pip install tensorflow"
    ) from exc

RANDOM_STATE = 42
FEATURE_COLUMNS = [f"V{i}" for i in range(1, 29)]
TARGET_COLUMN = "Class"
AMOUNT_COLUMN = "Amount"
DATASET_PATH = Path("dataset") / "creditcard.csv"
IMPROVED_DATASET_PATH = Path("dataset") / "creditcard_improved.csv"
MODELS_DIR = Path("models")
MAX_DL_SAMPLES = 120000
DL_EPOCHS = 30
DL_BATCH_SIZE = 32
META_THRESHOLD_BETA = 2.0
MIN_COMPONENT_AUC = 0.55
MIN_COMPONENT_COUNT = 3
COMPONENT_ORDER = ["RF", "LR", "XGB", "ARIMA", "LSTM", "CNN", "Transformer"]


def build_model_feature_matrix(v_feature_matrix, amount_values):
    v = np.asarray(v_feature_matrix, dtype=float)
    amount = np.asarray(amount_values, dtype=float).reshape(-1, 1)
    log_amount = np.log1p(np.clip(amount, 0.0, None))
    return np.hstack([v, log_amount])


def downsample_for_dl(x, y, max_samples=MAX_DL_SAMPLES):
    if len(y) <= max_samples:
        return x, y

    rng = np.random.default_rng(RANDOM_STATE)
    y = np.asarray(y)
    pos_idx = np.where(y == 1)[0]
    neg_idx = np.where(y == 0)[0]
    if len(pos_idx) == 0 or len(neg_idx) == 0:
        return x, y

    half = max_samples // 2
    pos_take = min(len(pos_idx), half)
    neg_take = min(len(neg_idx), max_samples - pos_take)

    if pos_take + neg_take < max_samples:
        remaining = max_samples - (pos_take + neg_take)
        extra_neg = min(remaining, len(neg_idx) - neg_take)
        neg_take += extra_neg
        remaining = max_samples - (pos_take + neg_take)
        extra_pos = min(remaining, len(pos_idx) - pos_take)
        pos_take += extra_pos

    chosen = np.concatenate(
        [
            rng.choice(pos_idx, size=pos_take, replace=False),
            rng.choice(neg_idx, size=neg_take, replace=False),
        ]
    )
    rng.shuffle(chosen)
    return x[chosen], y[chosen]


def apply_smote_if_needed(x_train_scaled, y_train, desired_ratio=0.8):
    """
    Apply SMOTE only when minority/majority ratio is below desired_ratio.
    If data is already balanced (or close), return original data unchanged.
    """
    y_arr = np.asarray(y_train, dtype=int)
    classes, counts = np.unique(y_arr, return_counts=True)
    if len(classes) < 2:
        return x_train_scaled, y_arr

    count_map = {int(c): int(n) for c, n in zip(classes, counts)}
    minority_class = min(count_map, key=count_map.get)
    majority_class = max(count_map, key=count_map.get)
    minority_count = count_map[minority_class]
    majority_count = count_map[majority_class]

    if minority_count <= 1:
        return x_train_scaled, y_arr

    current_ratio = minority_count / max(majority_count, 1)
    if current_ratio >= desired_ratio:
        return x_train_scaled, y_arr

    k_neighbors = max(1, min(5, minority_count - 1))
    smote = SMOTE(
        random_state=RANDOM_STATE,
        sampling_strategy=desired_ratio,
        k_neighbors=k_neighbors,
    )
    return smote.fit_resample(x_train_scaled, y_arr)


def resolve_dataset_path():
    override = os.getenv("DATASET_PATH")
    if override:
        return Path(override)
    if IMPROVED_DATASET_PATH.exists():
        return IMPROVED_DATASET_PATH
    return DATASET_PATH


def find_best_threshold(y_true, y_prob, beta=META_THRESHOLD_BETA):
    y_true = np.asarray(y_true, dtype=int)
    y_prob = np.asarray(y_prob, dtype=float)

    rounded_probs = np.clip(np.round(y_prob, 4), 0.01, 0.99)
    uniform_grid = np.linspace(0.01, 0.99, 99)
    candidates = np.unique(np.concatenate([uniform_grid, rounded_probs]))

    best_threshold = 0.5
    best_score = -1.0

    for threshold in candidates:
        y_pred = (y_prob >= threshold).astype(int)
        score = fbeta_score(y_true, y_pred, beta=beta, zero_division=0)
        if score > best_score:
            best_score = score
            best_threshold = float(threshold)

    return best_threshold, best_score


def create_component_outputs(
    rf_model,
    lr_model,
    xgb_model,
    arima_artifact,
    lstm_model,
    cnn_model,
    transformer_model,
    x_scaled,
    amount_values,
):
    return {
        "RF": rf_model.predict_proba(x_scaled)[:, 1],
        "LR": lr_model.predict_proba(x_scaled)[:, 1],
        "XGB": xgb_model.predict_proba(x_scaled)[:, 1],
        "ARIMA": score_anomaly_batch(amount_values, arima_artifact, context_features=x_scaled),
        "LSTM": predict_lstm_proba(lstm_model, x_scaled),
        "CNN": predict_cnn_proba(cnn_model, x_scaled),
        "Transformer": predict_transformer_proba(transformer_model, x_scaled),
    }


def build_meta_matrix(component_outputs, selected_components):
    missing = [name for name in selected_components if name not in component_outputs]
    if missing:
        raise ValueError(f"Missing component outputs for: {missing}")

    stacked = [np.asarray(component_outputs[name], dtype=float) for name in selected_components]
    return np.column_stack(stacked)


def select_components(component_outputs, y_true, min_auc=MIN_COMPONENT_AUC, min_components=MIN_COMPONENT_COUNT):
    y_true_arr = np.asarray(y_true, dtype=int)
    ranked = []
    auc_map = {}

    for name in COMPONENT_ORDER:
        scores = np.asarray(component_outputs[name], dtype=float)
        try:
            auc_val = float(roc_auc_score(y_true_arr, scores))
        except ValueError:
            auc_val = 0.5
        auc_map[name] = auc_val
        ranked.append((name, auc_val))

    ranked.sort(key=lambda item: item[1], reverse=True)

    selected = [name for name, auc_val in ranked if auc_val >= min_auc]
    if len(selected) < min_components:
        selected = [name for name, _ in ranked[:min_components]]

    return selected, auc_map


def summarize_component_metrics(y_true, component_outputs):
    y_true_arr = np.asarray(y_true, dtype=int)
    metrics = {}
    for name in COMPONENT_ORDER:
        scores = np.asarray(component_outputs[name], dtype=float)
        preds = (scores >= 0.5).astype(int)
        try:
            auc_val = float(roc_auc_score(y_true_arr, scores))
        except ValueError:
            auc_val = 0.5
        metrics[name] = {
            "roc_auc": auc_val,
            "accuracy": float(accuracy_score(y_true_arr, preds)),
            "precision": float(precision_score(y_true_arr, preds, zero_division=0)),
            "recall": float(recall_score(y_true_arr, preds, zero_division=0)),
            "f1": float(f1_score(y_true_arr, preds, zero_division=0)),
        }
    return metrics


def print_metrics(y_true, y_pred, y_prob, threshold):
    accuracy = accuracy_score(y_true, y_pred)
    cm = confusion_matrix(y_true, y_pred)
    roc_auc = roc_auc_score(y_true, y_prob)
    precision = precision_score(y_true, y_pred, zero_division=0)
    recall = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)

    print("\n=== Final Hybrid Stacking Evaluation ===")
    print("Confusion Matrix:")
    print(cm)
    print(f"Accuracy:  {accuracy:.6f}")
    print(f"ROC-AUC:   {roc_auc:.6f}")
    print(f"Precision: {precision:.6f}")
    print(f"Recall:    {recall:.6f}")
    print(f"F1 Score:  {f1:.6f}")
    print(f"Threshold: {threshold:.2f}")

    return {
        "accuracy": float(accuracy),
        "roc_auc": float(roc_auc),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "threshold": float(threshold),
        "confusion_matrix": cm.tolist(),
    }


def main():
    dataset_path = resolve_dataset_path()
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")

    print(f"Using dataset: {dataset_path}")
    data = pd.read_csv(dataset_path)
    missing_columns = [c for c in FEATURE_COLUMNS + [TARGET_COLUMN] if c not in data.columns]
    if missing_columns:
        raise ValueError(f"Dataset missing required columns: {missing_columns}")

    if AMOUNT_COLUMN in data.columns:
        amount_series = data[AMOUNT_COLUMN].astype(float).fillna(0.0).to_numpy()
    else:
        amount_series = np.zeros(len(data), dtype=float)

    x_v = data[FEATURE_COLUMNS].astype(float).to_numpy()
    x = build_model_feature_matrix(x_v, amount_series)
    y = data[TARGET_COLUMN].astype(int).to_numpy()

    x_train, x_temp, y_train, y_temp, amount_train, amount_temp = train_test_split(
        x,
        y,
        amount_series,
        test_size=0.30,
        stratify=y,
        random_state=RANDOM_STATE,
    )
    x_meta, x_test, y_meta, y_test, amount_meta, amount_test = train_test_split(
        x_temp,
        y_temp,
        amount_temp,
        test_size=0.5,
        stratify=y_temp,
        random_state=RANDOM_STATE,
    )
    print(
        "Split sizes -> "
        f"train={len(y_train)} (fraud={int(np.sum(y_train == 1))}), "
        f"meta={len(y_meta)} (fraud={int(np.sum(y_meta == 1))}), "
        f"test={len(y_test)} (fraud={int(np.sum(y_test == 1))})"
    )

    scaler = StandardScaler()
    x_train_scaled = scaler.fit_transform(x_train)
    x_meta_scaled = scaler.transform(x_meta)
    x_test_scaled = scaler.transform(x_test)

    x_train_balanced, y_train_balanced = apply_smote_if_needed(
        x_train_scaled=x_train_scaled,
        y_train=y_train,
        desired_ratio=0.8,
    )

    print(
        "After SMOTE -> "
        f"samples={len(y_train_balanced)}, "
        f"fraud={int(np.sum(y_train_balanced == 1))}, "
        f"safe={int(np.sum(y_train_balanced == 0))}"
    )

    print("Training base ML models (RF, LR, XGB)...")
    rf_model = RandomForestClassifier(
        n_estimators=500,
        max_depth=8,
        min_samples_leaf=2,
        class_weight="balanced_subsample",
        random_state=RANDOM_STATE,
        n_jobs=1,
    )
    rf_model.fit(x_train_balanced, y_train_balanced)

    lr_model = LogisticRegression(
        max_iter=2000,
        C=0.6,
        class_weight="balanced",
        random_state=RANDOM_STATE,
    )
    lr_model.fit(x_train_balanced, y_train_balanced)

    neg_count = int(np.sum(y_train == 0))
    pos_count = max(int(np.sum(y_train == 1)), 1)
    xgb_scale_pos_weight = neg_count / pos_count

    xgb_model = XGBClassifier(
        n_estimators=450,
        max_depth=4,
        learning_rate=0.03,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=2,
        gamma=0.2,
        reg_lambda=2.0,
        objective="binary:logistic",
        eval_metric="logloss",
        scale_pos_weight=xgb_scale_pos_weight,
        random_state=RANDOM_STATE,
        n_jobs=1,
        tree_method="hist",
    )
    xgb_model.fit(x_train_scaled, y_train)

    print("Training ARIMA model...")
    try:
        arima_artifact = train_arima_model(
            amount_train,
            order=(2, 1, 2),
            y_labels=y_train,
            context_features=x_train_scaled,
        )
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError("Missing dependency: statsmodels. Install with: pip install statsmodels") from exc

    print("Training deep learning models (LSTM, CNN, Transformer)...")
    x_dl, y_dl = downsample_for_dl(x_train_scaled, y_train)
    lstm_model = train_lstm_model(x_dl, y_dl, epochs=DL_EPOCHS, batch_size=DL_BATCH_SIZE, random_state=RANDOM_STATE)
    cnn_model = train_cnn_model(x_dl, y_dl, epochs=DL_EPOCHS, batch_size=DL_BATCH_SIZE, random_state=RANDOM_STATE)
    transformer_model = train_transformer_model(
        x_dl,
        y_dl,
        epochs=DL_EPOCHS,
        batch_size=DL_BATCH_SIZE,
        random_state=RANDOM_STATE,
    )

    print("Building stacking meta-features...")
    meta_components = create_component_outputs(
        rf_model=rf_model,
        lr_model=lr_model,
        xgb_model=xgb_model,
        arima_artifact=arima_artifact,
        lstm_model=lstm_model,
        cnn_model=cnn_model,
        transformer_model=transformer_model,
        x_scaled=x_meta_scaled,
        amount_values=amount_meta,
    )

    test_components = create_component_outputs(
        rf_model=rf_model,
        lr_model=lr_model,
        xgb_model=xgb_model,
        arima_artifact=arima_artifact,
        lstm_model=lstm_model,
        cnn_model=cnn_model,
        transformer_model=transformer_model,
        x_scaled=x_test_scaled,
        amount_values=amount_test,
    )

    selected_components, component_auc = select_components(meta_components, y_meta)
    print("Selected components for meta-model:", ", ".join(selected_components))
    for name in COMPONENT_ORDER:
        print(f" - {name}: meta ROC-AUC = {component_auc[name]:.6f}")

    component_metrics_meta = summarize_component_metrics(y_meta, meta_components)
    component_metrics_test = summarize_component_metrics(y_test, test_components)
    print("Component quality snapshot:")
    for name in COMPONENT_ORDER:
        meta_auc = component_metrics_meta[name]["roc_auc"]
        test_auc = component_metrics_test[name]["roc_auc"]
        print(f" - {name}: meta AUC={meta_auc:.6f} | test AUC={test_auc:.6f}")

    meta_x = build_meta_matrix(meta_components, selected_components)
    test_x = build_meta_matrix(test_components, selected_components)

    print("Training meta-model...")
    meta_scaler = StandardScaler()
    meta_x_scaled = meta_scaler.fit_transform(meta_x)
    test_x_scaled = meta_scaler.transform(test_x)

    meta_model = LogisticRegression(
        max_iter=2000,
        C=0.8,
        random_state=RANDOM_STATE,
        class_weight="balanced",
    )
    meta_model.fit(meta_x_scaled, y_meta)

    meta_train_prob = meta_model.predict_proba(meta_x_scaled)[:, 1]
    best_threshold, best_fbeta = find_best_threshold(y_meta, meta_train_prob, beta=META_THRESHOLD_BETA)
    print(f"Chosen threshold based on F{META_THRESHOLD_BETA:.1f}: {best_threshold:.2f} (score={best_fbeta:.6f})")

    y_prob = meta_model.predict_proba(test_x_scaled)[:, 1]
    y_pred = (y_prob >= best_threshold).astype(int)
    final_metrics = print_metrics(y_test, y_pred, y_prob, threshold=best_threshold)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    joblib.dump(rf_model, MODELS_DIR / "rf.pkl")
    joblib.dump(lr_model, MODELS_DIR / "lr.pkl")
    joblib.dump(xgb_model, MODELS_DIR / "xgb.pkl")
    joblib.dump(
        {
            "model": meta_model,
            "threshold": best_threshold,
            "components": selected_components,
            "meta_component_auc": component_auc,
        },
        MODELS_DIR / "meta.pkl",
    )
    joblib.dump(arima_artifact, MODELS_DIR / "arima.pkl")
    joblib.dump(scaler, MODELS_DIR / "scaler.pkl")
    joblib.dump(meta_scaler, MODELS_DIR / "meta_scaler.pkl")

    lstm_model.save(MODELS_DIR / "lstm.h5")
    cnn_model.save(MODELS_DIR / "cnn.h5")
    transformer_model.save(MODELS_DIR / "transformer.h5")

    training_report = {
        "dataset_path": str(dataset_path),
        "split_sizes": {
            "train": int(len(y_train)),
            "meta": int(len(y_meta)),
            "test": int(len(y_test)),
        },
        "fraud_counts": {
            "train": int(np.sum(y_train == 1)),
            "meta": int(np.sum(y_meta == 1)),
            "test": int(np.sum(y_test == 1)),
        },
        "selected_components": selected_components,
        "meta_component_auc": component_auc,
        "component_metrics_meta": component_metrics_meta,
        "component_metrics_test": component_metrics_test,
        "meta_threshold_beta": float(META_THRESHOLD_BETA),
        "meta_threshold_score": float(best_fbeta),
        "final_test_metrics": final_metrics,
    }
    report_path = MODELS_DIR / "training_report.json"
    report_path.write_text(json.dumps(training_report, indent=2), encoding="utf-8")

    print("\nSaved upgraded hybrid artifacts in ./models/")
    print(" - rf.pkl")
    print(" - lr.pkl")
    print(" - xgb.pkl")
    print(" - meta.pkl")
    print(" - arima.pkl")
    print(" - scaler.pkl")
    print(" - meta_scaler.pkl")
    print(" - lstm.h5")
    print(" - cnn.h5")
    print(" - transformer.h5")
    print(" - training_report.json")


if __name__ == "__main__":
    main()
