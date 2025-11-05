package paraglidejson

import (
	"bytes"
	"encoding/json"
	"fmt"
	"locail/internal/domain"
	"locail/internal/ports"
)

type Parser struct{}

func New() *Parser { return &Parser{} }

func (p *Parser) Format() string { return "paraglidejson" }

func (p *Parser) Parse(data []byte) (ports.ParseResult, error) {
	// Strip UTF-8 BOM if present
	data = stripBOM(data)
	// Expect a flat JSON object { key: value, ... }
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return ports.ParseResult{}, fmt.Errorf("invalid json: %w", err)
	}
	units := make([]*domain.Unit, 0, len(m))
	for k, v := range m {
		// Ignore metadata fields like $schema
		if len(k) > 0 && k[0] == '$' {
			continue
		}
		s, ok := v.(string)
		if !ok {
			continue
		}
		units = append(units, &domain.Unit{Key: k, SourceText: s})
	}
	return ports.ParseResult{Units: units}, nil
}

func stripBOM(b []byte) []byte {
	bom := []byte{0xEF, 0xBB, 0xBF}
	if len(b) >= 3 && bytes.Equal(b[:3], bom) {
		return b[3:]
	}
	return b
}
