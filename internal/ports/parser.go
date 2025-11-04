package ports

import (
    "locail/internal/domain"
)

type ParseResult struct {
    Units  []*domain.Unit
    Locale string // optional, if detected from file
}

type Parser interface {
    Format() string
    Parse(data []byte) (ParseResult, error)
}

