package sqlite

import (
	"context"
	"database/sql"
	"locail/internal/domain"
	"time"

	sq "github.com/Masterminds/squirrel"
)

type CacheRepo struct{ *Repo }

func NewCacheRepo(db *sql.DB) *CacheRepo { return &CacheRepo{NewRepo(db)} }

func (r *CacheRepo) Get(ctx context.Context, src, srcLang, tgtLang, provider, model string) (*domain.CacheEntry, error) {
	q := r.SQ.Select(
		"id",
		"source_text",
		"src_lang",
		"tgt_lang",
		"provider",
		"model",
		"translation",
		"created_at",
	).
		From("cache").
		Where(sq.Eq{
			"source_text": src,
			"src_lang":    srcLang,
			"tgt_lang":    tgtLang,
			"provider":    provider,
			"model":       model,
		}).
		Limit(1)
	sqlStr, args, _ := q.ToSql()
	row := r.DB.QueryRowContext(ctx, sqlStr, args...)
	var e domain.CacheEntry
	var created string
	if err := row.Scan(
		&e.ID,
		&e.SourceText,
		&e.SrcLang,
		&e.TgtLang,
		&e.Provider,
		&e.Model,
		&e.Translation,
		&created,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	e.CreatedAt, _ = time.Parse(time.RFC3339, created)
	return &e, nil
}

func (r *CacheRepo) Put(ctx context.Context, entry *domain.CacheEntry) error {
	q := r.SQ.
		Insert("cache").
		Columns(
			"source_text",
			"src_lang",
			"tgt_lang",
			"provider",
			"model",
			"translation",
		).
		Values(
			entry.SourceText,
			entry.SrcLang,
			entry.TgtLang,
			entry.Provider,
			entry.Model,
			entry.Translation,
		).
		Suffix("ON CONFLICT(source_text, src_lang, tgt_lang, provider, model) DO UPDATE SET translation=excluded.translation")
	sqlStr, args, _ := q.ToSql()
	_, err := r.DB.ExecContext(ctx, sqlStr, args...)
	return err
}
