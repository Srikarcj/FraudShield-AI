import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from statsmodels.tsa.arima.model import ARIMA

DEFAULT_ORDER_CANDIDATES = [
    (1, 0, 0),
    (1, 1, 0),
    (1, 1, 1),
    (2, 1, 1),
    (2, 1, 2),
    (3, 1, 2),
]


def _safe_array(values):
    return np.asarray(values, dtype=float).reshape(-1)


def _fit_best_arima(series, order_candidates):
    best_model = None
    best_order = None
    best_aic = float("inf")

    for order in order_candidates:
        try:
            candidate = ARIMA(
                series,
                order=order,
                enforce_stationarity=False,
                enforce_invertibility=False,
            ).fit()
            candidate_aic = float(getattr(candidate, "aic", np.inf))
            if np.isfinite(candidate_aic) and candidate_aic < best_aic:
                best_model = candidate
                best_order = order
                best_aic = candidate_aic
        except Exception:
            continue

    if best_model is None:
        best_order = (1, 0, 0)
        best_model = ARIMA(
            series,
            order=best_order,
            enforce_stationarity=False,
            enforce_invertibility=False,
        ).fit()
        best_aic = float(getattr(best_model, "aic", np.inf))

    return best_model, best_order, best_aic


def _in_sample_pred(fitted_model, n_points):
    try:
        preds = fitted_model.predict(start=0, end=n_points - 1, typ="levels")
        return _safe_array(preds)
    except Exception:
        one_step = fitted_model.forecast(steps=1)
        baseline = float(_safe_array(one_step)[0])
        return np.full(n_points, baseline, dtype=float)


def _build_calibration_features(raw_scores, amounts, amount_mean, amount_std, context_features=None):
    raw = _safe_array(raw_scores)
    amt = _safe_array(amounts)
    log_amt = np.log1p(np.clip(amt, 0.0, None))
    scaled_amt = (amt - float(amount_mean)) / max(float(amount_std), 1e-8)

    if context_features is None:
        context_block = np.zeros((len(raw), 0), dtype=float)
    else:
        ctx = np.asarray(context_features, dtype=float)
        if ctx.ndim == 1:
            ctx = ctx.reshape(-1, 1)
        if len(ctx) != len(raw):
            min_rows = min(len(ctx), len(raw))
            ctx = ctx[:min_rows]
            raw = raw[:min_rows]
            log_amt = log_amt[:min_rows]
            scaled_amt = scaled_amt[:min_rows]
        context_block = ctx

    base = np.column_stack([raw, log_amt, scaled_amt])
    if context_block.shape[1] == 0:
        return base
    return np.hstack([base, context_block])


def train_arima_model(amount_series, order=(2, 1, 2), y_labels=None, context_features=None):
    """
    Train ARIMA on historical transaction Amount values, then calibrate
    anomaly scores into fraud probability when labels are available.
    Returns a serializable artifact dictionary.
    """
    series = pd.Series(amount_series).astype(float).fillna(0.0)
    if len(series) < 20:
        order_candidates = [(1, 0, 0), (1, 1, 0)]
    else:
        order_candidates = list(DEFAULT_ORDER_CANDIDATES)

    if isinstance(order, tuple):
        order_candidates = [order] + [o for o in order_candidates if o != order]

    fitted, best_order, best_aic = _fit_best_arima(series, order_candidates)

    series_arr = _safe_array(series)
    residuals = _safe_array(fitted.resid)
    residual_std = float(np.std(residuals)) if residuals.size else 1.0
    residual_std = residual_std if residual_std > 1e-8 else 1.0

    forecast_one = fitted.forecast(steps=1)
    if hasattr(forecast_one, "iloc"):
        next_forecast = float(forecast_one.iloc[0])
    else:
        next_forecast = float(np.asarray(forecast_one, dtype=float).reshape(-1)[0])

    amount_mean = float(np.mean(series_arr)) if series_arr.size else 0.0
    amount_std = float(np.std(series_arr)) if series_arr.size else 1.0
    amount_std = amount_std if amount_std > 1e-8 else 1.0

    calibrator = None
    y_arr = None
    if y_labels is not None:
        y_arr = np.asarray(y_labels, dtype=int).reshape(-1)

    if y_arr is not None and len(y_arr) == len(series_arr) and len(np.unique(y_arr)) == 2:
        in_sample_preds = _in_sample_pred(fitted, len(series_arr))
        raw_scores = np.abs(series_arr - in_sample_preds) / residual_std
        cal_x = _build_calibration_features(
            raw_scores,
            series_arr,
            amount_mean,
            amount_std,
            context_features=context_features,
        )
        calibrator = LogisticRegression(
            max_iter=2000,
            class_weight="balanced",
            random_state=42,
        )
        calibrator.fit(cal_x, y_arr)

    return {
        "model": fitted,
        "order": best_order,
        "aic": best_aic,
        "residual_std": residual_std,
        "next_forecast": next_forecast,
        "amount_mean": amount_mean,
        "amount_std": amount_std,
        "calibrator": calibrator,
    }


def score_anomaly_batch(amount_values, arima_artifact, context_features=None):
    """
    Batch anomaly score = |actual - predicted| / residual_std.
    """
    amounts = np.asarray(amount_values, dtype=float)
    if amounts.size == 0:
        return np.array([], dtype=float)

    model = arima_artifact["model"]
    residual_std = max(float(arima_artifact.get("residual_std", 1.0)), 1e-8)
    fallback = float(arima_artifact.get("next_forecast", 0.0))
    amount_mean = float(arima_artifact.get("amount_mean", 0.0))
    amount_std = max(float(arima_artifact.get("amount_std", 1.0)), 1e-8)
    calibrator = arima_artifact.get("calibrator")

    try:
        preds = _safe_array(model.forecast(steps=len(amounts)))
    except Exception:
        preds = np.full_like(amounts, fill_value=fallback, dtype=float)

    raw_scores = np.abs(amounts - preds) / residual_std
    if calibrator is not None:
        features = _build_calibration_features(
            raw_scores,
            amounts,
            amount_mean,
            amount_std,
            context_features=context_features,
        )
        try:
            return calibrator.predict_proba(features)[:, 1].astype(float)
        except Exception:
            return raw_scores.astype(float)
    return raw_scores.astype(float)


def score_anomaly_single(amount_value, arima_artifact, context_features=None):
    amount = float(amount_value)
    residual_std = max(float(arima_artifact.get("residual_std", 1.0)), 1e-8)
    baseline = float(arima_artifact.get("next_forecast", 0.0))
    raw_score = abs(amount - baseline) / residual_std

    calibrator = arima_artifact.get("calibrator")
    if calibrator is not None:
        amount_mean = float(arima_artifact.get("amount_mean", 0.0))
        amount_std = max(float(arima_artifact.get("amount_std", 1.0)), 1e-8)
        features = _build_calibration_features(
            raw_scores=np.array([raw_score], dtype=float),
            amounts=np.array([amount], dtype=float),
            amount_mean=amount_mean,
            amount_std=amount_std,
            context_features=context_features,
        )
        try:
            return float(calibrator.predict_proba(features)[0][1])
        except Exception:
            return float(raw_score)
    return float(raw_score)
