package sqlite

import (
	"database/sql"

	sq "github.com/Masterminds/squirrel"
)

// Repo provides a base for Squirrel-based repositories.
type Repo struct {
	DB *sql.DB
	SQ sq.StatementBuilderType
}

func NewRepo(db *sql.DB) *Repo {
	return &Repo{DB: db, SQ: sq.StatementBuilder}
}
