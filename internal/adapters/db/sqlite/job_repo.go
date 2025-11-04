package sqlite

import (
    "context"
    "database/sql"
    sq "github.com/Masterminds/squirrel"
    "locail/internal/domain"
    "time"
)

type JobRepo struct{ *Repo }

func NewJobRepo(db *sql.DB) *JobRepo { return &JobRepo{NewRepo(db)} }

func (r *JobRepo) Create(ctx context.Context, j *domain.Job) (int64, error) {
    now := time.Now().UTC().Format(time.RFC3339)
    q := r.SQ.Insert("jobs").Columns("type","status","project_id","provider_id","params_json","progress","total","created_at","updated_at").
        Values(j.Type, j.Status, j.ProjectID, j.ProviderID, j.ParamsRaw, j.Progress, j.Total, now, now)
    sqlStr, args, _ := q.ToSql()
    res, err := r.DB.ExecContext(ctx, sqlStr, args...)
    if err != nil { return 0, err }
    id, _ := res.LastInsertId()
    j.ID = id
    return id, nil
}

func (r *JobRepo) UpdateProgress(ctx context.Context, jobID int64, done, total int, status string) error {
    now := time.Now().UTC().Format(time.RFC3339)
    q := r.SQ.Update("jobs").Set("progress", done).Set("total", total).Set("status", status).Set("updated_at", now).Where(sq.Eq{"id": jobID})
    sqlStr, args, _ := q.ToSql()
    _, err := r.DB.ExecContext(ctx, sqlStr, args...)
    return err
}

func (r *JobRepo) AddItem(ctx context.Context, ji *domain.JobItem) (int64, error) {
    now := time.Now().UTC().Format(time.RFC3339)
    q := r.SQ.Insert("job_items").Columns("job_id","unit_id","locale","status","error","created_at","updated_at").
        Values(ji.JobID, ji.UnitID, ji.Locale, ji.Status, ji.Error, now, now)
    sqlStr, args, _ := q.ToSql()
    res, err := r.DB.ExecContext(ctx, sqlStr, args...)
    if err != nil { return 0, err }
    id, _ := res.LastInsertId()
    ji.ID = id
    return id, nil
}

func (r *JobRepo) UpdateItem(ctx context.Context, itemID int64, status, errMsg string) error {
    now := time.Now().UTC().Format(time.RFC3339)
    q := r.SQ.Update("job_items").Set("status", status).Set("error", errMsg).Set("updated_at", now).Where(sq.Eq{"id": itemID})
    sqlStr, args, _ := q.ToSql()
    _, err := r.DB.ExecContext(ctx, sqlStr, args...)
    return err
}

func (r *JobRepo) AddLog(ctx context.Context, jl *domain.JobLog) error {
    q := r.SQ.Insert("job_logs").Columns("job_id","ts","level","message").Values(jl.JobID, time.Now().UTC().Format(time.RFC3339), jl.Level, jl.Message)
    sqlStr, args, _ := q.ToSql()
    _, err := r.DB.ExecContext(ctx, sqlStr, args...)
    return err
}

func (r *JobRepo) Get(ctx context.Context, jobID int64) (*domain.Job, error) {
    q := r.SQ.Select("id","type","status","project_id","provider_id","params_json","progress","total","created_at","updated_at").From("jobs").Where(sq.Eq{"id": jobID}).Limit(1)
    sqlStr, args, _ := q.ToSql()
    row := r.DB.QueryRowContext(ctx, sqlStr, args...)
    var j domain.Job
    var proj, prov sql.NullInt64
    var created, updated string
    if err := row.Scan(&j.ID, &j.Type, &j.Status, &proj, &prov, &j.ParamsRaw, &j.Progress, &j.Total, &created, &updated); err != nil {
        if err == sql.ErrNoRows { return nil, nil }
        return nil, err
    }
    if proj.Valid { v := proj.Int64; j.ProjectID = &v }
    if prov.Valid { v := prov.Int64; j.ProviderID = &v }
    j.CreatedAt, _ = time.Parse(time.RFC3339, created)
    j.UpdatedAt, _ = time.Parse(time.RFC3339, updated)
    return &j, nil
}

func (r *JobRepo) List(ctx context.Context, limit int) ([]*domain.Job, error) {
    if limit <= 0 { limit = 50 }
    q := r.SQ.Select("id","type","status","project_id","provider_id","params_json","progress","total","created_at","updated_at").From("jobs").OrderBy("id DESC").Limit(uint64(limit))
    sqlStr, args, _ := q.ToSql()
    rows, err := r.DB.QueryContext(ctx, sqlStr, args...)
    if err != nil { return nil, err }
    defer rows.Close()
    var out []*domain.Job
    for rows.Next() {
        var j domain.Job
        var proj, prov sql.NullInt64
        var created, updated string
        if err := rows.Scan(&j.ID, &j.Type, &j.Status, &proj, &prov, &j.ParamsRaw, &j.Progress, &j.Total, &created, &updated); err != nil { return nil, err }
        if proj.Valid { v := proj.Int64; j.ProjectID = &v }
        if prov.Valid { v := prov.Int64; j.ProviderID = &v }
        j.CreatedAt, _ = time.Parse(time.RFC3339, created)
        j.UpdatedAt, _ = time.Parse(time.RFC3339, updated)
        out = append(out, &j)
    }
    return out, nil
}

func (r *JobRepo) ListItems(ctx context.Context, jobID int64) ([]*domain.JobItem, error) {
    q := r.SQ.Select("id","job_id","unit_id","locale","status","error","created_at","updated_at").From("job_items").Where(sq.Eq{"job_id": jobID}).OrderBy("id")
    sqlStr, args, _ := q.ToSql()
    rows, err := r.DB.QueryContext(ctx, sqlStr, args...)
    if err != nil { return nil, err }
    defer rows.Close()
    var out []*domain.JobItem
    for rows.Next() {
        var ji domain.JobItem
        var unit sql.NullInt64
        var loc sql.NullString
        var created, updated string
        if err := rows.Scan(&ji.ID, &ji.JobID, &unit, &loc, &ji.Status, &ji.Error, &created, &updated); err != nil { return nil, err }
        if unit.Valid { v := unit.Int64; ji.UnitID = &v }
        if loc.Valid { v := loc.String; ji.Locale = &v }
        ji.CreatedAt, _ = time.Parse(time.RFC3339, created)
        ji.UpdatedAt, _ = time.Parse(time.RFC3339, updated)
        out = append(out, &ji)
    }
    return out, nil
}

func (r *JobRepo) ListLogs(ctx context.Context, jobID int64, limit int) ([]*domain.JobLog, error) {
    if limit <= 0 { limit = 200 }
    q := r.SQ.Select("id","job_id","ts","level","message").From("job_logs").Where(sq.Eq{"job_id": jobID}).OrderBy("id DESC").Limit(uint64(limit))
    sqlStr, args, _ := q.ToSql()
    rows, err := r.DB.QueryContext(ctx, sqlStr, args...)
    if err != nil { return nil, err }
    defer rows.Close()
    var out []*domain.JobLog
    for rows.Next() {
        var jl domain.JobLog
        var ts string
        if err := rows.Scan(&jl.ID, &jl.JobID, &ts, &jl.Level, &jl.Message); err != nil { return nil, err }
        jl.Time, _ = time.Parse(time.RFC3339, ts)
        out = append(out, &jl)
    }
    // reverse to ascending
    for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 { out[i], out[j] = out[j], out[i] }
    return out, nil
}

func (r *JobRepo) Delete(ctx context.Context, jobID int64) error {
    // Deleting job will cascade to items/logs via FK
    q := r.SQ.Delete("jobs").Where(sq.Eq{"id": jobID})
    sqlStr, args, _ := q.ToSql()
    _, err := r.DB.ExecContext(ctx, sqlStr, args...)
    return err
}
