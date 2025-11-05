package csvparser

import (
	"bufio"
	"bytes"
	"encoding/csv"
	"errors"
	"io"
	"locail/internal/domain"
	"locail/internal/ports"
	"strings"
)

type Parser struct{}

func New() *Parser { return &Parser{} }

func (p *Parser) Format() string { return "csv" }

func (p *Parser) Parse(data []byte) (ports.ParseResult, error) {
	data = stripBOM(data)
	r := csv.NewReader(bufio.NewReader(bytes.NewReader(data)))
	r.TrimLeadingSpace = true
	header, err := r.Read()
	if err != nil {
		return ports.ParseResult{}, err
	}
	idx := map[string]int{}
	for i, h := range header {
		idx[strings.ToLower(strings.TrimSpace(h))] = i
	}
	keyIdx, ok := idx["key"]
	if !ok {
		return ports.ParseResult{}, errors.New("csv missing 'key' column")
	}
	// Support source column names
	srcIdx := -1
	for _, name := range []string{"source", "value", "text", "default"} {
		if i, ok := idx[name]; ok {
			srcIdx = i
			break
		}
	}
	if srcIdx == -1 {
		return ports.ParseResult{}, errors.New("csv missing source column (source/value/text/default)")
	}
	ctxIdx := -1
	if i, ok := idx["context"]; ok {
		ctxIdx = i
	}
	var units []*domain.Unit
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return ports.ParseResult{}, err
		}
		key := rec[keyIdx]
		if key == "" {
			continue
		}
		src := rec[srcIdx]
		var c string
		if ctxIdx >= 0 && ctxIdx < len(rec) {
			c = rec[ctxIdx]
		}
		units = append(units, &domain.Unit{Key: key, SourceText: src, Context: c})
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
