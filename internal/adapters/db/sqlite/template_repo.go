package sqlite

import (
	"context"
	"database/sql"
	sq "github.com/Masterminds/squirrel"
	"locail/internal/domain"
)

type TemplateRepo struct{ *Repo }

func NewTemplateRepo(db *sql.DB) *TemplateRepo { return &TemplateRepo{NewRepo(db)} }

// GetEffective returns provider -> project -> global -> builtin (nil if none in DB).
func (r *TemplateRepo) GetEffective(ctx context.Context, scope string, refID *int64, typ, role string) (*domain.Template, error) {
	// Try exact scope first if refID is provided
	if (scope == "provider" || scope == "project") && refID != nil {
		t, err := r.getOne(ctx, scope, refID, typ, role)
		if err == nil && t != nil {
			return t, nil
		}
	}
	// Fallback to global
	t, err := r.getOne(ctx, "global", nil, typ, role)
	if err == nil && t != nil {
		return t, nil
	}
	return nil, err
}

func (r *TemplateRepo) getOne(ctx context.Context, scope string, refID *int64, typ, role string) (*domain.Template, error) {
	b := r.SQ.Select("id", "scope", "ref_id", "type", "role", "body", "is_default", "updated_at").From("templates").
		Where(sq.Eq{"scope": scope, "type": typ, "role": role}).
		OrderBy("id DESC").Limit(1)
	if refID != nil {
		b = b.Where(sq.Eq{"ref_id": *refID})
	} else {
		b = b.Where("ref_id IS NULL")
	}
	sqlStr, args, _ := b.ToSql()
	row := r.DB.QueryRowContext(ctx, sqlStr, args...)
	var t domain.Template
	var ref sql.NullInt64
	var updated string
	if err := row.Scan(&t.ID, &t.Scope, &ref, &t.Type, &t.Role, &t.Body, &t.IsDefault, &updated); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if ref.Valid {
		v := ref.Int64
		t.RefID = &v
	}
	return &t, nil
}

func (r *TemplateRepo) Upsert(ctx context.Context, t *domain.Template) error {
	// Simple upsert by unique key (scope, ref_id, type, role) if we had constraint; we don't, so insert new row
	q := r.SQ.Insert("templates").Columns("scope", "ref_id", "type", "role", "body", "is_default").
		Values(t.Scope, t.RefID, t.Type, t.Role, t.Body, t.IsDefault)
	sqlStr, args, _ := q.ToSql()
	_, err := r.DB.ExecContext(ctx, sqlStr, args...)
	return err
}
