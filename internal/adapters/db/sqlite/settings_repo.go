package sqlite

import (
    "context"
    "database/sql"
)

type SettingsRepo struct{ *Repo }

func NewSettingsRepo(db *sql.DB) *SettingsRepo { return &SettingsRepo{NewRepo(db)} }

func (r *SettingsRepo) Get(ctx context.Context, key string) (string, error) {
    row := r.DB.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = ?`, key)
    var v string
    if err := row.Scan(&v); err != nil { return "", err }
    return v, nil
}

func (r *SettingsRepo) Set(ctx context.Context, key, value string) error {
    _, err := r.DB.ExecContext(ctx, `INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
    return err
}

