package sqlite

import (
    "context"
    "crypto/sha256"
    "database/sql"
    "encoding/hex"
    sq "github.com/Masterminds/squirrel"
    "locail/internal/domain"
    "time"
)

type FileRepo struct{ *Repo }
type UnitRepo struct{ *Repo }

func NewFileRepo(db *sql.DB) *FileRepo { return &FileRepo{NewRepo(db)} }
func NewUnitRepo(db *sql.DB) *UnitRepo { return &UnitRepo{NewRepo(db)} }

func HashBytes(b []byte) string {
    h := sha256.Sum256(b)
    return hex.EncodeToString(h[:])
}

func (r *FileRepo) Create(ctx context.Context, f *domain.File) error {
    now := time.Now().UTC().Format(time.RFC3339)
    q := r.SQ.Insert("files").Columns("project_id","path","format","locale","hash","created_at").
        Values(f.ProjectID, f.Path, f.Format, f.Locale, f.Hash, now)
    sqlStr, args, _ := q.ToSql()
    res, err := r.DB.ExecContext(ctx, sqlStr, args...)
    if err != nil { return err }
    id, _ := res.LastInsertId()
    f.ID = id
    return nil
}

func (r *FileRepo) Get(ctx context.Context, id int64) (*domain.File, error) {
    q := r.SQ.Select("id","project_id","path","format","locale","hash","created_at").From("files").Where(sq.Eq{"id": id})
    sqlStr, args, _ := q.ToSql()
    row := r.DB.QueryRowContext(ctx, sqlStr, args...)
    var f domain.File
    var created string
    if err := row.Scan(&f.ID, &f.ProjectID, &f.Path, &f.Format, &f.Locale, &f.Hash, &created); err != nil { return nil, err }
    f.CreatedAt, _ = time.Parse(time.RFC3339, created)
    return &f, nil
}

func (r *FileRepo) ListByProject(ctx context.Context, projectID int64) ([]*domain.File, error) {
    q := r.SQ.Select("id","project_id","path","format","locale","hash","created_at").From("files").Where(sq.Eq{"project_id": projectID}).OrderBy("id DESC")
    sqlStr, args, _ := q.ToSql()
    rows, err := r.DB.QueryContext(ctx, sqlStr, args...)
    if err != nil { return nil, err }
    defer rows.Close()
    var out []*domain.File
    for rows.Next() {
        var f domain.File
        var created string
        if err := rows.Scan(&f.ID, &f.ProjectID, &f.Path, &f.Format, &f.Locale, &f.Hash, &created); err != nil { return nil, err }
        f.CreatedAt, _ = time.Parse(time.RFC3339, created)
        out = append(out, &f)
    }
    return out, nil
}

func (r *UnitRepo) UpsertBatch(ctx context.Context, units []*domain.Unit) error {
    if len(units) == 0 { return nil }
    // Use SQLite UPSERT
    // We will build multi-values insert
    ib := r.SQ.Insert("units").Columns("file_id","key","source_text","context","metadata_json")
    for _, u := range units {
        ib = ib.Values(u.FileID, u.Key, u.SourceText, u.Context, u.MetadataRaw)
    }
    sqlStr, args, _ := ib.Suffix("ON CONFLICT(file_id, key) DO UPDATE SET source_text=excluded.source_text, context=excluded.context, metadata_json=excluded.metadata_json").ToSql()
    _, err := r.DB.ExecContext(ctx, sqlStr, args...)
    return err
}

func (r *UnitRepo) ListByFile(ctx context.Context, fileID int64) ([]*domain.Unit, error) {
    q := r.SQ.Select("id","file_id","key","source_text","context","metadata_json","created_at").From("units").Where(sq.Eq{"file_id": fileID}).OrderBy("key")
    sqlStr, args, _ := q.ToSql()
    rows, err := r.DB.QueryContext(ctx, sqlStr, args...)
    if err != nil { return nil, err }
    defer rows.Close()
    var out []*domain.Unit
    for rows.Next() {
        var u domain.Unit
        var created string
        if err := rows.Scan(&u.ID, &u.FileID, &u.Key, &u.SourceText, &u.Context, &u.MetadataRaw, &created); err != nil { return nil, err }
        u.CreatedAt, _ = time.Parse(time.RFC3339, created)
        out = append(out, &u)
    }
    return out, nil
}

func (r *UnitRepo) Get(ctx context.Context, id int64) (*domain.Unit, error) {
    q := r.SQ.Select("id","file_id","key","source_text","context","metadata_json","created_at").From("units").Where(sq.Eq{"id": id}).Limit(1)
    sqlStr, args, _ := q.ToSql()
    row := r.DB.QueryRowContext(ctx, sqlStr, args...)
    var u domain.Unit
    var created string
    if err := row.Scan(&u.ID, &u.FileID, &u.Key, &u.SourceText, &u.Context, &u.MetadataRaw, &created); err != nil { return nil, err }
    u.CreatedAt, _ = time.Parse(time.RFC3339, created)
    return &u, nil
}
