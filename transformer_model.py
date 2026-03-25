import numpy as np
from sklearn.model_selection import train_test_split
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.layers import (
    BatchNormalization,
    Concatenate,
    Dense,
    Dropout,
    Flatten,
    GlobalAveragePooling1D,
    Input,
    MultiHeadAttention,
)
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam


def _to_sequence(x):
    arr = np.asarray(x, dtype=np.float32)
    return arr.reshape((arr.shape[0], arr.shape[1], 1))


def build_transformer_model(n_features):
    inputs = Input(shape=(n_features, 1))

    # Attention branch: keeps a transformer-style interaction path across features.
    attn_tokens = Dense(16, activation="linear")(inputs)
    attn_tokens = MultiHeadAttention(num_heads=4, key_dim=8, dropout=0.1)(attn_tokens, attn_tokens)
    attn_features = GlobalAveragePooling1D()(attn_tokens)
    attn_features = Dense(32, activation="relu")(attn_features)

    # MLP branch: tabular-friendly pathway that stabilizes learning on compact datasets.
    dense_features = Flatten()(inputs)
    dense_features = Dense(128, activation="relu")(dense_features)
    dense_features = BatchNormalization()(dense_features)
    dense_features = Dropout(0.25)(dense_features)
    dense_features = Dense(64, activation="relu")(dense_features)
    dense_features = Dropout(0.2)(dense_features)
    dense_features = Dense(32, activation="relu")(dense_features)

    merged = Concatenate()([dense_features, attn_features])
    merged = Dense(32, activation="relu")(merged)
    outputs = Dense(1, activation="sigmoid")(merged)

    model = Model(inputs=inputs, outputs=outputs)
    model.compile(
        optimizer=Adam(learning_rate=8e-4),
        loss="binary_crossentropy",
        metrics=["AUC"],
    )
    return model


def _compute_class_weight(y):
    y_arr = np.asarray(y, dtype=int)
    pos = max(int(np.sum(y_arr == 1)), 1)
    neg = max(int(np.sum(y_arr == 0)), 1)
    total = pos + neg
    return {
        0: total / (2.0 * neg),
        1: total / (2.0 * pos),
    }


def train_transformer_model(x_train, y_train, epochs=18, batch_size=32, random_state=42):
    x = np.asarray(x_train, dtype=np.float32)
    y = np.asarray(y_train, dtype=np.float32)
    x_seq = _to_sequence(x)
    model = build_transformer_model(x_seq.shape[1])

    x_seq_train, x_seq_val, y_train_split, y_val_split = train_test_split(
        x_seq,
        y,
        test_size=0.2,
        random_state=random_state,
        stratify=y.astype(int),
    )

    stopper = EarlyStopping(
        monitor="val_AUC",
        mode="max",
        patience=8,
        restore_best_weights=True,
    )
    scheduler = ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.5,
        patience=2,
        min_lr=1e-5,
    )

    model.fit(
        x_seq_train,
        y_train_split,
        validation_data=(x_seq_val, y_val_split),
        epochs=epochs,
        batch_size=batch_size,
        verbose=2,
        callbacks=[stopper, scheduler],
        class_weight=_compute_class_weight(y_train_split),
        shuffle=True,
    )
    return model


def predict_transformer_proba(model, x):
    x_seq = _to_sequence(x)
    probs = model.predict(x_seq, verbose=0).reshape(-1)
    return probs.astype(float)
