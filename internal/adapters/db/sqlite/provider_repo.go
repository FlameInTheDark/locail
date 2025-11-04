package sqlite

import (
    "context"
    "database/sql"
    sq "github.com/Masterminds/squirrel"
    "locail/internal/domain"
    "time"
)

type ProviderRepo struct{ *Repo }

func NewProviderRepo(db *sql.DB) *ProviderRepo { return &ProviderRepo{NewRepo(db)} }

func (r *ProviderRepo) Create(ctx context.Context, p *domain.Provider) error {
    now := time.Now().UTC().Format(time.RFC3339)
    q := r.SQ.Insert("providers").Columns("type","name","base_url","model","api_key","options_json","created_at","updated_at").
        Values(p.Type, p.Name, p.BaseURL, p.Model, p.APIKey, p.OptionsRaw, now, now)
    sqlStr, args, _ := q.ToSql()
    res, err := r.DB.ExecContext(ctx, sqlStr, args...)
    if err != nil { return err }
    id, _ := res.LastInsertId()
    p.ID = id
    return nil
}

func (r *ProviderRepo) Update(ctx context.Context, p *domain.Provider) error {
    now := time.Now().UTC().Format(time.RFC3339)
    q := r.SQ.Update("providers").
        Set("type", p.Type).Set("name", p.Name).Set("base_url", p.BaseURL).Set("model", p.Model).Set("api_key", p.APIKey).Set("options_json", p.OptionsRaw).Set("updated_at", now).
        Where(sq.Eq{"id": p.ID})
    sqlStr, args, _ := q.ToSql()
    _, err := r.DB.ExecContext(ctx, sqlStr, args...)
    return err
}

func (r *ProviderRepo) Get(ctx context.Context, id int64) (*domain.Provider, error) {
    q := r.SQ.Select("id","type","name","base_url","model","api_key","options_json","created_at","updated_at").From("providers").Where(sq.Eq{"id": id})
    sqlStr, args, _ := q.ToSql()
    row := r.DB.QueryRowContext(ctx, sqlStr, args...)
    var p domain.Provider
    var created, updated string
    if err := row.Scan(&p.ID, &p.Type, &p.Name, &p.BaseURL, &p.Model, &p.APIKey, &p.OptionsRaw, &created, &updated); err != nil { return nil, err }
    p.CreatedAt, _ = time.Parse(time.RFC3339, created)
    p.UpdatedAt, _ = time.Parse(time.RFC3339, updated)
    return &p, nil
}

func (r *ProviderRepo) List(ctx context.Context) ([]*domain.Provider, error) {
    q := r.SQ.Select("id","type","name","base_url","model","api_key","options_json","created_at","updated_at").From("providers").OrderBy("id DESC")
    sqlStr, args, _ := q.ToSql()
    rows, err := r.DB.QueryContext(ctx, sqlStr, args...)
    if err != nil { return nil, err }
    defer rows.Close()
    var out []*domain.Provider
    for rows.Next() {
        var p domain.Provider
        var created, updated string
        if err := rows.Scan(&p.ID, &p.Type, &p.Name, &p.BaseURL, &p.Model, &p.APIKey, &p.OptionsRaw, &created, &updated); err != nil { return nil, err }
        p.CreatedAt, _ = time.Parse(time.RFC3339, created)
        p.UpdatedAt, _ = time.Parse(time.RFC3339, updated)
        out = append(out, &p)
    }
    return out, nil
}

func (r *ProviderRepo) Delete(ctx context.Context, id int64) error {
    q := r.SQ.Delete("providers").Where(sq.Eq{"id": id})
    sqlStr, args, _ := q.ToSql()
    _, err := r.DB.ExecContext(ctx, sqlStr, args...)
    return err
}

func (r *ProviderRepo) SaveModelCache(ctx context.Context, providerID int64, names []string) error {
    // simple approach: delete existing then insert
    del := r.SQ.Delete("provider_models").Where(sq.Eq{"provider_id": providerID})
    sqlStr, args, _ := del.ToSql()
    if _, err := r.DB.ExecContext(ctx, sqlStr, args...); err != nil { return err }
    if len(names) == 0 { return nil }
    ib := r.SQ.Insert("provider_models").Columns("provider_id","name")
    for _, n := range names { ib = ib.Values(providerID, n) }
    sqlStr, args, _ = ib.ToSql()
    _, err := r.DB.ExecContext(ctx, sqlStr, args...)
    return err
}

func (r *ProviderRepo) ListModelCache(ctx context.Context, providerID int64) ([]*domain.ProviderModel, error) {
    q := r.SQ.Select("id","provider_id","name","updated_at").From("provider_models").Where(sq.Eq{"provider_id": providerID}).OrderBy("name")
    sqlStr, args, _ := q.ToSql()
    rows, err := r.DB.QueryContext(ctx, sqlStr, args...)
    if err != nil { return nil, err }
    defer rows.Close()
    var out []*domain.ProviderModel
    for rows.Next() {
        var pm domain.ProviderModel
        var updated string
        if err := rows.Scan(&pm.ID, &pm.ProviderID, &pm.Name, &updated); err != nil { return nil, err }
        pm.UpdatedAt, _ = time.Parse(time.RFC3339, updated)
        out = append(out, &pm)
    }
    return out, nil
}
