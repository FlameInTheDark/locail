package sqlite

import (
    "context"
    "database/sql"
    sq "github.com/Masterminds/squirrel"
    "locail/internal/domain"
    "time"
)

type TranslationRepo struct{ *Repo }

func NewTranslationRepo(db *sql.DB) *TranslationRepo { return &TranslationRepo{NewRepo(db)} }

func (r *TranslationRepo) Upsert(ctx context.Context, t *domain.Translation) error {
    now := time.Now().UTC().Format(time.RFC3339)
    q := r.SQ.Insert("translations").Columns("unit_id","locale","text","status","provider_id","confidence","created_at","updated_at").
        Values(t.UnitID, t.Locale, t.Text, t.Status, t.ProviderID, t.Confidence, now, now).
        Suffix("ON CONFLICT(unit_id, locale) DO UPDATE SET text=excluded.text, status=excluded.status, provider_id=excluded.provider_id, confidence=excluded.confidence, updated_at=excluded.updated_at")
    sqlStr, args, _ := q.ToSql()
    _, err := r.DB.ExecContext(ctx, sqlStr, args...)
    return err
}

func (r *TranslationRepo) Get(ctx context.Context, unitID int64, locale string) (*domain.Translation, error) {
    q := r.SQ.Select("id","unit_id","locale","text","status","provider_id","confidence","created_at","updated_at").From("translations").
        Where(sq.Eq{"unit_id": unitID, "locale": locale}).Limit(1)
    sqlStr, args, _ := q.ToSql()
    row := r.DB.QueryRowContext(ctx, sqlStr, args...)
    var t domain.Translation
    var created, updated string
    var prov sql.NullInt64
    var conf sql.NullFloat64
    if err := row.Scan(&t.ID, &t.UnitID, &t.Locale, &t.Text, &t.Status, &prov, &conf, &created, &updated); err != nil {
        if err == sql.ErrNoRows { return nil, nil }
        return nil, err
    }
    if prov.Valid { v := prov.Int64; t.ProviderID = &v }
    if conf.Valid { v := conf.Float64; t.Confidence = &v }
    t.CreatedAt, _ = time.Parse(time.RFC3339, created)
    t.UpdatedAt, _ = time.Parse(time.RFC3339, updated)
    return &t, nil
}

func (r *TranslationRepo) ListByFileLocale(ctx context.Context, fileID int64, locale string) ([]*domain.Translation, error) {
    q := r.SQ.Select("t.id","t.unit_id","t.locale","t.text","t.status","t.provider_id","t.confidence","t.created_at","t.updated_at").
        From("translations t").Join("units u ON u.id = t.unit_id").Where(sq.Eq{"u.file_id": fileID, "t.locale": locale}).OrderBy("u.key")
    sqlStr, args, _ := q.ToSql()
    rows, err := r.DB.QueryContext(ctx, sqlStr, args...)
    if err != nil { return nil, err }
    defer rows.Close()
    var out []*domain.Translation
    for rows.Next() {
        var t domain.Translation
        var created, updated string
        var prov sql.NullInt64
        var conf sql.NullFloat64
        if err := rows.Scan(&t.ID, &t.UnitID, &t.Locale, &t.Text, &t.Status, &prov, &conf, &created, &updated); err != nil { return nil, err }
        if prov.Valid { v := prov.Int64; t.ProviderID = &v }
        if conf.Valid { v := conf.Float64; t.Confidence = &v }
        t.CreatedAt, _ = time.Parse(time.RFC3339, created)
        t.UpdatedAt, _ = time.Parse(time.RFC3339, updated)
        out = append(out, &t)
    }
    return out, nil
}

