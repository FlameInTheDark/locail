package valvevdf

import (
	"bufio"
	"bytes"
	"locail/internal/domain"
	"locail/internal/ports"
	"regexp"
	"strings"
)

var pairRE = regexp.MustCompile(`"([^"]+)"\s+"([^"]*)"`)

type Parser struct{}

func New() *Parser { return &Parser{} }

func (p *Parser) Format() string { return "valvevdf" }

func (p *Parser) Parse(data []byte) (ports.ParseResult, error) {
	data = stripBOM(data)
	// Minimal scanner for tokens inside `tokens { ... }` block.
	sc := bufio.NewScanner(bytes.NewReader(data))
	inTokens := false
	units := make([]*domain.Unit, 0, 256)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if len(line) == 0 || strings.HasPrefix(line, "//") {
			continue
		}
		if strings.HasPrefix(line, "\"tokens\"") {
			inTokens = true
			continue
		}
		if inTokens {
			if strings.HasPrefix(line, "}") { // tokens block end
				inTokens = false
				continue
			}
			m := pairRE.FindStringSubmatch(line)
			if len(m) == 3 {
				key := m[1]
				val := m[2]
				units = append(units, &domain.Unit{Key: key, SourceText: val})
			}
		}
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
