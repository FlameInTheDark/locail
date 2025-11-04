package sqlite

import (
    "context"
    "database/sql"
    sq "github.com/Masterminds/squirrel"
    "locail/internal/domain"
    "time"
)

type ProjectRepo struct{ *Repo }

func NewProjectRepo(db *sql.DB) *ProjectRepo { return &ProjectRepo{NewRepo(db)} }

func (r *ProjectRepo) Create(ctx context.Context, p *domain.Project) error {
    now := time.Now().UTC()
    q := r.SQ.Insert("projects").Columns("name", "source_lang", "created_at", "updated_at").
        Values(p.Name, p.SourceLang, now.Format(time.RFC3339), now.Format(time.RFC3339))
    sqlStr, args, _ := q.ToSql()
    res, err := r.DB.ExecContext(ctx, sqlStr, args...)
    if err != nil { return err }
    id, _ := res.LastInsertId()
    p.ID = id; p.CreatedAt = now; p.UpdatedAt = now
    return nil
}

func (r *ProjectRepo) Get(ctx context.Context, id int64) (*domain.Project, error) {
    q := r.SQ.Select("id","name","source_lang","created_at","updated_at").From("projects").Where(sq.Eq{"id": id})
    sqlStr, args, _ := q.ToSql()
    row := r.DB.QueryRowContext(ctx, sqlStr, args...)
    var p domain.Project
    var created, updated string
    if err := row.Scan(&p.ID, &p.Name, &p.SourceLang, &created, &updated); err != nil { return nil, err }
    p.CreatedAt, _ = time.Parse(time.RFC3339, created)
    p.UpdatedAt, _ = time.Parse(time.RFC3339, updated)
    return &p, nil
}

func (r *ProjectRepo) List(ctx context.Context) ([]*domain.Project, error) {
    q := r.SQ.Select("id","name","source_lang","created_at","updated_at").From("projects").OrderBy("id DESC")
    sqlStr, args, _ := q.ToSql()
    rows, err := r.DB.QueryContext(ctx, sqlStr, args...)
    if err != nil { return nil, err }
    defer rows.Close()
    var out []*domain.Project
    for rows.Next() {
        var p domain.Project
        var created, updated string
        if err := rows.Scan(&p.ID, &p.Name, &p.SourceLang, &created, &updated); err != nil { return nil, err }
        p.CreatedAt, _ = time.Parse(time.RFC3339, created)
        p.UpdatedAt, _ = time.Parse(time.RFC3339, updated)
        out = append(out, &p)
    }
    return out, nil
}

func (r *ProjectRepo) Update(ctx context.Context, p *domain.Project) error {
    now := time.Now().UTC()
    q := r.SQ.Update("projects").Set("name", p.Name).Set("source_lang", p.SourceLang).Set("updated_at", now.Format(time.RFC3339)).
        Where(sq.Eq{"id": p.ID})
    sqlStr, args, _ := q.ToSql()
    if _, err := r.DB.ExecContext(ctx, sqlStr, args...); err != nil { return err }
    p.UpdatedAt = now
    return nil
}

func (r *ProjectRepo) Delete(ctx context.Context, id int64) error {
    q := r.SQ.Delete("projects").Where(sq.Eq{"id": id})
    sqlStr, args, _ := q.ToSql()
    _, err := r.DB.ExecContext(ctx, sqlStr, args...)
    return err
}

func (r *ProjectRepo) AddLocale(ctx context.Context, pl *domain.ProjectLocale) error {
    now := time.Now().UTC()
    q := r.SQ.Insert("project_locales").Columns("project_id","locale","created_at").
        Values(pl.ProjectID, pl.Locale, now.Format(time.RFC3339))
    sqlStr, args, _ := q.ToSql()
    res, err := r.DB.ExecContext(ctx, sqlStr, args...)
    if err != nil { return err }
    id, _ := res.LastInsertId()
    pl.ID = id; pl.CreatedAt = now
    return nil
}

func (r *ProjectRepo) ListLocales(ctx context.Context, projectID int64) ([]*domain.ProjectLocale, error) {
    q := r.SQ.Select("id","project_id","locale","created_at").From("project_locales").Where(sq.Eq{"project_id": projectID}).OrderBy("locale")
    sqlStr, args, _ := q.ToSql()
    rows, err := r.DB.QueryContext(ctx, sqlStr, args...)
    if err != nil { return nil, err }
    defer rows.Close()
    var out []*domain.ProjectLocale
    for rows.Next() {
        var pl domain.ProjectLocale
        var created string
        if err := rows.Scan(&pl.ID, &pl.ProjectID, &pl.Locale, &created); err != nil { return nil, err }
        pl.CreatedAt, _ = time.Parse(time.RFC3339, created)
        out = append(out, &pl)
    }
    return out, nil
}

